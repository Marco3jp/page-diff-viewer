import type { Route } from "./+types/home";
import { useState } from "react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Page Diff Viewer" },
    { name: "description", content: "Compare two page screenshots and diff." },
  ];
}

type ApiResponse = {
  ok: boolean;
  a?: string;
  b?: string;
  diff?: string | null;
  error?: string;
};

export default function Home() {
  const [urlA, setUrlA] = useState("");
  const [urlB, setUrlB] = useState("");
  const [fullPage, setFullPage] = useState(true);
  const [waitSelector, setWaitSelector] = useState("");
  const [waitMs, setWaitMs] = useState<number | "">("");
  const [basicAuthA, setBasicAuthA] = useState({ username: "", password: "" });
  const [basicAuthB, setBasicAuthB] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgA, setImgA] = useState<string | null>(null);
  const [imgB, setImgB] = useState<string | null>(null);
  const [imgDiff, setImgDiff] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setImgA(null);
    setImgB(null);
    setImgDiff(null);

    // 簡易URL検証（詳細バリデーションは別タスク）
    try {
      const u1 = new URL(urlA);
      const u2 = new URL(urlB);
      if (!/^https?:$/.test(u1.protocol) || !/^https?:$/.test(u2.protocol)) {
        setError("http(s)のURLを入力してください");
        return;
      }
    } catch {
      setError("URLの形式が不正です");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/screenshot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          urlA,
          urlB,
          fullPage,
          viewport: { width: 1366, height: 768, deviceScaleFactor: 1 },
          timeoutMs: 60000,
          diff: { enable: true, threshold: 0.1, includeAA: true, alpha: 255 },
          waitSelector: waitSelector || undefined,
          waitMs: typeof waitMs === "number" ? waitMs : undefined,
          basicAuthA: basicAuthA.username ? basicAuthA : undefined,
          basicAuthB: basicAuthB.username ? basicAuthB : undefined,
        }),
      });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok || !data.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setImgA(data.a ?? null);
      setImgB(data.b ?? null);
      setImgDiff(data.diff ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-4 space-y-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-3">
          <label className="block">
            <span className="text-sm text-gray-600">URL A</span>
            <input
              type="url"
              required
              placeholder="https://example.com"
              value={urlA}
              onChange={(e) => setUrlA(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring"
            />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-4">
            <label className="block">
              <span className="text-xs text-gray-500">Basic認証 ユーザー名 (URL A用, 任意)</span>
              <input
                type="text"
                placeholder="username"
                value={basicAuthA.username}
                onChange={(e) => setBasicAuthA({ ...basicAuthA, username: e.target.value })}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">Basic認証 パスワード (URL A用, 任意)</span>
              <input
                type="password"
                placeholder="password"
                value={basicAuthA.password}
                onChange={(e) => setBasicAuthA({ ...basicAuthA, password: e.target.value })}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring text-sm"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm text-gray-600">URL B</span>
            <input
              type="url"
              required
              placeholder="https://example.org"
              value={urlB}
              onChange={(e) => setUrlB(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring"
            />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-4">
            <label className="block">
              <span className="text-xs text-gray-500">Basic認証 ユーザー名 (URL B用, 任意)</span>
              <input
                type="text"
                placeholder="username"
                value={basicAuthB.username}
                onChange={(e) => setBasicAuthB({ ...basicAuthB, username: e.target.value })}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">Basic認証 パスワード (URL B用, 任意)</span>
              <input
                type="password"
                placeholder="password"
                value={basicAuthB.password}
                onChange={(e) => setBasicAuthB({ ...basicAuthB, password: e.target.value })}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring text-sm"
              />
            </label>
          </div>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={fullPage}
              onChange={(e) => setFullPage(e.target.checked)}
            />
            <span>フルページで撮影</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-gray-600">待機CSSセレクタ（任意）</span>
              <input
                type="text"
                placeholder="#app .ready"
                value={waitSelector}
                onChange={(e) => setWaitSelector(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring"
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-600">追加待機時間ms（任意, 最大15000）</span>
              <input
                type="number"
                min={0}
                max={15000}
                step={100}
                placeholder="1000"
                value={waitMs}
                onChange={(e) => setWaitMs(e.target.value === "" ? "" : Number(e.target.value))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring"
              />
            </label>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "撮影中..." : "比較する"}
        </button>
      </form>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}

      {(imgA || imgB || imgDiff) && (
        <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen grid grid-cols-1 md:grid-cols-3 gap-6 px-6">
          <div>
            <h2 className="mb-2 font-medium">Screenshot A</h2>
            {imgA ? (
              <img src={imgA} alt="A" className="w-full border rounded" />
            ) : (
              <div className="h-64 border rounded grid place-items-center text-gray-500">
                画像なし
              </div>
            )}
          </div>
          <div>
            <h2 className="mb-2 font-medium">Screenshot B</h2>
            {imgB ? (
              <img src={imgB} alt="B" className="w-full border rounded" />
            ) : (
              <div className="h-64 border rounded grid place-items-center text-gray-500">
                画像なし
              </div>
            )}
          </div>
          <div>
            <h2 className="mb-2 font-medium">Diff</h2>
            {imgDiff ? (
              <img src={imgDiff} alt="Diff" className="w-full border rounded" />
            ) : (
              <div className="h-64 border rounded grid place-items-center text-gray-500">
                画像なし
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
