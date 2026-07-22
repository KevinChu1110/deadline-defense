/**
 * Discord Bot ↔ 楓之谷防衛戰 進度橋接
 *
 * 同步策略（MVP，無後端）：
 * 1. Bot 用 /防衛戰匯出 或 CLI 產出 bridge JSON / 短碼
 * 2. 網頁貼上匯入 → 最多 3 個 Discord 角色寫入 3 個存檔槽
 * 3. 之後可雙向匯出；真正雲端同步再換成 API
 *
 * schema v1 — 兩邊都認這份結構
 */

import { SPECIALISTS, SPECIALIST_ORDER } from "./specialists.js";
import {
  SLOT_COUNT,
  SLOT_DATA_KEYS,
  listSaveSlots,
  switchToSlot,
  flushActiveSlot,
  getActiveSlotIndex,
} from "./save-slots.js";

export const BRIDGE_VERSION = 1;
export const BRIDGE_PREFIX = "MDEF1."; // 短碼前綴

/** Bot class id → 防衛戰 job id（幾乎同名；例外對照） */
const CLASS_ALIASES = {
  // bot 可能用的別名
  gunslinger_adv: "gunslinger",
  pirate: "gunslinger",
  warrior: "fighter",
  bowman: "hunter",
  thief: "assassin",
  magician: "wizard_fp",
  archer: "hunter",
  rogue: "assassin",
  // 英雄團 / 皇家已同 id
};

/**
 * @typedef {object} BridgeCharacter
 * @property {string} charId
 * @property {string} name
 * @property {string} class
 * @property {number} level
 * @property {number} [jobCode]
 * @property {object} [levelStats]
 * @property {number} [totalExp]
 */

/**
 * @typedef {object} BridgePayload
 * @property {number} v
 * @property {string} source
 * @property {number} exportedAt
 * @property {string} [discordId]
 * @property {string} [username]
 * @property {{ mapleLeaves?: number }} [account]
 * @property {BridgeCharacter[]} characters
 * @property {string} [activeCharId]
 */

export function resolveWebJobId(botClass) {
  if (!botClass) return "beginner";
  const key = String(botClass).toLowerCase().trim();
  if (SPECIALISTS[key]) return key;
  const alias = CLASS_ALIASES[key];
  if (alias && SPECIALISTS[alias]) return alias;
  return "beginner";
}

/** Discord 等級 → 卡片星等 1–5 */
export function levelToCardStars(level) {
  const lv = Math.max(1, Number(level) || 1);
  if (lv >= 160) return 5;
  if (lv >= 120) return 4;
  if (lv >= 70) return 3;
  if (lv >= 30) return 2;
  return 1;
}

/** 等級粗估關卡解鎖（1–10） */
export function levelToUnlockedStages(level) {
  const lv = Math.max(1, Number(level) || 1);
  return Math.max(1, Math.min(10, 1 + Math.floor(lv / 20)));
}

/**
 * 存檔要顯示的角色名。
 *
 * ⚠️ Bot 的角色物件多半**沒有 `name` 欄位**（只有 class/level/jobCode），
 * server 的 accountSummary 會 fallback 成帳號名 —— 結果三個存檔全叫同一個
 * Discord 暱稱，完全分不出誰是誰。這裡改用職業中文名當名字。
 */
export function charDisplayName(char, username = "冒險者") {
  const jobId = resolveWebJobId(char?.class);
  const jobName = SPECIALISTS[jobId]?.nameZh || jobId;
  const raw = String(char?.name || "").trim();
  // name 缺漏、或只是被填成帳號名 → 用職業名才分得出三個槽
  if (!raw || raw === String(username || "").trim()) return jobName;
  return raw;
}

/**
 * 從 Bot 角色 + 帳號 → 網頁單一存檔 live keys 物件
 * @returns {Record<string,string>} localStorage key → JSON string
 */
