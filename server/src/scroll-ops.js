/**
 * 衝卷 API — 對齊 bot scroll-system + prd.applyScrollByKind
 * 寫入一律走 bot web-ops；本檔提供 view 組裝與 bot 端 apply 共用邏輯。
 */
import { getItemSlot, SLOTS } from "./equip.js";
import { scrollSys, currency } from "./bot-bridge.js";

function findItem(pp, itemId) {
  return (pp.items || []).find((x) => x && x.itemId === itemId && !x.destroyed);
}

/** 與 prd.getMaxSlots 對齊的精簡版（優先 item.maxSlots） */
export function getMaxSlots(item) {
  if (!item) return 0;
  if (item.type === "scroll" || item.type === "trophy" || item.type === "ring_box"
    || item.type === "bullet" || item.type === "pet" || item.type === "title") return 0;
  if (item.maxSlots != null) return Number(item.maxSlots) || 0;
  if (item.type === "weapon") return 7;
  if (item.type === "accessory") return 5;
  if (item.type === "maple_shield") return 7;
  if (item.type === "warrior_shield") return 10;
  if (item.type === "maple_shoes" || item.type === "pet_gear") return item.type === "maple_shoes" ? 5 : 7;
  if (item.type === "armor") return 10;
  return 7;
}

function summarizeGear(it, { equipped = false, slot = null } = {}) {
  if (!it) return null;
  const slotKey = slot || getItemSlot(it);
  const maxSlots = getMaxSlots(it);
  const used = it.slotsUsed || 0;
  return {
    itemId: it.itemId,
    name: it.name || "？",
    type: it.type,
    category: it.category || null,
    level: it.level || 0,
    slot: slotKey,
    equipped,
    totalAd: (it.baseAd || 0) + (it.scrolledAd || 0) || null,
    totalAp: (it.baseAp || 0) + (it.scrolledAp || 0) || null,
    scrolledAd: it.scrolledAd || 0,
    scrolledAp: it.scrolledAp || 0,
    scrollSuccess: it.scrollSuccess || 0,
    slotsUsed: used,
    maxSlots,
    slotsLeft: Math.max(0, maxSlots - used),
    destroyed: !!it.destroyed,
  };
}

function listScrollableGear(pp) {
  const wornIds = new Set();
  for (const v of Object.values(pp.equipped || {})) {
    if (Array.isArray(v)) v.forEach((id) => id && wornIds.add(id));
    else if (v) wornIds.add(v);
  }
  const out = [];
  for (const it of pp.items || []) {
    if (!it || it.destroyed) continue;
    const slot = getItemSlot(it);
    if (!slot) continue;
    if (!scrollSys.isEquipCovered(it, slot)) continue;
    const maxSlots = getMaxSlots(it);
    if (maxSlots <= 0) continue;
    out.push(summarizeGear(it, { equipped: wornIds.has(it.itemId), slot }));
  }
  // 有剩餘欄位優先、已穿在前
  out.sort((a, b) => {
    if (a.equipped !== b.equipped) return a.equipped ? -1 : 1;
    if ((b.slotsLeft > 0) !== (a.slotsLeft > 0)) return b.slotsLeft > 0 ? 1 : -1;
    return (b.level || 0) - (a.level || 0);
  });
  return out;
}

function listOwnedScrolls(pp) {
  const counts = {};
  for (const it of pp.items || []) {
    if (!it || it.type !== "scroll") continue;
    // v2Kind 在 bot 端透過 owned 邏輯；這裡用 scrollKind + scrollSys
    const kind = it.scrollSys === "v2" ? it.scrollKind : it.scrollKind;
    if (!kind) continue;
    const def = scrollSys.getScrollDef(kind) || null;
    // legacy alias：若 getScrollDef 找不到，仍顯示原始名
    const key = def ? kind : `raw:${kind}`;
    if (!counts[key]) {
      counts[key] = {
        kind: def ? kind : kind,
        name: def?.name || it.name || kind,
        count: 0,
        rate: def?.rate ?? null,
        ratePct: def ? scrollSys.ratePct(def) : null,
        statsLabel: def ? scrollSys.statLabel(def) : "",
        boom: !!(def && def.boom),
        equip: def?.equip || null,
        slot: def?.slot || null,
        cats: def?.cats || null,
      };
    }
    counts[key].count += it.count || 1;
  }
  return Object.values(counts).sort((a, b) => (b.count || 0) - (a.count || 0) || String(a.name).localeCompare(String(b.name), "zh"));
}

