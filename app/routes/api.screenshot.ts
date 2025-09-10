import type { ActionFunctionArgs } from "react-router";

type Viewport = {
  width: number;
  height: number;
  deviceScaleFactor?: number;
};

type DiffOptions = {
  enable?: boolean;
  threshold?: number; // 0..1, smaller is more sensitive
  includeAA?: boolean;
  alpha?: number; // 0..255
};

type ScreenshotRequestBody = {
  urlA: string;
  urlB: string;
  viewport?: Viewport;
  fullPage?: boolean;
  timeoutMs?: number;
  diff?: DiffOptions;
  waitSelector?: string; // optional CSS selector to wait for
  waitMs?: number; // additional wait in ms
};

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method.toUpperCase() !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: ScreenshotRequestBody | null = null;
  try {
    body = (await request.json()) as ScreenshotRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const urlA = body?.urlA ?? "";
  const urlB = body?.urlB ?? "";
  if (!isValidHttpUrl(urlA) || !isValidHttpUrl(urlB)) {
    return new Response(JSON.stringify({ error: "urlA/urlB must be valid http(s) URLs" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const viewport: Viewport = {
    width: body?.viewport?.width ?? 1366,
    height: body?.viewport?.height ?? 768,
    deviceScaleFactor: body?.viewport?.deviceScaleFactor ?? 1,
  };
  const fullPage = body?.fullPage ?? false;
  const timeoutMs = body?.timeoutMs ?? 45000;
  const diffOptions: DiffOptions = {
    enable: body?.diff?.enable ?? true,
    threshold: body?.diff?.threshold ?? 0.1,
    includeAA: body?.diff?.includeAA ?? true,
    alpha: body?.diff?.alpha ?? 255,
  };

  // Dynamic imports to ensure server-only usage and avoid bundling into client
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({
    // Helpful for containers and some Linux envs
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  });

  try {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor,
      ignoreHTTPSErrors: true,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 page-diff-viewer-screenshoter",
    });

    // Helper to capture a screenshot for a given URL
    const capture = async (url: string): Promise<Buffer> => {
      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: "load", timeout: timeoutMs });
        if (body?.waitSelector) {
          try { await page.waitForSelector(body.waitSelector, { timeout: Math.min(timeoutMs, 15000) }); } catch {}
        }
        if (typeof body?.waitMs === "number" && body.waitMs > 0) {
          await page.waitForTimeout(Math.min(body.waitMs, 15000));
        }
        const buf = await page.screenshot({ type: "png", fullPage });
        return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
      } finally {
        await page.close({ runBeforeUnload: true });
      }
    };

    const [bufA, bufB] = await Promise.all([capture(urlA), capture(urlB)]);

    let diffBase64: string | null = null;
    if (diffOptions.enable) {
      // Compute diff on server using pngjs + pixelmatch
      const [{ PNG }, pixelmatch] = await Promise.all([
        import("pngjs"),
        import("pixelmatch").then((m) => m.default ?? (m as any)),
      ]);

      const imgA = (PNG as any).sync.read(bufA) as { width: number; height: number; data: Buffer };
      const imgB = (PNG as any).sync.read(bufB) as { width: number; height: number; data: Buffer };

      // Ensure same dimensions; with fullPage=false and fixed viewport, this should hold
      const width = Math.min(imgA.width, imgB.width);
      const height = Math.min(imgA.height, imgB.height);

      // If sizes differ, crop to common area to allow pixelmatch
      const crop = (img: any, w: number, h: number) => {
        if (img.width === w && img.height === h) return img;
        const out = new (PNG as any)({ width: w, height: h });
        // fast path: copy row by row
        for (let y = 0; y < h; y++) {
          const srcStart = y * img.width * 4;
          const dstStart = y * w * 4;
          img.data.copy(out.data, dstStart, srcStart, srcStart + w * 4);
        }
        return out;
      };

      const a = crop(imgA, width, height);
      const b = crop(imgB, width, height);
      const diff = new (PNG as any)({ width, height });

      pixelmatch(a.data, b.data, diff.data, width, height, {
        threshold: diffOptions.threshold,
        includeAA: diffOptions.includeAA,
        alpha: diffOptions.alpha,
      });

      const diffBuf: Buffer = (PNG as any).sync.write(diff);
      diffBase64 = `data:image/png;base64,${diffBuf.toString("base64")}`;
    }

    const aBase64 = `data:image/png;base64,${bufA.toString("base64")}`;
    const bBase64 = `data:image/png;base64,${bufB.toString("base64")}`;

    return new Response(
      JSON.stringify({
        ok: true,
        a: aBase64,
        b: bBase64,
        diff: diffBase64,
        meta: { viewport, fullPage },
      }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  } finally {
    await browser.close();
  }
}

export const loader = () => new Response("Method Not Allowed", { status: 405 });
