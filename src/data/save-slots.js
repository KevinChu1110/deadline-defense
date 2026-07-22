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

/**
 * 讀存檔 blob。
 * ⚠️ 一定要區分「空槽」與「資料毀損」：原本兩者都回 null，於是只要 blob 有任何
 * 損壞（例如上次寫入時容量不足寫了半截），玩家點一次「讀取」就會走「空槽 → 清空
 * live → flush 回該槽」的路徑，把還可能救得回來的原始字串永久蓋掉。
 * @returns {{ ok: true, blob: object|null } | { ok: false, raw: string }}
 */
function readBlobSafe(index) {
  let raw = null;
  try {
    raw = localStorage.getItem(slotBlobKey(index));
  } catch {
    return { ok: true, blob: null };
  }
  if (!raw) return { ok: true, blob: null };
  try {
    return { ok: true, blob: JSON.parse(raw) };
  } catch {
    return { ok: false, raw };
  }
}

function readBlob(index) {
  const r = readBlobSafe(index);
  return r.ok ? r.blob : null;
}

/**
 * 寫存檔 blob。
 * ⚠️ 回傳成功與否：原本靜默吞掉例外，但呼叫端照樣更新 meta —— 容量滿時列表會顯示
 * 「剛剛更新、通關 N 關」，實際 blob 還停在幾小時前，下次切槽進度就這樣不見了。
 */
function writeBlob(index, blob) {
  try {
    localStorage.setItem(slotBlobKey(index), JSON.stringify(blob));
    return true;
  } catch (e) {
    console.error("[save-slots] 寫入存檔失敗（容量不足？）", e);
    return false;
  }
}

function snapshotLiveKeys() {
  const data = {};
  for (const k of SLOT_DATA_KEYS) {
    // ⚠️ 這支原本沒有 try/catch，而它會被模組頂層的 flushActiveSlot() 呼叫 ——
    //    Safari 私密模式等 localStorage 完全不可用的環境會直接白畫面、遊戲開不起來。
    try {
      data[k] = localStorage.getItem(k);
    } catch {
      data[k] = null;
    }
  }
  return data;
}

/** @returns {boolean} 是否整組套用成功（失敗時呼叫端不可再 flush，否則會污染原槽） */
function applyBlobToLive(blob) {
  for (const k of SLOT_DATA_KEYS) {
    try {
      if (blob && blob[k] != null && blob[k] !== "") {
        localStorage.setItem(k, blob[k]);
      } else {
        localStorage.removeItem(k);
      }
    } catch (e) {
      console.error("[save-slots] 套用存檔失敗", e);
      return false;
    }
  }
  return true;
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
  // ⚠️ 原本還加了 `sum.leaves <= 120`（START_LEAVES 就是 120）——
  //    玩家把楓葉花光升卡、還沒過第一關、又沒設暱稱時會被誤判成「空存檔」，
  //    列表顯示「點開新局開始冒險」，等於誘導他覆寫自己的存檔。
  const empty = sum.clearedCount === 0 && sum.unlocked <= 1 && !sum.name;
  // ⚠️ 寫入失敗（容量滿）時絕不能更新 meta：那會讓列表顯示「剛剛更新」但 blob 還是
  //    幾小時前的，玩家下次切槽進度就無聲消失。
  if (!writeBlob(i, blob)) return loadMeta().slots[i];
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

  const r = readBlobSafe(i);
  if (!r.ok) {
    // 資料毀損：先把原始字串留一份備份，然後中止 —— 絕不能往下走成「當空槽處理
    // → 清空 live → flush 回該槽」，那會把可能還救得回來的東西永久蓋掉。
    try {
      localStorage.setItem(`${slotBlobKey(i)}-corrupt-${Date.now()}`, r.raw);
    } catch {
      /* ignore */
    }
    throw new Error(`存檔 ${i + 1} 的資料已毀損，已保留備份，請改用其他存檔`);
  }

  if (r.blob) {
    if (!applyBlobToLive(r.blob)) {
      // 套用到一半失敗：live 現在是半套資料，此時 flush 會污染「原本的」槽
      throw new Error("讀取存檔失敗（本機空間不足？），請釋放空間後再試");
    }
  } else {
    // 空槽：清掉 live 進度（新遊戲）
    for (const k of SLOT_DATA_KEYS) {
      try { localStorage.removeItem(k); } catch { /* ignore */ }
    }
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
    // ⚠️ 刪掉「使用中」的槽之後，active 一定要移走。原本只清 live 再 flush，
    //    active 仍指向 i：玩家接著開始遊戲，進度會全部累積回這個「已刪除」的槽，
    //    而 flush 一旦讓 unlocked>1 又把它標回非空，看起來像「刪不掉」。
    for (const k of SLOT_DATA_KEYS) {
      try { localStorage.removeItem(k); } catch { /* ignore */ }
    }
    const m2 = loadMeta();
    const next = m2.slots.findIndex((sl, idx) => idx !== i && sl && !sl.empty);
    if (next >= 0) {
      switchToSlot(next, { saveCurrent: false });
    } else {
      setActiveSlotIndex(0);
      flushActiveSlot();
    }
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
