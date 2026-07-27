/**
 * 轉蛋 API — 對齊 bot gacha.js
 */
import { gacha, currency } from "./bot-bridge.js";

export function getGachaView(pp) {
  if (!pp) return null;
  const coins = currency.getCoins ? currency.getCoins(pp) : (pp.fish?.coins || 0);
  const cost = gacha.COST || 3_000_000;
  const maxQty = gacha.MAX_QTY || 10;
  const hist = Array.isArray(pp.gachaHistory) ? pp.gachaHistory.slice().reverse().slice(0, 20) : [];
  const active = pp.characters?.[pp.activeCharId];
  return {
    coins,
    cost,
    maxQty,
    canPull1: coins >= cost && !!active,
    canPull10: coins >= cost * Math.min(10, maxQty) && !!active,
    charName: active?.name || pp.username || "冒險者",
    history: hist.map((h) => ({
      tier: h.t,
      name: h.n,
      at: h.at,
    })),
    note: `每抽 ${(cost / 10000).toLocaleString()} 萬楓幣 · 與 Discord /轉蛋 同一獎池`,
  };
}

/**
 * 執行轉蛋（就地改 pp）
 */
export function pullGacha(pp, n = 1) {
  if (!pp) throw new Error("無帳號");
  const qty = Math.max(1, Math.min(gacha.MAX_QTY || 10, Math.floor(Number(n)) || 1));
  const out = gacha.pull(pp, qty);
  if (!out?.ok) {
    if (out?.error === "insufficient") {
      throw new Error(`楓幣不足（需要 ${(out.need || 0).toLocaleString()}，目前 ${(out.have || 0).toLocaleString()}）`);
    }
    if (out?.error === "no_char") throw new Error("沒有可用角色");
    throw new Error(out?.error || "轉蛋失敗");
  }
  return {
    results: (out.results || []).map((r) => ({
      tierKey: r.tierKey,
      name: r.name,
      color: r.color,
    })),
    spent: out.spent,
    balance: out.balance,
    n: out.n,
    view: getGachaView(pp),
  };
}
