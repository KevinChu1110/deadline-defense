/**
 * 多存檔（本機 3 槽）
 * 切換時把槽位資料寫回各系統使用的 global key，避免改動全專案讀寫。
 */

export const SLOT_COUNT = 3;
const META_KEY = "deadline-defense-saves-v1";
const ACTIVE_KEY = "deadline-defense-active-slot";

/** 會隨存檔槽一起保存的 key（靜音等設定不進槽） */
export const SLOT_DATA_KEYS = [
  "deadline-defense-progress-v1",
  "deadline-defense-cards-v1",
  "deadline-defense-job-unlock-v1",
  "deadline-defense-stars-v1",
  "deadline-defense-nickname",
];

function emptySlotMeta(index) {
  return {
    index,
    name: "",
    empty: true,
    unlocked: 1,
    clearedCount: 0,
    leaves: 0,
    starsTotal: 0,
    updatedAt: 0,
  };
}

function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) {
      return {
        slots: Array.from({ length: SLOT_COUNT }, (_, i) => emptySlotMeta(i)),
        migrated: false,
      };
    }
    const data = JSON.parse(raw);
    const slots = Array.from({ length: SLOT_COUNT }, (_, i) => {
      const s = data.slots?.[i];
      return s ? { ...emptySlotMeta(i), ...s, index: i } : emptySlotMeta(i);
    });
    return { slots, migrated: !!data.migrated };
  } catch {
    return {
      slots: Array.from({ length: SLOT_COUNT }, (_, i) => emptySlotMeta(i)),
      migrated: false,
    };
  }
}

function saveMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

function slotBlobKey(index) {
  return `deadline-defense-slot-blob-${index}`;
}

