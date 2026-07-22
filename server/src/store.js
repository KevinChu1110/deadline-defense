/**
 * 玩家資料存取層 — 目前直接讀寫 Bot 的 player-data.json
 * 之後可換成 Postgres，路由不用改。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_DATA = path.resolve(
  __dirname,
  "../../../artale-lottery-bot/player-data.json"
);

const DATA_PATH = process.env.PLAYER_DATA_PATH
  ? path.resolve(process.env.PLAYER_DATA_PATH)
  : DEFAULT_DATA;

let cache = null;
let cacheMtime = 0;

export function getDataPath() {
  return DATA_PATH;
}

export function loadAll() {
  if (!fs.existsSync(DATA_PATH)) {
    throw new Error(`player-data 不存在: ${DATA_PATH}`);
  }
  const st = fs.statSync(DATA_PATH);
  if (cache && st.mtimeMs === cacheMtime) return cache;
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  cache = JSON.parse(raw);
  cacheMtime = st.mtimeMs;
  return cache;
}

export function saveAll(data) {
  const tmp = DATA_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, DATA_PATH);
  cache = data;
  cacheMtime = fs.statSync(DATA_PATH).mtimeMs;
}

export function getAccount(discordId) {
  const all = loadAll();
  return all[String(discordId)] || null;
}

export function findAccountsByName(q, limit = 20) {
  const all = loadAll();
  const qq = String(q || "").toLowerCase();
  const hits = [];
  for (const [id, p] of Object.entries(all)) {
    if (!p || typeof p !== "object") continue;
    const name = String(p.username || "");
    if (!qq || name.toLowerCase().includes(qq) || id.includes(qq)) {
      hits.push({
        discordId: id,
        username: name || id,
        charCount: Object.keys(p.characters || {}).length,
      });
    }
    if (hits.length >= limit) break;
  }
  return hits;
}

function normalizeEquipped(eq) {
  if (!eq || typeof eq !== "object") return {};
  const out = {};
  for (const [slot, val] of Object.entries(eq)) {
    if (Array.isArray(val)) {
      out[slot] = val.map(summarizeItem).filter(Boolean);
    } else {
      out[slot] = summarizeItem(val);
    }
  }
  return out;
}

function summarizeItem(it) {
  if (!it || typeof it !== "object") return null;
  return {
    itemId: it.itemId || null,
    name: it.name || "？",
    type: it.type || null,
    level: it.level || 0,
    category: it.category || null,
    baseAd: it.baseAd ?? null,
    scrolledAd: it.scrolledAd ?? 0,
    baseAp: it.baseAp ?? null,
    stars: it.stars ?? null,
    potential: it.potential || it.lines || null,
  };
}

/**
 * 帳號摘要（給 Hub 用）
 */
export function accountSummary(discordId) {
  const p = getAccount(discordId);
  if (!p) return null;

  const chars = [];
  for (const [charId, c] of Object.entries(p.characters || {})) {
    if (!c) continue;
    chars.push({
      charId,
      name: c.name || p.username || "冒險者",
      class: c.class || "beginner",
      level: Math.max(1, Number(c.level) || 1),
      jobCode: Number(c.jobCode) || 0,
      levelStats: c.levelStats || { str: 0, dex: 0, int: 0, luk: 0 },
      totalExp: Number(c.totalExp) || 0,
      isActive: charId === p.activeCharId,
      hasStarSlots: !!(c.starSlots && Object.keys(c.starSlots).length),
      hasPotentialSlots: !!(c.potentialSlots && Object.keys(c.potentialSlots).length),
    });
  }
  chars.sort((a, b) => b.level - a.level);

  // 裝備：優先角色 equipped，否則帳號 equipped
  const active = p.characters?.[p.activeCharId];
  const equipped = normalizeEquipped(active?.equipped || p.equipped || {});

  const items = (p.items || [])
    .filter((it) => it && typeof it === "object")
    .slice(0, 200)
    .map(summarizeItem)
    .filter(Boolean);

  return {
    discordId: String(discordId),
    username: p.username || "冒險者",
    activeCharId: p.activeCharId || chars[0]?.charId || null,
    mapleLeaves: Number(p.mapleLeaves || p.leaves || 0),
    characters: chars,
    equipped,
    inventoryCount: (p.items || []).length,
    inventoryPreview: items.slice(0, 40),
    starSlots: active?.starSlots || {},
    potentialSlots: active?.potentialSlots || {},
  };
}

export function selectCharacter(discordId, charId) {
  const all = loadAll();
  const p = all[String(discordId)];
  if (!p) throw new Error("找不到帳號");
  if (!p.characters?.[charId]) throw new Error("找不到角色");
  p.activeCharId = charId;
  p.lastActiveAt = Date.now();
  saveAll(all);
  return accountSummary(discordId);
}

/**
 * OAuth 首次登入：若 player-data 尚無此 ID，建立空帳號 + 初心者角色
 */
export function ensureAccountFromDiscord(discordUser) {
  const all = loadAll();
  const id = String(discordUser.id || discordUser.discordId);
  if (all[id]) {
    // 更新顯示名稱
    if (discordUser.username && all[id].username !== discordUser.username) {
      all[id].username = discordUser.username;
      all[id].lastActiveAt = Date.now();
      saveAll(all);
    }
    return accountSummary(id);
  }

  const charId = `char_web_${Date.now().toString(36)}`;
  const username = discordUser.username || "冒險者";
  all[id] = {
    username,
    activeCharId: charId,
    characters: {
      [charId]: {
        name: username,
        class: "beginner",
        level: 1,
        jobCode: 0,
        levelStats: { str: 0, dex: 0, int: 0, luk: 0 },
        totalExp: 0,
        createdAt: Date.now(),
        source: "artale-web-oauth",
      },
    },
    items: [],
    mapleLeaves: 120,
    equipped: {},
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    __fromArtaleWeb: true,
  };
  saveAll(all);
  return accountSummary(id);
}

export function getCharacterDetail(discordId, charId) {
  const p = getAccount(discordId);
  if (!p) return null;
  const c = p.characters?.[charId];
  if (!c) return null;
  return {
    discordId: String(discordId),
    username: p.username,
    charId,
    name: c.name || p.username,
    class: c.class || "beginner",
    level: c.level || 1,
    jobCode: c.jobCode || 0,
    levelStats: c.levelStats || {},
    skills: c.skills || {},
    sp: c.sp,
    equipped: normalizeEquipped(c.equipped || p.equipped || {}),
    starSlots: c.starSlots || {},
    potentialSlots: c.potentialSlots || {},
    inventoryPreview: (p.items || [])
      .filter((it) => it && (!it._charId || it._charId === charId))
      .slice(0, 80)
      .map(summarizeItem)
      .filter(Boolean),
  };
}