export function characterToSlotBlob(char, account = {}, username = "冒險者") {
  const jobId = resolveWebJobId(char.class);
  const stars = levelToCardStars(char.level);
  const unlocked = levelToUnlockedStages(char.level);
  const leavesBase = Math.max(0, Number(account.mapleLeaves) || 0);
  // 等級也折一點楓葉，避免 0 葉
  const leaves = Math.max(120, leavesBase + Math.floor((Number(char.level) || 1) * 3));

  const levels = {};
  for (const id of SPECIALIST_ORDER) levels[id] = 1;
  levels[jobId] = stars;
  levels.beginner = Math.max(levels.beginner || 1, Math.min(3, stars));

  // 學會：該職 + 初心者；若是高轉也標記相近線（簡化：只 mark 自己）
  const learned = { beginner: true, [jobId]: true };

  // ⚠️ 存檔列表顯示的名字最後是由 summarizeLive() 從這個暱稱重算的
  //    （switchToSlot 會再 flush 一次覆蓋 meta），所以等級要寫進暱稱才看得到。
  //    角色本身有名字時就尊重它，不硬加等級。
  const base = charDisplayName(char, username);
  const hasRealName = base === String(char.name || "").trim() && base !== "";
  const lv = Number(char.level) || 1;
  const nick = (hasRealName ? base : `${base} Lv${lv}`).slice(0, 12);

  const progress = {
    unlocked,
    cleared: {},
  };
  // 標記已解鎖關卡前幾關為可挑戰（cleared 留空，保留遊玩動機）
  // 若等級高，略過前期 cleared 讓玩家可跳關感：解鎖數已夠

  const cards = {
    leaves,
    levels,
    totalEarned: leaves,
    discord: {
      charId: char.charId || null,
      class: char.class || jobId,
      level: Number(char.level) || 1,
      linkedAt: Date.now(),
    },
  };

  const jobUnlock = { learned };
  const starsData = {};
  const blob = {
    "deadline-defense-progress-v1": JSON.stringify(progress),
    "deadline-defense-cards-v1": JSON.stringify(cards),
    "deadline-defense-job-unlock-v1": JSON.stringify(jobUnlock),
    "deadline-defense-stars-v1": JSON.stringify(starsData),
    "deadline-defense-nickname": nick,
  };
  // 確保 key 齊全
  for (const k of SLOT_DATA_KEYS) {
    if (blob[k] == null) blob[k] = null;
  }
  return blob;
}

/**
 * 驗證並正規化 payload
 * @returns {{ ok: true, data: BridgePayload } | { ok: false, error: string }}
 */
export function parseBridgePayload(raw) {
  if (raw == null || raw === "") {
    return { ok: false, error: "請貼上 Discord 匯出的進度碼或 JSON" };
  }
  let text = String(raw).trim();
  // 短碼
  if (text.startsWith(BRIDGE_PREFIX)) {
    try {
      const b64 = text.slice(BRIDGE_PREFIX.length).replace(/-/g, "+").replace(/_/g, "/");
      const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
      text = decodeURIComponent(escape(atob(b64 + pad)));
    } catch {
      return { ok: false, error: "進度碼解碼失敗，請重新在 Discord 匯出" };
    }
  }
  // 允許包在 ```json ``` 裡
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "不是有效的 JSON，請確認完整複製" };
  }

  if (!data || typeof data !== "object") {
    return { ok: false, error: "資料格式錯誤" };
  }
  if (Number(data.v) !== BRIDGE_VERSION && data.v != null && Number(data.v) > BRIDGE_VERSION) {
    return { ok: false, error: `版本過新（v${data.v}），請更新網頁遊戲` };
  }

  const characters = Array.isArray(data.characters) ? data.characters : [];
  if (!characters.length) {
    return { ok: false, error: "這份匯出沒有角色（characters 為空）" };
  }

  /** @type {BridgePayload} */
  const normalized = {
    v: BRIDGE_VERSION,
    source: data.source || "discord-bot",
    exportedAt: Number(data.exportedAt) || Date.now(),
    discordId: data.discordId ? String(data.discordId) : undefined,
    username: data.username || "冒險者",
    account: {
      mapleLeaves: Math.max(0, Number(data.account?.mapleLeaves) || 0),
    },
    characters: characters.slice(0, SLOT_COUNT).map((c, i) => ({
      charId: String(c.charId || c.id || `char_${i}`),
      name: String(c.name || data.username || `角色${i + 1}`).slice(0, 12),
      class: String(c.class || "beginner"),
      level: Math.max(1, Number(c.level) || 1),
      jobCode: Number(c.jobCode) || 0,
      levelStats: c.levelStats || {},
      totalExp: Number(c.totalExp) || 0,
    })),
    activeCharId: data.activeCharId || characters[0]?.charId,
  };

  return { ok: true, data: normalized };
}

