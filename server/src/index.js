/**
 * Artale Web API — 本機開發用
 * 讀取 Discord Bot 的 player-data.json，提供角色／裝備給網頁 Hub。
 *
 *   PLAYER_DATA_PATH=... npm run dev
 *   預設: ../../artale-lottery-bot/player-data.json
 */
import http from "http";
import {
  getDataPath,
  findAccountsByName,
  accountSummary,
  selectCharacter,
  getCharacterDetail,
} from "./store.js";

const PORT = Number(process.env.PORT) || 8787;

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(data);
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  const { pathname } = url;

  if (req.method === "OPTIONS") {
    return json(res, 204, {});
  }

  try {
    if (req.method === "GET" && pathname === "/api/health") {
      return json(res, 200, {
        ok: true,
        product: "artale-web-api",
        dataPath: getDataPath(),
        combat: "action-v1-planned",
        discordRaid: "disabled-on-web-launch",
      });
    }

    if (req.method === "GET" && pathname === "/api/dev/search") {
      const q = url.searchParams.get("q") || "";
      return json(res, 200, { results: findAccountsByName(q, 30) });
    }

    if (req.method === "GET" && pathname === "/api/me") {
      const id = url.searchParams.get("discordId");
      if (!id) return json(res, 400, { error: "缺少 discordId" });
      const me = accountSummary(id);
      if (!me) return json(res, 404, { error: "找不到此 Discord 帳號資料" });
      return json(res, 200, me);
    }

    if (req.method === "GET" && pathname.startsWith("/api/me/characters/")) {
      const id = url.searchParams.get("discordId");
      const charId = decodeURIComponent(pathname.split("/").pop());
      if (!id) return json(res, 400, { error: "缺少 discordId" });
      const detail = getCharacterDetail(id, charId);
      if (!detail) return json(res, 404, { error: "找不到角色" });
      return json(res, 200, detail);
    }

    if (req.method === "POST" && pathname === "/api/me/select-char") {
      const body = await readBody(req);
      const { discordId, charId } = body;
      if (!discordId || !charId) {
        return json(res, 400, { error: "需要 discordId 與 charId" });
      }
      const me = selectCharacter(discordId, charId);
      return json(res, 200, me);
    }

    // 預留：動作戰鬥 session（M3）
    if (req.method === "POST" && pathname === "/api/combat/raid/start") {
      return json(res, 501, {
        error: "動作戰鬥 M3 開發中",
        plan: "完整動作向 Boss 戰（非文字模擬）",
      });
    }

    json(res, 404, { error: "not found", path: pathname });
  } catch (e) {
    console.error(e);
    json(res, 500, { error: e.message || "server error" });
  }
});

server.listen(PORT, () => {
  console.log(`[artale-api] http://127.0.0.1:${PORT}`);
  console.log(`[artale-api] data: ${getDataPath()}`);
});
