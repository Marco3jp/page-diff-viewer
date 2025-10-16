import type { Route } from "./+types/home";
import { useState, useEffect } from "react";

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

type InputMode = "url" | "host-path";

export default function Home() {
  // クエリパラメータから初期モードを取得（デフォルトは host-path）
  const [inputMode, setInputMode] = useState<InputMode>("host-path");

  // URLモード用
  const [urlA, setUrlA] = useState("");
  const [urlB, setUrlB] = useState("");

  // ホスト+パスモード用
  const [hostA, setHostA] = useState("");
  const [hostB, setHostB] = useState("");
  const [pagePath, setPagePath] = useState("");

  const [fullPage, setFullPage] = useState(true);
  const [waitSelector, setWaitSelector] = useState("");
  const [waitMs, setWaitMs] = useState<number | "">(5000);
  const [removeSelectors, setRemoveSelectors] = useState("");
  const [basicAuthA, setBasicAuthA] = useState({ username: "", password: "" });
  const [basicAuthB, setBasicAuthB] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgA, setImgA] = useState<string | null>(null);
  const [imgB, setImgB] = useState<string | null>(null);
  const [imgDiff, setImgDiff] = useState<string | null>(null);

  // クエリパラメータから初期モードを読み込み
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    if (mode === "url" || mode === "host-path") {
      setInputMode(mode);
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setImgA(null);
    setImgB(null);
    setImgDiff(null);

    // 入力モードに応じてURLを構築
    let finalUrlA: string;
    let finalUrlB: string;

    if (inputMode === "url") {
      finalUrlA = urlA;
      finalUrlB = urlB;
    } else {
      // host-path モード
      if (!hostA || !hostB) {
        setError("Host A と Host B を入力してください");
        return;
      }
      if (!pagePath) {
        setError("ページパスを入力してください");
        return;
      }

      // ホストの末尾の / とパスの先頭の / を正規化
      const normalizedHostA = hostA.replace(/\/$/, "");
      const normalizedHostB = hostB.replace(/\/$/, "");
      const normalizedPath = pagePath.startsWith("/") ? pagePath : `/${pagePath}`;

      finalUrlA = `${normalizedHostA}${normalizedPath}`;
      finalUrlB = `${normalizedHostB}${normalizedPath}`;
    }

    // 簡易URL検証（詳細バリデーションは別タスク）
    try {
      const u1 = new URL(finalUrlA);
      const u2 = new URL(finalUrlB);
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
      // 削除対象セレクタを改行で分割して配列に変換（空行は除外）
      const removeSelectorsArray = removeSelectors
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const res = await fetch("/api/screenshot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          urlA: finalUrlA,
          urlB: finalUrlB,
          fullPage,
          viewport: { width: 1366, height: 768, deviceScaleFactor: 1 },
          timeoutMs: 60000,
          diff: { enable: true, threshold: 0.1, includeAA: true, alpha: 255 },
          waitSelector: waitSelector || undefined,
          waitMs: typeof waitMs === "number" ? waitMs : undefined,
          removeSelectors: removeSelectorsArray.length > 0 ? removeSelectorsArray : undefined,
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
      {/* モード切り替えボタン */}
      <div className="flex gap-2 items-center">
        <span className="text-sm text-gray-600">入力モード:</span>
        <button
          type="button"
          onClick={() => setInputMode("host-path")}
          className={`px-3 py-1 rounded text-sm ${
            inputMode === "host-path"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          ホスト + パス
        </button>
        <button
          type="button"
          onClick={() => setInputMode("url")}
          className={`px-3 py-1 rounded text-sm ${
            inputMode === "url"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          URL直接入力
        </button>
      </div>

      <form onSubmit={onSubmit} name="page-diff-viewer-form" className="space-y-4">
        {inputMode === "url" ? (
          /* URLモードUI */
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
          </div>
        ) : (
          /* ホスト+パスモードUI */
          <div className="grid gap-4">
            {/* ページパスを上部に配置 */}
            <label className="block">
              <span className="text-sm text-gray-600">ページパス</span>
              <input
                type="text"
                required
                placeholder="/path/to/page"
                value={pagePath}
                onChange={(e) => setPagePath(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring"
              />
            </label>
            {/* Host A と Host B を左右に並べる */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Host A */}
              <div className="p-4 space-y-3">
                <h3 className="font-semibold text-gray-700">Host A</h3>
                <label className="block">
                  <span className="text-sm text-gray-600">ホスト</span>
                  <input
                    type="url"
                    name="page-diff-viewer-host-a"
                    autoComplete="url"
                    required
                    placeholder="https://example.com"
                    value={hostA}
                    onChange={(e) => setHostA(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs text-gray-500">Basic認証 ユーザー名（任意）</span>
                    <input
                      type="text"
                      placeholder="username"
                      value={basicAuthA.username}
                      onChange={(e) => setBasicAuthA({ ...basicAuthA, username: e.target.value })}
                      className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-500">Basic認証 パスワード（任意）</span>
                    <input
                      type="password"
                      placeholder="password"
                      value={basicAuthA.password}
                      onChange={(e) => setBasicAuthA({ ...basicAuthA, password: e.target.value })}
                      className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring text-sm"
                    />
                  </label>
                </div>
              </div>

              {/* Host B */}
              <div className="p-4 space-y-3">
                <h3 className="font-semibold text-gray-700">Host B</h3>
                <label className="block">
                  <span className="text-sm text-gray-600">ホスト</span>
                  <input
                    type="url"
                    name="page-diff-viewer-host-b"
                    autoComplete="url"
                    required
                    placeholder="https://example.org"
                    value={hostB}
                    onChange={(e) => setHostB(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs text-gray-500">Basic認証 ユーザー名（任意）</span>
                    <input
                      type="text"
                      placeholder="username"
                      value={basicAuthB.username}
                      onChange={(e) => setBasicAuthB({ ...basicAuthB, username: e.target.value })}
                      className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-500">Basic認証 パスワード（任意）</span>
                    <input
                      type="password"
                      placeholder="password"
                      value={basicAuthB.password}
                      onChange={(e) => setBasicAuthB({ ...basicAuthB, password: e.target.value })}
                      className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring text-sm"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* セレクタと待機時間（どちらのモードでも共通） */}
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
        {/* 要素削除セレクタ（可変要素を削除） */}
        <label className="block">
          <span className="text-sm text-gray-600">削除するCSSセレクタ（任意、複数行で複数指定可）</span>
          <textarea
            placeholder=".dynamic-timestamp&#10;#ad-banner&#10;.user-specific-content"
            value={removeSelectors}
            onChange={(e) => setRemoveSelectors(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring font-mono text-sm"
          />
          <span className="text-xs text-gray-500 mt-1 block">
            時刻や広告など、可変な要素のセレクタを改行区切りで指定すると、スクリーンショット前にDOMから削除されます（高さが違っても位置ズレなし）
          </span>
        </label>
        {/* 比較ボタンとフルページチェックボックスを横並び */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {loading ? "撮影中..." : "比較する"}
          </button>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={fullPage}
              onChange={(e) => setFullPage(e.target.checked)}
            />
            <span>フルページで撮影</span>
          </label>
        </div>
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