/**
 * 編碼為短碼（適合 Discord 訊息）
 */
export function encodeBridgeCode(payload) {
  const json = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return BRIDGE_PREFIX + b64;
}

/**
 * 把 bridge 角色寫入存檔槽 0..n-1（覆寫）
 * @param {BridgePayload} payload
 * @param {{ slotMap?: number[] }} opts slotMap[i] = 要寫入的槽 index；預設依序 0,1,2
 * @returns {{ written: { slot: number, name: string, class: string, level: number, jobId: string }[] }}
 */
export function importBridgeToSlots(payload, opts = {}) {
  const chars = (payload.characters || []).slice(0, SLOT_COUNT);
  if (!chars.length) throw new Error("沒有可匯入的角色");

  flushActiveSlot();
  const written = [];
  const slotMap = opts.slotMap || chars.map((_, i) => i);

  chars.forEach((ch, i) => {
    const slotIndex = Math.max(0, Math.min(SLOT_COUNT - 1, slotMap[i] ?? i));
    const blob = characterToSlotBlob(ch, payload.account, payload.username);
    // 直接寫 blob
    try {
      localStorage.setItem(`deadline-defense-slot-blob-${slotIndex}`, JSON.stringify(blob));
    } catch (e) {
      throw new Error("寫入存檔失敗（本機空間不足？）");
    }
    // 更新 meta 摘要
    try {
      const metaRaw = localStorage.getItem("deadline-defense-saves-v1");
      const meta = metaRaw ? JSON.parse(metaRaw) : { slots: [], migrated: true };
      if (!Array.isArray(meta.slots)) meta.slots = [];
      while (meta.slots.length < SLOT_COUNT) {
        meta.slots.push({ index: meta.slots.length, empty: true });
      }
      const jobId = resolveWebJobId(ch.class);
      meta.slots[slotIndex] = {
        index: slotIndex,
        empty: false,
        // 帶上等級，三個槽才一眼分得出主力是哪個
        name: `${charDisplayName(ch, payload.username)} Lv${Number(ch.level) || 1}`,
        unlocked: levelToUnlockedStages(ch.level),
        clearedCount: 0,
        leaves: Math.max(120, Number(payload.account?.mapleLeaves) || 0),
        starsTotal: levelToCardStars(ch.level),
        updatedAt: Date.now(),
        discordCharId: ch.charId,
        discordClass: ch.class,
        discordLevel: ch.level,
        webJobId: jobId,
      };
      meta.migrated = true;
      meta.discordLink = {
        discordId: payload.discordId || null,
        username: payload.username || null,
        linkedAt: Date.now(),
        source: payload.source || "discord-bot",
      };
      localStorage.setItem("deadline-defense-saves-v1", JSON.stringify(meta));
    } catch {
      /* ignore meta */
    }

    written.push({
      slot: slotIndex,
      name: ch.name,
      class: ch.class,
      level: ch.level,
      jobId: resolveWebJobId(ch.class),
    });
  });

  // 切到 active 對應槽，或第 0 槽
  let prefer = 0;
  if (payload.activeCharId) {
    const idx = chars.findIndex((c) => c.charId === payload.activeCharId);
    if (idx >= 0) prefer = idx;
  }
  // ⚠️ saveCurrent:false 不可省略。live keys 這時還是匯入前的舊狀態，
  //    照 switchToSlot 預設會先回存到目前 active 槽，把剛剛寫好的 blob 蓋掉
  //    （實際事故：同步 3 個角色後存檔 1 變回「空存檔」，等級最高的主角色不見）。
  switchToSlot(written[prefer]?.slot ?? 0, { saveCurrent: false });
  return { written };
}

/**
 * 從目前 3 槽匯出（給 Bot 反向同步用，v1 簡化）
 */
