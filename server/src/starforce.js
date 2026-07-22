/**
 * 星力 API 邏輯 — 對齊 Bot prd.js applyStarForce / equippedStarSlots
 */
import { SLOTS, getItemSlot } from "./equip.js";
import { starForce, currency } from "./bot-bridge.js";

function getActiveChar(pp) {
  if (!pp?.characters || !pp.activeCharId) return null;
  return pp.characters[pp.activeCharId] || null;
}

function findItem(pp, itemId) {
  return (pp.items || []).find((x) => x && x.itemId === itemId && !x.destroyed);
}

function equippedGearForSlot(pp, slotKey, subIdx = 0) {
  const v = pp.equipped?.[slotKey];
  const id = Array.isArray(v) ? v[subIdx] : subIdx === 0 ? v : null;
  if (!id) return null;
  return findItem(pp, id);
}

function slotLabel(slotKey, subIdx = 0) {
  const meta = SLOTS.find((s) => s.key === slotKey);
  if (!meta) return `${slotKey}#${subIdx}`;
  return meta.count > 1 ? `${meta.label} #${subIdx + 1}` : meta.label;
}

function equippedStarSlots(pp) {
  const out = [];
  for (const slot of SLOTS) {
    if (slot.key === "title" || slot.key === "pet" || slot.key === "bullet") {
      continue;
    }
    const v = pp.equipped?.[slot.key];
    const ids = Array.isArray(v) ? v : v ? [v] : [];
    ids.forEach((id, i) => {
      const it = findItem(pp, id);
      if (it && starForce.isStarable(it)) {
        out.push({
          slotKey: slot.key,
          subIdx: i,
          item: it,
          label: slotLabel(slot.key, i),
          emoji: slot.emoji,
        });
      }
    });
  }
  return out;
}

function summarizeSlot(char, entry, isMage) {
  const key = starForce.sfKey(entry.slotKey, entry.subIdx);
  if (char) starForce.absorbItemStars(char, key, entry.item);
  const stars = char ? starForce.getStars(char, key) : 0;
  const maxStars = starForce.getMaxStars();
  const maxed = stars >= maxStars;
  const cost = char && !maxed ? starForce.starCost(char, key) : 0;
  const rates = char ? starForce.rates(char, key) : null;
  const miss =
    (char?.starSlots && char.starSlots[key] && char.starSlots[key].miss) || 0;
  const cur = starForce.bonusForStars(stars);
  const nxt = maxed ? null : starForce.bonusForStars(stars + 1);
  const attLabel = isMage ? "魔攻" : "攻擊";

  return {
    slotKey: entry.slotKey,
    subIdx: entry.subIdx,
    key,
    label: entry.label,
    emoji: entry.emoji,
    itemName: entry.item.name || "？",
    itemId: entry.item.itemId,
    itemLevel: entry.item.level || 0,
    stars,
    maxStars,
    maxed,
    cost,
    miss,
    guaranteed: miss >= 2,
    rates: rates
      ? {
          success: rates.success,
          maintain: rates.maintain,
          decrease: rates.decrease,
          boom: rates.boom,
        }
      : null,
    bonus: {
      allStat: cur.str || 0,
      att: cur.att || 0,
      attLabel,
    },
    nextBonus: nxt
      ? {
          allStat: nxt.str || 0,
          att: nxt.att || 0,
          attLabel,
        }
      : null,
    canProtect: stars >= 15,
  };
}

/**
 * 完整星力台視圖
 */
export function getStarforceView(pp) {
  if (!pp) return null;
  if (!pp.equipped || typeof pp.equipped !== "object") pp.equipped = {};
  const char = getActiveChar(pp);
  const isMage = /mage|wizard|bishop|evan|luminous|flame/i.test(
    char?.class || ""
  );
  const list = equippedStarSlots(pp)
    .map((e) => summarizeSlot(char, e, isMage))
    .sort((a, b) => b.stars - a.stars || a.label.localeCompare(b.label, "zh"));

  const coins = currency.getCoins(pp);
  const protectCount = starForce.countProtect(pp);

  return {
    coins,
    protectCount,
    maxStars: starForce.getMaxStars(),
    refLevel: starForce.refLevel(),
    charName: char?.name || pp.username || "冒險者",
    charClass: char?.class || "beginner",
    charLevel: char?.level || 1,
    slots: list,
    note: "星力綁部位不綁裝備；15★+ 失敗有機率歸零（裝備不毀）；保護卷擋歸零改降 1 星",
  };
}

/**
 * 執行一次衝星
 * @returns {{ view, result }} result: outcome/from/to/cost/…
 */
export function attemptStarforce(pp, slotKey, subIdx = 0, useProtect = false) {
  if (!pp) throw new Error("無帳號");
  const char = getActiveChar(pp);
  if (!char) throw new Error("找不到使用中角色");
  const item = equippedGearForSlot(pp, slotKey, subIdx);
  if (!item || item.destroyed) throw new Error("該部位目前沒有裝備");
  if (!starForce.isStarable(item)) throw new Error("這件裝備無法衝星");

  const key = starForce.sfKey(slotKey, subIdx);
  starForce.absorbItemStars(char, key, item);
  const stars = starForce.getStars(char, key);
  const maxStars = starForce.getMaxStars();
  if (stars >= maxStars) throw new Error(`已達星數上限（${maxStars}★）`);

  const cost = starForce.starCost(char, key);
  if (!currency.spendCoins(pp, cost, "star_force_web", { slot: key, star: stars })) {
    throw new Error(`楓幣不足（需 ${cost.toLocaleString()}）`);
  }

  const safeguard =
    !!useProtect && stars >= 15 && starForce.countProtect(pp) > 0;
  const res = starForce.attemptStar(char, key, { safeguard });
  if (res.protectUsed) starForce.consumeProtect(pp);

  const outcomeZh = {
    success: "成功",
    maintain: "維持",
    decrease: "降星",
    boom: "歸零",
  };

  return {
    view: getStarforceView(pp),
    result: {
      outcome: res.outcome,
      outcomeZh: outcomeZh[res.outcome] || res.outcome,
      from: res.from,
      to: res.to,
      guaranteed: !!res.guaranteed,
      protectUsed: !!res.protectUsed,
      cost,
      itemName: item.name,
      label: slotLabel(slotKey, subIdx),
      slotKey,
      subIdx,
    },
  };
}

// re-export helpers for potential if needed
export { getActiveChar, slotLabel, findItem, getItemSlot };
