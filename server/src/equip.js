/**
 * 裝備穿脫 — 對齊 Bot（raid.js）槽位與 itemId 引用模型
 * equipped[slot] = itemId | itemId[] | null
 * 物品本體在 pp.items[]
 */

export const SLOTS = [
  { key: "weapon", label: "武器", emoji: "⚔", count: 1 },
  { key: "bullet", label: "副武", emoji: "🛡", count: 1 },
  { key: "helmet", label: "帽子", emoji: "🎩", count: 1 },
  { key: "face", label: "臉飾", emoji: "😀", count: 1 },
  { key: "eye", label: "眼飾", emoji: "👁", count: 1 },
  { key: "earring", label: "耳環", emoji: "💎", count: 1 },
  { key: "shoulder", label: "肩飾", emoji: "🎖", count: 1 },
  { key: "overall", label: "套服", emoji: "👘", count: 1 },
  { key: "glove", label: "手套", emoji: "🧤", count: 1 },
  { key: "cape", label: "披風", emoji: "🧣", count: 1 },
  { key: "shoes", label: "鞋子", emoji: "👟", count: 1 },
  { key: "belt", label: "腰帶", emoji: "🪢", count: 1 },
  { key: "ring", label: "戒指", emoji: "💍", count: 4 },
  { key: "necklace", label: "項鍊", emoji: "📿", count: 2 },
  { key: "pet", label: "寵物", emoji: "🐾", count: 1 },
  { key: "title", label: "稱號", emoji: "🏅", count: 1 },
  { key: "totem", label: "圖騰", emoji: "🪦", count: 1 },
];

const SLOT_META = Object.fromEntries(SLOTS.map((s) => [s.key, s]));

const OVERALL_NAMES = new Set([
  "赤色仙白宮服", "紅色宮衣", "藍色卡納裝", "強化霓虹服", "永恆霓虹服",
  "紅色公爵套裝", "白色潘尼爾套裝", "紅色麻布衣", "綢緞長袍", "羅赤裝",
  "強化海王星套裝", "永恆海王星套裝", "強化奧丁袍", "永恆奧丁袍",
]);

const GLOVE_NAMES = new Set([
  "武公手套", "女神的手環", "強化海王星手套", "強化奧丁手套", "強化迷蹤手套",
  "強化勇士手套", "強化神射手套", "強化霓虹手套",
]);

const CAPE_NAMES = new Set(["暗黑龍王披風", "混沌暗黑龍王披風", "地獄暗黑龍王披風", "海軍將軍披風"]);
const SHOE_NAMES = new Set(["粘稠稠的鞋子", "巧克力醬鞋子", "派對大頭鞋"]);

export function getItemSlot(item) {
  if (!item || item.destroyed) return null;
  if (item.equipType) return item.equipType;
  const t = item.type;
  if (t === "title") return "title";
  if (t === "bullet" || t === "maple_shield" || t === "warrior_shield") return "bullet";
  if (t === "maple_shoes") return "shoes";
  if (t === "pet") return "pet";
  if (t === "totem") return "totem";
  if (t === "weapon") return "weapon";
  if (t === "scroll" || t === "material" || t === "potion" || t === "treasure_box") return null;
  if (t === "armor" || t === "overall") {
    const cat = item.category || "";
    if (cat.includes("overall") || OVERALL_NAMES.has(item.name)) return "overall";
    if (cat.includes("glove") || GLOVE_NAMES.has(item.name)) return "glove";
    if (CAPE_NAMES.has(item.name)) return "cape";
    if (SHOE_NAMES.has(item.name)) return "shoes";
    if (item.name?.includes("披風")) return "cape";
    if (item.name?.includes("手套") || item.name?.includes("手環")) return "glove";
    if (item.name?.includes("鞋")) return "shoes";
    if (item.name?.includes("腰帶")) return "belt";
    // 預設防具當頭盔（與 Bot 炎魔頭盔一致）
    return "helmet";
  }
  if (t === "accessory") {
    const cat = item.category || "";
    if (cat.includes("earring") || item.name?.includes("耳環")) return "earring";
    if (item.name?.includes("項鍊") || item.name?.includes("項鏈")) return "necklace";
    if (item.name?.includes("腰帶")) return "belt";
    if (item.name?.includes("眼") || item.name?.includes("眼飾")) return "eye";
    if (item.name?.includes("臉") || item.name === "異界靈魂") return "face";
    if (item.name?.includes("肩") || item.name?.includes("披肩")) return "shoulder";
    if (item.name?.includes("戒指") || cat === "ring") return "ring";
    return "ring";
  }
  return null;
}

function ensureEquipped(pp) {
  if (!pp.equipped || typeof pp.equipped !== "object") pp.equipped = {};
  for (const s of SLOTS) {
    if (s.count > 1) {
      if (!Array.isArray(pp.equipped[s.key])) {
        const v = pp.equipped[s.key];
        pp.equipped[s.key] = v ? [v] : [];
      }
    } else if (pp.equipped[s.key] === undefined) {
      pp.equipped[s.key] = null;
    }
  }
  return pp.equipped;
}

function findItem(pp, itemId) {
  return (pp.items || []).find((x) => x && x.itemId === itemId && !x.destroyed);
}

function isEquippedId(eq, itemId) {
  if (!eq) return false;
  if (Array.isArray(eq)) return eq.includes(itemId);
  return eq === itemId;
}

function allEquippedIds(eqMap) {
  const ids = new Set();
  for (const v of Object.values(eqMap || {})) {
    if (Array.isArray(v)) v.forEach((id) => id && ids.add(id));
    else if (v) ids.add(v);
  }
  return ids;
}

