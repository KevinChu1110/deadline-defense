/**
 * Discord OAuth2 + 簡易 session（cookie）
 *
 * 環境變數（server/.env 或 shell）：
 *   DISCORD_CLIENT_ID
 *   DISCORD_CLIENT_SECRET
 *   DISCORD_REDIRECT_URI   預設 http://127.0.0.1:8787/api/auth/discord/callback
 *   WEB_ORIGIN            預設 http://127.0.0.1:5173
 *   SESSION_SECRET        可選，用於簽章
 *   ALLOW_DEV_LOGIN=1     允許本機用 discordId 免 OAuth（預設開）
 */
import crypto from "crypto";

const sessions = new Map(); // sid -> { discordId, username, avatar, exp }

const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";
// 重要：Redirect 必須與網頁同源（經 Vite proxy），cookie 才會留在 5173
const REDIRECT_URI =
  process.env.DISCORD_REDIRECT_URI ||
  "http://127.0.0.1:5173/api/auth/discord/callback";
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://127.0.0.1:5173";
const ALLOW_DEV_LOGIN = process.env.ALLOW_DEV_LOGIN !== "0";

export function oauthConfigured() {
  return !!(CLIENT_ID && CLIENT_SECRET);
}

export function getAuthConfig() {
  return {
    oauthConfigured: oauthConfigured(),
    allowDevLogin: ALLOW_DEV_LOGIN,
    webOrigin: WEB_ORIGIN,
    redirectUri: REDIRECT_URI,
    clientId: CLIENT_ID ? `${CLIENT_ID.slice(0, 6)}…` : null,
  };
}

export function getAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "identify",
    state: state || crypto.randomBytes(8).toString("hex"),
    prompt: "consent",
  });
  return `https://discord.com/api/oauth2/authorize?${params}`;
}

export async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
  });
  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || "token exchange failed");
  }
  return data;
}

export async function fetchDiscordUser(accessToken) {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "fetch user failed");
  }
  return data;
}

export function createSession(user) {
  const sid = crypto.randomBytes(24).toString("hex");
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  sessions.set(sid, {
    discordId: String(user.id),
    username: user.global_name || user.username || "冒險者",
    avatar: user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
      : null,
    exp,
  });
  return sid;
}

export function createDevSession(discordId, username = "Dev") {
  return createSession({
    id: String(discordId),
    username,
    global_name: username,
    avatar: null,
  });
}

export function getSession(sid) {
  if (!sid) return null;
  const s = sessions.get(sid);
  if (!s) return null;
  if (Date.now() > s.exp) {
    sessions.delete(sid);
    return null;
  }
  return s;
}

export function destroySession(sid) {
  if (sid) sessions.delete(sid);
}

export function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

export function sessionCookie(sid, { clear = false } = {}) {
  const secure =
    process.env.COOKIE_SECURE === "1" ||
    process.env.COOKIE_SECURE === "true"
      ? "; Secure"
      : "";
  if (clear) {
    return `artale_sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  }
  const maxAge = 7 * 24 * 60 * 60;
  return `artale_sid=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function corsHeaders(req) {
  const origin = req.headers.origin || WEB_ORIGIN;
  // 開發時允許 vite origin
  const allowed = new Set([
    WEB_ORIGIN,
    "http://127.0.0.1:5173",
    "http://localhost:5173",
  ]);
  const allow = allowed.has(origin) ? origin : WEB_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export { WEB_ORIGIN, ALLOW_DEV_LOGIN, REDIRECT_URI };