export function exportSlotsAsBridge() {
  flushActiveSlot();
  const slots = listSaveSlots();
  const characters = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const s = slots[i];
    if (!s || s.empty) continue;
    let job = "beginner";
    let level = 1;
    let leaves = 0;
    try {
      const raw = localStorage.getItem(`deadline-defense-slot-blob-${i}`);
      const blob = raw ? JSON.parse(raw) : null;
      if (blob?.["deadline-defense-cards-v1"]) {
        const cards = JSON.parse(blob["deadline-defense-cards-v1"]);
        leaves = cards.leaves || 0;
        if (cards.discord?.class) job = cards.discord.class;
        if (cards.discord?.level) level = cards.discord.level;
        // 找最高星職業
        if (cards.levels) {
          let best = "beginner";
          let bestLv = 0;
          for (const [id, lv] of Object.entries(cards.levels)) {
            if (Number(lv) > bestLv && SPECIALISTS[id]) {
              bestLv = Number(lv);
              best = id;
            }
          }
          if (!cards.discord?.class) job = best;
        }
      }
    } catch {
      /* ignore */
    }
    characters.push({
      charId: s.discordCharId || `web_slot_${i}`,
      name: s.name || `存檔${i + 1}`,
      class: job,
      level,
      jobCode: 0,
      levelStats: {},
      totalExp: 0,
      webSlot: i,
      leaves,
    });
  }
  /** @type {BridgePayload} */
  const payload = {
    v: BRIDGE_VERSION,
    source: "maple-defense-web",
    exportedAt: Date.now(),
    username: characters[0]?.name || "冒險者",
    account: {
      mapleLeaves: characters.reduce((a, c) => Math.max(a, c.leaves || 0), 0),
    },
    characters: characters.map(({ leaves, webSlot, ...c }) => c),
    activeCharId: characters[getActiveSlotIndex()]?.charId,
  };
  return payload;
}

/**
 * `/api/me`（server accountSummary）→ bridge payload
 *
 * 貼短碼那條路是「沒登入時的備援」。已經 Discord 登入的話，API 是直接讀 Bot 的
 * player-data.json，資料本來就是即時的 —— 不需要玩家去 Discord 打指令再複製貼上。
 *
 * accountSummary 已經照等級由高到低排好，這裡只把 active 角色提到最前面
 * （對應存檔 1），再取前 3 個。欄位名稱兩邊一致，不用改名。
 */
export function payloadFromAccountSummary(me) {
  if (!me || typeof me !== "object") {
    throw new Error("讀不到帳號資料");
  }
  let chars = (me.characters || []).filter(Boolean);
  if (!chars.length) throw new Error("這個 Discord 帳號還沒有角色");

  const activeId = me.activeCharId;
  if (activeId && chars.some((c) => c.charId === activeId)) {
    chars = [
      chars.find((c) => c.charId === activeId),
      ...chars.filter((c) => c.charId !== activeId),
    ];
  }
  chars = chars.slice(0, SLOT_COUNT);

  return {
    v: BRIDGE_VERSION,
    source: "live-api",
    exportedAt: Date.now(),
    discordId: String(me.discordId || ""),
    username: me.username || "冒險者",
    account: { mapleLeaves: Math.max(0, Number(me.mapleLeaves) || 0) },
    characters: chars.map((c) => ({
      charId: c.charId,
      name: c.name,
      class: c.class,
      level: Math.max(1, Number(c.level) || 1),
      jobCode: Number(c.jobCode) || 0,
      levelStats: c.levelStats || {},
      totalExp: Number(c.totalExp) || 0,
    })),
    activeCharId: activeId || chars[0]?.charId,
  };
}

export function previewImport(payload) {
  return (payload.characters || []).slice(0, SLOT_COUNT).map((ch, i) => ({
    slot: i + 1,
    name: charDisplayName(ch, payload.username),
    class: ch.class,
    webJob: resolveWebJobId(ch.class),
    webJobName: SPECIALISTS[resolveWebJobId(ch.class)]?.nameZh || resolveWebJobId(ch.class),
    level: ch.level,
    cardStars: levelToCardStars(ch.level),
    unlockedStages: levelToUnlockedStages(ch.level),
  }));
}
