/**
 * 玩家資料存取層 — 目前直接讀寫 Bot 的 player-data.json
 * 之後可換成 Postgres，路由不用改。
 */
import fs from "fs";
import { botOp } from "./bot-ops.js";
import path from "path";
import { fileURLToPath } from "url";
import {
  getEquipmentView,
  equipItem as equipItemCore,
  unequipItem as unequipItemCore,
} from "./equip.js";
import {
  getStarforceView,
  attemptStarforce as attemptStarforceCore,
} from "./starforce.js";
import {
  getPotentialView,
  usePotentialAction as usePotentialActionCore,
  craftPotential as craftPotentialCore,
} from "./potential-ops.js";
import {
  buildCombatProfile,
  getBoss,
  listBosses,
  scaleBossForProfile,
} from "./combat-profile.js";

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
    coins: Number(p.fish?.coins || 0),
    characters: chars,
    equipped,
    inventoryCount: (p.items || []).length,
    inventoryPreview: items.slice(0, 40),
    starSlots: active?.starSlots || {},
    potentialSlots: active?.potentialSlots || {},
  };
}

export async function selectCharacter(discordId, charId) {
  await botOp(discordId, "char.select", { charId });
  return accountSummary(discordId);
}

/**
 * OAuth 首次登入：若 player-data 尚無此 ID，建立空帳號 + 初心者角色
 */
export async function ensureAccountFromDiscord(discordUser) {
  const id = String(discordUser?.id || "").trim();
  if (!id) throw new Error("缺少 Discord ID");
  const existing = getAccount(id);
  if (existing) return accountSummary(id);
  // 新帳號一樣由 bot 建立並存檔，網頁端不碰檔案
  await botOp(id, "account.ensure", {
    username: discordUser.username || discordUser.global_name || `User_${id.slice(-4)}`,
  });
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

/** 裝備視窗資料 */
export function getEquipView(discordId) {
  const p = getAccount(discordId);
  if (!p) return null;
  const view = getEquipmentView(p);
  const active = p.characters?.[p.activeCharId];
  return {
    discordId: String(discordId),
    username: p.username,
    activeCharId: p.activeCharId,
    charName: active?.name || p.username,
    charClass: active?.class || "beginner",
    charLevel: active?.level || 1,
    ...view,
  };
}

/* ⚠️ 以下四個寫入操作一律轉送給 bot 執行（見 bot-ops.js 的說明）。
   自己寫檔會被 bot 的記憶體快照在 800ms 內覆蓋，而且會連帶蓋掉其他玩家的進度。 */

export async function equipOnAccount(discordId, itemId, subIdx = 0) {
  await botOp(discordId, "equip.wear", { itemId, subIdx });
  return getEquipView(discordId);
}

export async function unequipOnAccount(discordId, slotKey, subIdx = 0) {
  await botOp(discordId, "equip.unequip", { slot: slotKey, subIdx });
  return getEquipView(discordId);
}

/* withPlayer() 已移除。
   它是「讀整檔 → 改 → 整檔寫回」的通用包裝，也是先前所有 lost update 的源頭
   （連純 GET 的潛能頁面都會整檔覆寫 1MB+）。寫入一律改走 bot-ops.js。 */

/** 星力台 */
export function getStarforceOnAccount(discordId) {
  const p = getAccount(discordId);
  if (!p) return null;
  return getStarforceView(p);
}

export async function attemptStarforceOnAccount(
  discordId,
  slotKey,
  subIdx = 0,
  useProtect = false
) {
  const out = await botOp(discordId, "starforce.attempt", {
    slot: slotKey,
    subIdx,
    safeguard: useProtect,
  });
  return out?.result;
}

/** 潛能台（ensureSlot 會初始化天生可洗部位 → 寫回存檔） */
/* 原本走 withPlayer，等於「開一次潛能頁面就整檔覆寫一次 1MB+ 的 player-data」。
   ensureSlot 的初始化改成只在記憶體發生，落盤交給 bot 那邊的實際操作。 */
export function getPotentialOnAccount(discordId) {
  const p = getAccount(discordId);
  if (!p) return null;
  return getPotentialView(p);
}

export async function usePotentialOnAccount(discordId, slotKey, subIdx, action) {
  const out = await botOp(discordId, "potential.use", {
    slot: slotKey,
    subIdx,
    action,
  });
  return out?.result;
}

export async function craftPotentialOnAccount(discordId, toKey, times = 1) {
  const out = await botOp(discordId, "potential.craft", { toKey, times });
  return out?.result;
}

/** 豐富 accountSummary 的 equipped 為解析後物品 */
export function accountSummaryWithEquip(discordId) {
  const base = accountSummary(discordId);
  if (!base) return null;
  const equip = getEquipView(discordId);
  return { ...base, equip };
}

/** 動作突襲戰鬥快照 */
export function getCombatProfile(discordId) {
  const p = getAccount(discordId);
  if (!p) return null;
  const profile = buildCombatProfile(p);
  profile.discordId = String(discordId);
  return profile;
}

export function startActionRaid(discordId, bossId = "zakum") {
  const p = getAccount(discordId);
  if (!p) throw new Error("找不到帳號");
  const profile = buildCombatProfile(p);
  profile.discordId = String(discordId);
  const bossMeta = getBoss(bossId);
  if (!bossMeta) throw new Error("未知 Boss");
  if (bossMeta.unlockLevel && profile.level < bossMeta.unlockLevel) {
    throw new Error(
      `需要角色 Lv.${bossMeta.unlockLevel}（目前 Lv.${profile.level}）`
    );
  }
  // v1：龍王改為開放可挑戰（UI 已開放）；unlock 僅提示
  const boss = scaleBossForProfile(bossMeta, profile);
  return {
    ok: true,
    raidId: `ar_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    profile,
    boss,
    controls: {
      move: "←→ / A D",
      jump: "Space / W",
      attack: "J / Z",
      skill: "K / X",
      exit: "Esc",
    },
  };
}

/** 結算（v1 只記日誌欄位，獎勵二期） */
export async function completeActionRaid(discordId, payload = {}) {
  const out = await botOp(discordId, "raid.complete", {
    win: !!payload.win,
    bossId: payload.bossId,
    level: payload.level,
  });
  return { ok: true, stats: out?.stats, rewardNote: "M3 v1 無掉落；M4 接獎勵／排行" };
}

export function getActionBossList() {
  return listBosses();
}