function readBlob(index) {
  try {
    const raw = localStorage.getItem(slotBlobKey(index));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeBlob(index, blob) {
  try {
    localStorage.setItem(slotBlobKey(index), JSON.stringify(blob));
  } catch {
    /* ignore */
  }
}

function snapshotLiveKeys() {
  const data = {};
  for (const k of SLOT_DATA_KEYS) {
    data[k] = localStorage.getItem(k);
  }
  return data;
}

function applyBlobToLive(blob) {
  for (const k of SLOT_DATA_KEYS) {
    if (blob && blob[k] != null && blob[k] !== "") {
      localStorage.setItem(k, blob[k]);
    } else {
      localStorage.removeItem(k);
    }
  }
}

function summarizeLive() {
  let unlocked = 1;
  let clearedCount = 0;
  let leaves = 0;
  let starsTotal = 0;
  let name = "";
  try {
    const prog = JSON.parse(localStorage.getItem("deadline-defense-progress-v1") || "{}");
    unlocked = Math.max(1, Number(prog.unlocked) || 1);
    clearedCount = Object.keys(prog.cleared || {}).length;
  } catch {
    /* ignore */
  }
  try {
    const cards = JSON.parse(localStorage.getItem("deadline-defense-cards-v1") || "{}");
    leaves = Math.max(0, Number(cards.leaves) || 0);
  } catch {
    /* ignore */
  }
  try {
    const stars = JSON.parse(localStorage.getItem("deadline-defense-stars-v1") || "{}");
    starsTotal = Object.values(stars).reduce((s, n) => s + (Number(n) || 0), 0);
  } catch {
    /* ignore */
  }
  try {
    name = localStorage.getItem("deadline-defense-nickname") || "";
  } catch {
    /* ignore */
  }
  return { unlocked, clearedCount, leaves, starsTotal, name };
}

/**
 * 首次：把目前 global 進度遷入槽 0
 */
export function ensureSaveSlotsMigrated() {
  const meta = loadMeta();
  if (meta.migrated) {
    // 確保 active 有值
    if (getActiveSlotIndex() < 0) setActiveSlotIndex(0);
    return meta;
  }
  const live = snapshotLiveKeys();
  const hasAny = SLOT_DATA_KEYS.some((k) => live[k] != null);
  if (hasAny) {
    writeBlob(0, live);
    const sum = summarizeLive();
    meta.slots[0] = {
      ...emptySlotMeta(0),
      empty: false,
      name: sum.name || "冒險者 1",
      unlocked: sum.unlocked,
      clearedCount: sum.clearedCount,
      leaves: sum.leaves,
      starsTotal: sum.starsTotal,
      updatedAt: Date.now(),
    };
  }
  meta.migrated = true;
  saveMeta(meta);
  setActiveSlotIndex(0);
  return meta;
}

export function getActiveSlotIndex() {
  try {
    const n = Number(localStorage.getItem(ACTIVE_KEY));
    if (Number.isFinite(n) && n >= 0 && n < SLOT_COUNT) return n;
  } catch {
    /* ignore */
  }
  return 0;
}

export function setActiveSlotIndex(index) {
  const i = Math.max(0, Math.min(SLOT_COUNT - 1, Number(index) || 0));
  try {
    localStorage.setItem(ACTIVE_KEY, String(i));
  } catch {
    /* ignore */
  }
  return i;
}

export function listSaveSlots() {
  ensureSaveSlotsMigrated();
  // 刷新目前 active 槽摘要
  flushActiveSlot();
  return loadMeta().slots;
}

/**
 * 把目前 live 資料寫回 active 槽
 */
export function flushActiveSlot() {
  ensureSaveSlotsMigrated();
  const i = getActiveSlotIndex();
  const blob = snapshotLiveKeys();
  const sum = summarizeLive();
  const empty =
    sum.clearedCount === 0 &&
    sum.unlocked <= 1 &&
    sum.leaves <= 120 &&
    !sum.name;
  writeBlob(i, blob);
  const meta = loadMeta();
  meta.slots[i] = {
    index: i,
    empty: empty && !sum.name,
    name: sum.name || `存檔 ${i + 1}`,
    unlocked: sum.unlocked,
    clearedCount: sum.clearedCount,
    leaves: sum.leaves,
    starsTotal: sum.starsTotal,
    updatedAt: Date.now(),
  };
  // 有暱稱就不算 empty
  if (sum.name || sum.clearedCount > 0 || sum.unlocked > 1) {
    meta.slots[i].empty = false;
  }
  saveMeta(meta);
  return meta.slots[i];
}

/**
 * 切換存檔：先存目前，再載入目標
 *
 * @param {number} index
 * @param {{ saveCurrent?: boolean }} [opts]
 *   saveCurrent=false 時跳過「把 live keys 回存目前槽」那一步。
 *   ⚠️ 匯入 Discord 進度時一定要關掉：匯入是直接把 blob 寫進各槽，
 *   此時 live keys 還是匯入前的舊狀態，照常回存會把剛寫好的槽蓋掉
 *   （實際事故：同步 3 個角色後，存檔 1 被舊的空狀態洗掉變「空存檔」）。
 */
export function switchToSlot(index, opts = {}) {
  ensureSaveSlotsMigrated();
  const i = Math.max(0, Math.min(SLOT_COUNT - 1, Number(index) || 0));
  if (opts.saveCurrent !== false) flushActiveSlot();
  const blob = readBlob(i);
  if (blob) {
    applyBlobToLive(blob);
  } else {
    // 空槽：清掉 live 進度（新遊戲）
    for (const k of SLOT_DATA_KEYS) localStorage.removeItem(k);
  }
  setActiveSlotIndex(i);
  flushActiveSlot();
  return listSaveSlots()[i];
}

/**
 * 建立／覆寫空槽名稱並設為 active
 */
export function createOrOpenSlot(index, name) {
  const i = Math.max(0, Math.min(SLOT_COUNT - 1, Number(index) || 0));
  flushActiveSlot();
  const blob = readBlob(i);
  if (!blob) {
    for (const k of SLOT_DATA_KEYS) localStorage.removeItem(k);
    const n = String(name || `冒險者 ${i + 1}`).trim().slice(0, 12);
    try {
      localStorage.setItem("deadline-defense-nickname", n);
    } catch {
      /* ignore */
    }
  } else {
    applyBlobToLive(blob);
    if (name) {
      try {
        localStorage.setItem(
          "deadline-defense-nickname",
          String(name).trim().slice(0, 12)
        );
      } catch {
        /* ignore */
      }
    }
  }
  setActiveSlotIndex(i);
  return flushActiveSlot();
}

/**
 * 刪除槽位
 */
export function deleteSlot(index) {
  const i = Math.max(0, Math.min(SLOT_COUNT - 1, Number(index) || 0));
  try {
    localStorage.removeItem(slotBlobKey(i));
  } catch {
    /* ignore */
  }
  const meta = loadMeta();
  meta.slots[i] = emptySlotMeta(i);
  saveMeta(meta);
  if (getActiveSlotIndex() === i) {
    for (const k of SLOT_DATA_KEYS) localStorage.removeItem(k);
    flushActiveSlot();
  }
  return listSaveSlots();
}

export function formatSlotTime(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    const h = `${d.getHours()}`.padStart(2, "0");
    const min = `${d.getMinutes()}`.padStart(2, "0");
    return `${m}/${day} ${h}:${min}`;
  } catch {
    return "—";
  }
}
