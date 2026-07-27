/**
 * Netlify Edge Function：把同源 /defense-api/* 反代到 ngrok 後端 /defense/*，
 * 並補上 ngrok-skip-browser-warning header → 繞過 ngrok free 攔截頁。
 *
 * 效果：API 變成與前端「同源」(都在 netlify)：
 *   ① OAuth 導向不再 top-level 打 ngrok → 不撞攔截頁
 *   ② session cookie / oauth_state 變第一方 cookie → 手機不再被擋
 *   ③ Bearer token 交接仍作後備
 *
 * ⚠️ 後端 ngrok 網址若變，改這裡的 BACKEND；Discord redirect_uri 要指向
 *    netlify 的 /defense-api/api/auth/discord/callback。
 */
const BACKEND = "https://primary-marmoset-publicly.ngrok-free.app/defense";

export default async (request) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/defense-api/, ""); // /defense-api/api/x → /api/x
  const target = BACKEND + path + url.search;

  const headers = new Headers(request.headers);
  headers.set("ngrok-skip-browser-warning", "1");
  headers.delete("host"); // 讓 fetch 用後端 host

  const init = { method: request.method, headers, redirect: "manual" };
  if (!["GET", "HEAD"].includes(request.method)) init.body = request.body;

  const resp = await fetch(target, init);

  // 重建回應，保留多個 Set-Cookie(標準 Headers 會把它們合併成一條→cookie 壞掉)
  const outHeaders = new Headers(resp.headers);
  const setCookies = typeof resp.headers.getSetCookie === "function" ? resp.headers.getSetCookie() : [];
  if (setCookies.length) {
    outHeaders.delete("set-cookie");
    for (const c of setCookies) outHeaders.append("set-cookie", c);
  }
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: outHeaders });
};
// 路由宣告在 netlify.toml [[edge_functions]] path="/defense-api/*"(勿在此重複宣告 config)
