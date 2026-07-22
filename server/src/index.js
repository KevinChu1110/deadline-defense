/**
 * Artale Web API
 *
 *   npm run dev:api
 *   環境變數見 server/env.example
 */
import "./load-env.js"; // 必須最先：填 process.env 後再載 store/auth
import http from "http";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import {
  getDataPath,
  findAccountsByName,
  accountSummary,
  selectCharacter,
  getCharacterDetail,
  ensureAccountFromDiscord,
  getEquipView,
  equipOnAccount,
  unequipOnAccount,
  getStarforceOnAccount,
  attemptStarforceOnAccount,
  getPotentialOnAccount,
  usePotentialOnAccount,
  craftPotentialOnAccount,
  getCombatProfile,
  startActionRaid,
  completeActionRaid,
} from "./store.js";
import * as auth from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || "0.0.0.0";
const STATIC_DIR = process.env.STATIC_DIR
  ? path.resolve(process.env.STATIC_DIR)
  : path.resolve(__dirname, "../../dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".map": "application/json",
};

function tryServeStatic(res, pathname) {
  if (!STATIC_DIR || !fs.existsSync(STATIC_DIR)) return false;
  let rel = pathname === "/" ? "/index.html" : pathname;
  // 禁止 path traversal
  const file = path.normalize(path.join(STATIC_DIR, rel));
  if (!file.startsWith(STATIC_DIR)) return false;

  const sendFile = (fp) => {
    const ext = path.extname(fp).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control":
        ext === ".html" ? "no-cache" : "public, max-age=86400",
    });
    fs.createReadStream(fp).pipe(res);
    return true;
  };

  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    return sendFile(file);
  }
  // SPA fallback（非 API）
  if (!pathname.startsWith("/api")) {
    const index = path.join(STATIC_DIR, "index.html");
    if (fs.existsSync(index)) return sendFile(index);
  }
  return false;
}

function json(res, status, body, req, extraHeaders = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...auth.corsHeaders(req),
    ...extraHeaders,
  });
  res.end(data);
}

