/**
 * 把「會改到玩家資料」的操作轉送給 bot 執行
 *
 * ── 為什麼不自己寫檔 ──
 * bot 把 player-data.json 整份放在記憶體，開機讀一次之後再也不重讀，每次異動排程
 * 800ms 後把整份記憶體寫回檔案。我們這邊原本是「讀檔 → 改 → 整份寫回」，結果：
 *
 *   - 網頁的換裝／衝星／洗潛能會在 800ms 內被 bot 的記憶體快照洗掉（改了等於沒改）
 *   - 我們寫入的瞬間也會把 bot 這段期間的進度蓋掉 —— 而且是**全部 300+ 位玩家**的
 *
 * 所以檔案只留 bot 一個 writer，我們改送「要做什麼操作」過去。運算規則不重寫：
 * bot 端會動態 import 這個資料夾裡的 equip/starforce/potential-ops，兩邊同一套。
 *
 * 沒設 BOT_OPS_TOKEN 時 isBotOpsEnabled() 為 false，呼叫端要自己決定怎麼降級。
 */

const BOT_OPS_URL =
  process.env.BOT_OPS_URL || "http://127.0.0.1:8788/op";
const BOT_OPS_TOKEN = process.env.BOT_OPS_TOKEN || "";
const TIMEOUT_MS = Number(process.env.BOT_OPS_TIMEOUT_MS) || 4000;

export function isBotOpsEnabled() {
  return !!BOT_OPS_TOKEN;
}

/**
 * @param {string} discordId
 * @param {string} kind  equip.wear / equip.unequip / starforce.attempt / potential.use …
 * @param {object} args
 */
export async function botOp(discordId, kind, args = {}) {
  if (!BOT_OPS_TOKEN) {
    throw new Error(
      "尚未設定 BOT_OPS_TOKEN —— 為避免改動被 bot 覆蓋，網頁端的資料操作已停用"
    );
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(BOT_OPS_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-web-ops-token": BOT_OPS_TOKEN,
      },
      body: JSON.stringify({ uid: String(discordId), kind, args }),
      signal: ctrl.signal,
    });
  } catch (e) {
    // bot 沒開／重啟中 → 明確告訴玩家「現在不能操作」，而不是假裝成功
    throw new Error("Bot 目前無法連線，請稍後再試");
  } finally {
    clearTimeout(timer);
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(payload?.error || `操作失敗（${res.status}）`);
  }
  return payload?.data;
}