/**
 * 衝卷工作台視圖
 */
export function getScrollView(pp) {
  if (!pp) return null;
  const gear = listScrollableGear(pp);
  const scrolls = listOwnedScrolls(pp);
  const active = pp.characters?.[pp.activeCharId];
  return {
    coins: currency.getCoins ? currency.getCoins(pp) : (pp.fish?.coins || 0),
    charName: active?.name || pp.username || "冒險者",
    charLevel: active?.level || 1,
    gear,
    scrolls,
    note: "把卷軸拖到裝備上（或先點裝備再點卷軸）· 失敗不回卷 · 詛咒卷失敗可能爆裝",
  };
}

/**
 * 對某件裝備套用一張卷軸（就地改 pp；呼叫端負責存檔）
 * @returns {{ ok, boom, changes, item, def, remain, slotsUsed, maxSlots, flash }}
 */
export function applyScrollToItem(pp, itemId, kind) {
  if (!pp) throw new Error("無帳號");
  const it = findItem(pp, itemId);
  if (!it) throw new Error("裝備不存在或已損壞");
  if (it.destroyed) throw new Error("裝備已損壞");
  const def = scrollSys.getScrollDef(kind);
  if (!def) throw new Error("卷軸資料不存在");
  const slot = getItemSlot(it);
  if (!scrollSys.scrollMatchesEquip(def, it, slot)) {
    throw new Error(`「${def.name}」不能用在這件裝備上`);
  }
  const maxSlots = getMaxSlots(it);
  if ((it.slotsUsed || 0) >= maxSlots) throw new Error("這件裝備沒有剩餘卷軸欄位了");
  if (!scrollSys.consumeScroll(pp, kind)) throw new Error(`你沒有「${def.name}」了`);
  const res = scrollSys.applyScrollEffect(it, def);
  // 簡記 history（與 bot 相容欄位）
  if (!Array.isArray(it.scrollHistory)) it.scrollHistory = [];
  it.scrollHistory.push({
    kind,
    result: res.ok ? "success" : res.boom ? "explode" : "fail",
    name: def.name,
    at: Date.now(),
  });
  if (it.scrollHistory.length > 40) it.scrollHistory = it.scrollHistory.slice(-40);
  const remain = scrollSys.countOwnedByKind(pp, kind);
  const flash = res.boom
    ? `💥 爆裝！「${it.name}」損壞（${def.name} 失敗）`
    : res.ok
      ? `✨ 成功！${(res.changes || []).join("、") || "素質提升"}`
      : `💨 失敗…欄位 −1（${def.name}）`;
  return {
    ok: !!res.ok,
    boom: !!res.boom,
    changes: res.changes || [],
    item: summarizeGear(it, { equipped: false, slot }),
    def: { kind, name: def.name, rate: def.rate },
    remain,
    slotsUsed: it.slotsUsed || 0,
    maxSlots,
    flash,
    view: getScrollView(pp),
  };
}

/**
 * 列出某件裝備可用的卷軸（給 UI 高亮）
 */
export function scrollsForItem(pp, itemId) {
  const it = findItem(pp, itemId);
  if (!it) return [];
  const slot = getItemSlot(it);
  return (scrollSys.ownedScrollsForEquip(pp, it, slot) || []).map((o) => ({
    kind: o.kind,
    name: o.def?.name || o.kind,
    count: o.count,
    ratePct: scrollSys.ratePct(o.def),
    statsLabel: scrollSys.statLabel(o.def),
    boom: !!o.def?.boom,
  }));
}

// silence unused SLOTS lint if any
void SLOTS;