function redirect(res, location, extraHeaders = {}) {
  res.writeHead(302, { Location: location, ...extraHeaders });
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function sessionFromReq(req) {
  const cookies = auth.parseCookies(req);
  return auth.getSession(cookies.artale_sid);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  const { pathname } = url;

  if (req.method === "OPTIONS") {
    res.writeHead(204, auth.corsHeaders(req));
    return res.end();
  }

  try {
    if (req.method === "GET" && pathname === "/api/health") {
      return json(
        res,
        200,
        {
          ok: true,
          product: "artale-web-api",
          dataPath: getDataPath(),
          auth: auth.getAuthConfig(),
          combat: "action-raid-v1",
          discordRaid: "disabled-on-web-launch",
        },
        req
      );
    }

    if (req.method === "GET" && pathname === "/api/auth/config") {
      return json(res, 200, auth.getAuthConfig(), req);
    }

    if (req.method === "GET" && pathname === "/api/auth/discord") {
      if (!auth.oauthConfigured()) {
        return json(
          res,
          503,
          {
            error: "尚未設定 Discord OAuth",
            hint: "請在 server/.env 填 DISCORD_CLIENT_ID / SECRET，見 server/.env.example",
          },
          req
        );
      }
      const state = crypto.randomBytes(12).toString("hex");
      const authorize = auth.getAuthorizeUrl(state);
      return redirect(res, authorize, {
        "Set-Cookie": `artale_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
      });
    }

    if (req.method === "GET" && pathname === "/api/auth/discord/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const cookies = auth.parseCookies(req);
      const web = auth.WEB_ORIGIN;

      if (!code) {
        return redirect(res, `${web}/?artale_login=error&msg=missing_code`);
      }
      if (
        cookies.artale_oauth_state &&
        state &&
        cookies.artale_oauth_state !== state
      ) {
        return redirect(res, `${web}/?artale_login=error&msg=state_mismatch`);
      }

      try {
        const token = await auth.exchangeCode(code);
        const user = await auth.fetchDiscordUser(token.access_token);
        ensureAccountFromDiscord({
          id: user.id,
          username: user.global_name || user.username,
        });
        const sid = auth.createSession(user);
        // 多個 Set-Cookie 要用陣列
        res.writeHead(302, {
          Location: `${web}/?artale_login=ok`,
          "Set-Cookie": [
            auth.sessionCookie(sid),
            "artale_oauth_state=; Path=/; HttpOnly; Max-Age=0",
          ],
        });
        return res.end();
      } catch (e) {
        console.error("[oauth]", e);
        return redirect(
          res,
          `${web}/?artale_login=error&msg=${encodeURIComponent(e.message || "oauth_failed")}`
        );
      }
    }

    if (req.method === "GET" && pathname === "/api/auth/me") {
      const sess = sessionFromReq(req);
      if (!sess) {
        return json(res, 401, { error: "未登入", auth: auth.getAuthConfig() }, req);
      }
      const me = accountSummary(sess.discordId);
      return json(
        res,
        200,
        {
          session: {
            discordId: sess.discordId,
            username: sess.username,
            avatar: sess.avatar,
          },
          me,
        },
        req
      );
    }

    if (req.method === "POST" && pathname === "/api/auth/logout") {
      const cookies = auth.parseCookies(req);
      auth.destroySession(cookies.artale_sid);
      return json(res, 200, { ok: true }, req, {
        "Set-Cookie": auth.sessionCookie("", { clear: true }),
      });
    }

    if (req.method === "POST" && pathname === "/api/auth/dev-login") {
      if (!auth.ALLOW_DEV_LOGIN) {
        return json(res, 403, { error: "已關閉 dev login" }, req);
      }
      const body = await readBody(req);
      const discordId = String(body.discordId || "").trim();
      if (!discordId) return json(res, 400, { error: "缺少 discordId" }, req);
      let me = accountSummary(discordId);
      if (!me) {
        me = ensureAccountFromDiscord({
          id: discordId,
          username: body.username || `User_${discordId.slice(-4)}`,
        });
      }
      const sid = auth.createDevSession(discordId, me.username);
      return json(
        res,
        200,
        { ok: true, me, session: { discordId, username: me.username } },
        req,
        { "Set-Cookie": auth.sessionCookie(sid) }
      );
    }

    if (req.method === "GET" && pathname === "/api/dev/search") {
      const q = url.searchParams.get("q") || "";
      return json(res, 200, { results: findAccountsByName(q, 30) }, req);
    }

    if (req.method === "GET" && pathname === "/api/me") {
      const sess = sessionFromReq(req);
      const id = sess?.discordId || url.searchParams.get("discordId");
      if (!id) return json(res, 401, { error: "請先登入 Discord" }, req);
      if (!sess && !auth.ALLOW_DEV_LOGIN) {
        return json(res, 401, { error: "請先 Discord 登入" }, req);
      }
      const me = accountSummary(id);
      if (!me) return json(res, 404, { error: "找不到此 Discord 帳號資料" }, req);
      return json(res, 200, me, req);
    }

    if (req.method === "GET" && pathname.startsWith("/api/me/characters/")) {
      const sess = sessionFromReq(req);
      const id = sess?.discordId || url.searchParams.get("discordId");
      const charId = decodeURIComponent(pathname.split("/").pop());
      if (!id) return json(res, 401, { error: "請先登入" }, req);
      const detail = getCharacterDetail(id, charId);
      if (!detail) return json(res, 404, { error: "找不到角色" }, req);
      return json(res, 200, detail, req);
    }

    if (req.method === "POST" && pathname === "/api/me/select-char") {
      const sess = sessionFromReq(req);
      const body = await readBody(req);
      const discordId = sess?.discordId || body.discordId;
      const { charId } = body;
      if (!discordId || !charId) {
        return json(res, 400, { error: "需要登入與 charId" }, req);
      }
      if (sess && body.discordId && body.discordId !== sess.discordId) {
        return json(res, 403, { error: "不可操作他人帳號" }, req);
      }
      const me = selectCharacter(discordId, charId);
      return json(res, 200, me, req);
    }

    // ── 裝備 ─────────────────────────────────────
    if (req.method === "GET" && pathname === "/api/equip") {
      const sess = sessionFromReq(req);
      const id = sess?.discordId || url.searchParams.get("discordId");
      if (!id) return json(res, 401, { error: "請先登入" }, req);
      const view = getEquipView(id);
      if (!view) return json(res, 404, { error: "找不到帳號" }, req);
      return json(res, 200, view, req);
    }

    if (req.method === "POST" && pathname === "/api/equip/wear") {
      const sess = sessionFromReq(req);
      const body = await readBody(req);
      const discordId = sess?.discordId || body.discordId;
      if (!discordId) return json(res, 401, { error: "請先登入" }, req);
      if (!body.itemId) return json(res, 400, { error: "缺少 itemId" }, req);
      const view = equipOnAccount(discordId, body.itemId, body.subIdx || 0);
      return json(res, 200, view, req);
    }

    if (req.method === "POST" && pathname === "/api/equip/unequip") {
      const sess = sessionFromReq(req);
      const body = await readBody(req);
      const discordId = sess?.discordId || body.discordId;
      if (!discordId) return json(res, 401, { error: "請先登入" }, req);
      if (!body.slot) return json(res, 400, { error: "缺少 slot" }, req);
      const view = unequipOnAccount(discordId, body.slot, body.subIdx || 0);
      return json(res, 200, view, req);
    }

    // ── 星力 ─────────────────────────────────────
    if (req.method === "GET" && pathname === "/api/starforce") {
      const sess = sessionFromReq(req);
      const id = sess?.discordId || url.searchParams.get("discordId");
      if (!id) return json(res, 401, { error: "請先登入" }, req);
      const view = getStarforceOnAccount(id);
      if (!view) return json(res, 404, { error: "找不到帳號" }, req);
      return json(res, 200, view, req);
    }

    if (req.method === "POST" && pathname === "/api/starforce/attempt") {
      const sess = sessionFromReq(req);
      const body = await readBody(req);
      const discordId = sess?.discordId || body.discordId;
      if (!discordId) return json(res, 401, { error: "請先登入" }, req);
      if (!body.slot) return json(res, 400, { error: "缺少 slot" }, req);
      const out = attemptStarforceOnAccount(
        discordId,
        body.slot,
        body.subIdx || 0,
        !!body.safeguard
      );
      return json(res, 200, out, req);
    }

    // ── 潛能 ─────────────────────────────────────
    if (req.method === "GET" && pathname === "/api/potential") {
      const sess = sessionFromReq(req);
      const id = sess?.discordId || url.searchParams.get("discordId");
      if (!id) return json(res, 401, { error: "請先登入" }, req);
      const view = getPotentialOnAccount(id);
      if (!view) return json(res, 404, { error: "找不到帳號" }, req);
      return json(res, 200, view, req);
    }

    if (req.method === "POST" && pathname === "/api/potential/use") {
      const sess = sessionFromReq(req);
      const body = await readBody(req);
      const discordId = sess?.discordId || body.discordId;
      if (!discordId) return json(res, 401, { error: "請先登入" }, req);
      if (!body.slot || !body.action) {
        return json(res, 400, { error: "需要 slot 與 action" }, req);
      }
      const out = usePotentialOnAccount(
        discordId,
        body.slot,
        body.subIdx || 0,
        body.action
      );
      return json(res, 200, out, req);
    }

    if (req.method === "POST" && pathname === "/api/potential/craft") {
      const sess = sessionFromReq(req);
      const body = await readBody(req);
      const discordId = sess?.discordId || body.discordId;
      if (!discordId) return json(res, 401, { error: "請先登入" }, req);
      if (!body.toKey) return json(res, 400, { error: "缺少 toKey" }, req);
      const out = craftPotentialOnAccount(
        discordId,
        body.toKey,
        body.times || 1
      );
      return json(res, 200, out, req);
    }

    // ── 動作突襲 M3 ─────────────────────────────────────
    if (req.method === "GET" && pathname === "/api/combat/profile") {
      const sess = sessionFromReq(req);
      const id = sess?.discordId || url.searchParams.get("discordId");
      if (!id) return json(res, 401, { error: "請先登入" }, req);
      const profile = getCombatProfile(id);
      if (!profile) return json(res, 404, { error: "找不到帳號" }, req);
      return json(res, 200, profile, req);
    }

    if (req.method === "POST" && pathname === "/api/combat/raid/start") {
      const sess = sessionFromReq(req);
      const body = await readBody(req);
      const discordId = sess?.discordId || body.discordId;
      if (!discordId) return json(res, 401, { error: "請先登入" }, req);
      const out = startActionRaid(discordId, body.bossId || "zakum");
      return json(res, 200, out, req);
    }

    if (req.method === "POST" && pathname === "/api/combat/raid/complete") {
      const sess = sessionFromReq(req);
      const body = await readBody(req);
      const discordId = sess?.discordId || body.discordId;
      if (!discordId) return json(res, 401, { error: "請先登入" }, req);
      const out = completeActionRaid(discordId, body);
      return json(res, 200, out, req);
    }

    // 靜態前端（production dist）
    if (req.method === "GET" || req.method === "HEAD") {
      if (tryServeStatic(res, pathname)) return;
    }

    json(res, 404, { error: "not found", path: pathname }, req);
  } catch (e) {
    console.error(e);
    json(res, 500, { error: e.message || "server error" }, req);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[artale-api] http://${HOST}:${PORT}`);
  console.log(`[artale-api] data: ${getDataPath()}`);
  console.log(
    `[artale-api] static: ${fs.existsSync(STATIC_DIR) ? STATIC_DIR : "(none)"}`
  );
  console.log(
    `[artale-api] oauth: ${auth.oauthConfigured() ? "configured" : "NOT set (dev-login OK)"}`
  );
});