function itemPower(it) {
  if (!it) return 0;
  const ad = (it.baseAd || 0) + (it.scrolledAd || 0);
  const ap = (it.baseAp || 0) + (it.scrolledAp || 0);
  const stats =
    (it.str || 0) +
    (it.dex || 0) +
    (it.int || 0) +
    (it.luk || 0) +
    (it.scrolledDex || 0) +
    (it.scrolledInt || 0) +
    (it.scrolledLuk || 0) +
    (it.scrolledStr || 0);
  return ad * 3 + ap * 2 + stats + (it.level || 0);
}

function summarize(it, { equipped = false, slot = null, subIdx = 0 } = {}) {
  if (!it) return null;
  return {
    itemId: it.itemId,
    name: it.name || "？",
    type: it.type,
    category: it.category || null,
    level: it.level || 0,
    slot: slot || getItemSlot(it),
    equipped,
    subIdx,
    baseAd: it.baseAd ?? null,
    scrolledAd: it.scrolledAd || 0,
    totalAd: (it.baseAd || 0) + (it.scrolledAd || 0) || null,
    str: it.str || 0,
    dex: it.dex || 0,
    int: it.int || 0,
    luk: it.luk || 0,
    scrollSuccess: it.scrollSuccess || 0,
    slotsUsed: it.slotsUsed || 0,
    power: itemPower(it),
  };
}

/**
 * 完整裝備視圖（楓之谷視窗用）
 */
export function getEquipmentView(pp) {
  if (!pp) return null;
  ensureEquipped(pp);
  const wornIds = allEquippedIds(pp.equipped);
  const slots = {};

  for (const s of SLOTS) {
    if (s.count > 1) {
      const ids = Array.isArray(pp.equipped[s.key]) ? pp.equipped[s.key] : [];
      slots[s.key] = {
        ...s,
        items: Array.from({ length: s.count }, (_, i) => {
          const id = ids[i];
          const it = id ? findItem(pp, id) : null;
          return summarize(it, { equipped: true, slot: s.key, subIdx: i });
        }),
      };
    } else {
      const id = pp.equipped[s.key];
      const it = id ? findItem(pp, id) : null;
      slots[s.key] = {
        ...s,
        item: summarize(it, { equipped: true, slot: s.key }),
      };
    }
  }

  const inventory = (pp.items || [])
    .filter((it) => it && !it.destroyed && getItemSlot(it))
    .map((it) =>
      summarize(it, {
        equipped: wornIds.has(it.itemId),
        slot: getItemSlot(it),
      })
    )
    .sort((a, b) => {
      if (a.equipped !== b.equipped) return a.equipped ? 1 : -1;
      return (b.power || 0) - (a.power || 0);
    });

  return {
    slots,
    inventory,
    slotOrder: SLOTS.map((s) => s.key),
  };
}

/**
 * 穿上
 */
export function equipItem(pp, itemId, subIdx = 0) {
  if (!pp) throw new Error("無帳號");
  ensureEquipped(pp);
  const it = findItem(pp, itemId);
  if (!it) throw new Error("背包找不到此裝備");
  const slot = getItemSlot(it);
  if (!slot) throw new Error("此物品不可裝備");
  const meta = SLOT_META[slot];
  if (!meta) throw new Error("未知槽位");

  // 已穿在任一槽 → 先卸
  for (const s of SLOTS) {
    if (s.count > 1) {
      const dense = (Array.isArray(pp.equipped[s.key]) ? pp.equipped[s.key] : [])
        .filter(Boolean)
        .filter((id) => id !== itemId);
      pp.equipped[s.key] = dense;
    } else if (pp.equipped[s.key] === itemId) {
      pp.equipped[s.key] = null;
    }
  }

  if (meta.count > 1) {
    let list = (Array.isArray(pp.equipped[slot]) ? pp.equipped[slot] : []).filter(
      Boolean
    );
    // 項鍊同名限一
    if (slot === "necklace") {
      list = list.filter((id) => {
        const o = findItem(pp, id);
        return o && o.name !== it.name;
      });
    }
    const idx = Math.max(0, Math.min(meta.count - 1, Number(subIdx) || 0));
    // 擴成固定長度以便指定 subIdx
    while (list.length < meta.count) list.push(null);
    list[idx] = itemId;
    list = list.filter(Boolean);
    // 超長則保留前 count
    if (list.length > meta.count) {
      // 確保新穿的在
      list = list.filter((id) => id !== itemId);
      list.splice(idx, 0, itemId);
      list = list.slice(0, meta.count);
    }
    pp.equipped[slot] = list;
  } else {
    pp.equipped[slot] = itemId;
  }
  return getEquipmentView(pp);
}

/**
 * 卸下
 */
export function unequipItem(pp, slotKey, subIdx = 0) {
  if (!pp) throw new Error("無帳號");
  ensureEquipped(pp);
  const meta = SLOT_META[slotKey];
  if (!meta) throw new Error("未知槽位");

  if (meta.count > 1) {
    let list = Array.isArray(pp.equipped[slotKey])
      ? [...pp.equipped[slotKey]]
      : [];
    list = list.filter(Boolean);
    const idx = Math.max(0, Math.min(list.length - 1, Number(subIdx) || 0));
    if (list[idx]) list.splice(idx, 1);
    pp.equipped[slotKey] = list;
  } else {
    pp.equipped[slotKey] = null;
  }
  return getEquipmentView(pp);
}
