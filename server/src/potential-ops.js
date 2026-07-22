/**
 * 潛能 API 邏輯 — 對齊 Bot potential.js / potential-ui.js
 * v1：方塊重洗、三階賦予券、印章加第三排、合成
 * （結合／閃炫方塊需多步選擇，暫留 Discord）
 */
import { SLOTS } from "./equip.js";
import { potential } from "./bot-bridge.js";
import { getActiveChar, findItem, slotLabel } from "./starforce.js";

const STAT_ZH = { str: "力量", dex: "敏捷", int: "智力", luk: "幸運" };
const EFF_ZH = {
  crit_rate: "爆率",
  crit_dmg: "爆傷",
  hp_pct: "HP",
  mp_pct: "MP",
  drop_rate: "掉寶",
  exp_pct: "經驗",
  move_speed: "移速",
  atk_flat: "物攻",
  all_pct: "全屬",
  total_dmg_pct: "總傷",
  atk_pct: "物攻",
  atk_speed_tier: "攻速階",
  boss_dmg: "Boss傷",
  ied: "無視",
  acc_pct: "命中",
  eva_pct: "迴避",
  str_pct: "力量%",
  dex_pct: "敏捷%",
  int_pct: "智力%",
  luk_pct: "幸運%",
  str_flat: "力量",
  dex_flat: "敏捷",
  int_flat: "智力",
  luk_flat: "幸運",
};

const TIER_META = [
  { tier: 0, name: "特殊", color: "#3498db" },
  { tier: 1, name: "稀有", color: "#9b59b6" },
  { tier: 2, name: "罕見", color: "#f1c40f" },
  { tier: 3, name: "傳說", color: "#2ecc71" },
];

function effLabel(e) {
  const zh = EFF_ZH[e.stat] || e.stat;
  const pct = /_pct$|_rate$|_dmg$/.test(e.stat);
  const unit = e.stat === "atk_speed_tier" ? "階" : pct ? "%" : "";
  return `${zh}+${e.val}${unit}`;
}

export function lineLabel(ln) {
  if (!ln) return "";
  if (ln.decent) {
    return `✨${ln.name}（${(ln.effects || []).map(effLabel).join("、")}）`;
  }
  let nm = ln.name;
  if (ln.stat && /_(pct|flat)$/.test(ln.stat)) {
    const base = ln.stat.replace(/_(pct|flat)$/, "");
    if (STAT_ZH[base]) {
      nm = STAT_ZH[base] + (ln.stat.endsWith("_pct") ? "%" : "");
    }
  } else if (ln.stat && EFF_ZH[ln.stat]) {
    nm = EFF_ZH[ln.stat];
  }
  const unit = /(%|率)$/.test(nm) || /_pct$|_rate$|_dmg$/.test(ln.stat || "")
    ? "%"
    : "";
  return `${nm} +${ln.val}${unit}`;
}

/** 可洗潛能的部位清單 */
export function potSlotDefs() {
  const out = [];
  for (const s of SLOTS) {
    const cat = potential.categoryForSlot(s.key);
    if (!cat) continue;
    const n = s.count > 1 ? s.count : 1;
    for (let i = 0; i < n; i++) {
      out.push({
        slotKey: s.key,
        subIdx: i,
        cat,
        emoji: s.emoji,
        label: slotLabel(s.key, i),
        potKey: potential.slotPotKey(s.key, i),
      });
    }
  }
  return out;
}

function summarizeLines(pot) {
  if (!pot || !Array.isArray(pot.lines)) return [];
  return pot.lines.map((ln, i) => ({
    idx: i,
    label: lineLabel(ln),
    isMain: i === 0,
    key: ln.key || null,
    stat: ln.stat || null,
    val: ln.val ?? null,
    grade: ln.grade || null,
    decent: !!ln.decent,
  }));
}

function invSnapshot(pp) {
  const keys = [
    "cube",
    "grant",
    "grant_epic",
    "grant_legend",
    "silver_stamp",
    "gold_stamp",
    "perfect_stamp",
    "combine_cube",
    "bright_cube",
  ];
  const inv = {};
  for (const k of keys) {
    const meta = potential.ITEM_META[k] || {};
    inv[k] = {
      key: k,
      count: potential.invGet(pp, k),
      name: meta.name || k,
      emoji: meta.emoji || "",
      desc: meta.desc || "",
    };
  }
  return inv;
}

function equippedName(pp, slotKey, subIdx) {
  const v = pp.equipped?.[slotKey];
  const id = Array.isArray(v) ? v[subIdx] : subIdx === 0 ? v : null;
  if (!id) return null;
  const it = findItem(pp, id);
  return it?.name || null;
}

function summarizeOne(char, pp, def) {
  const pot = potential.ensureSlot(char, def.potKey, def.cat);
  const tier = pot.tier || 0;
  const tmeta = TIER_META[tier] || TIER_META[0];
  const lineCount =
    pot.lineCount || (Array.isArray(pot.lines) ? pot.lines.length : 0) || 0;
  return {
    ...def,
    tier,
    tierName: tmeta.name,
    tierColor: tmeta.color,
    stateLabel: potential.slotStateLabel(pot),
    lineCount,
    lines: summarizeLines(pot),
    equippedName: equippedName(pp, def.slotKey, def.subIdx),
    canGrant: {
      grant: tier < 1,
      grant_epic: tier < 2,
      grant_legend: tier < 3,
    },
    canStamp: lineCount < 3,
  };
}

/**
 * 完整潛能台視圖
 */
export function getPotentialView(pp) {
  if (!pp) return null;
  const char = getActiveChar(pp);
  if (!char) throw new Error("找不到使用中角色");

  const defs = potSlotDefs();
  // 進面板就初始化（冪等）
  for (const d of defs) potential.ensureSlot(char, d.potKey, d.cat);

  const slots = defs.map((d) => summarizeOne(char, pp, d));
  const rareCount = slots.filter((s) => s.tier >= 1).length;

  return {
    charName: char.name || pp.username || "冒險者",
    charClass: char.class || "beginner",
    charLevel: char.level || 1,
    slots,
    inv: invSnapshot(pp),
    rareCount,
    totalSlots: slots.length,
    craft: {
      grant_epic: { from: "grant", cost: 20, have: potential.invGet(pp, "grant") },
      grant_legend: {
        from: "grant_epic",
        cost: 10,
        have: potential.invGet(pp, "grant_epic"),
      },
      combine_cube: { from: "cube", cost: 10, have: potential.invGet(pp, "cube") },
      bright_cube: { from: "cube", cost: 30, have: potential.invGet(pp, "cube") },
    },
    note: "潛能綁部位；方塊重洗／賦予券跳階／印章加第三排。結合／閃炫方塊請先用 Discord。",
  };
}

const SIMPLE_ACTIONS = new Set([
  "cube",
  "grant",
  "grant_epic",
  "grant_legend",
  "silver_stamp",
  "gold_stamp",
  "perfect_stamp",
]);

/**
 * 對指定部位使用潛能道具
 */
export function usePotentialAction(pp, slotKey, subIdx, action) {
  if (!pp) throw new Error("無帳號");
  const char = getActiveChar(pp);
  if (!char) throw new Error("找不到使用中角色");

  const def = potSlotDefs().find(
    (s) => s.slotKey === slotKey && s.subIdx === Number(subIdx)
  );
  if (!def) throw new Error("未知部位");
  if (!SIMPLE_ACTIONS.has(action)) {
    throw new Error(
      action === "combine" || action === "bright"
        ? "結合／閃炫方塊請先用 Discord 操作"
        : "未知動作"
    );
  }

  if (potential.invGet(pp, action) < 1) {
    const m = potential.ITEM_META[action];
    throw new Error(`${m?.emoji || ""} ${m?.name || action} 不足`);
  }

  const potBefore = potential.ensureSlot(char, def.potKey, def.cat);
  let note = "";
  let detail = null;

  if (action === "cube") {
    potential.invSpend(pp, "cube", 1);
    const r = potential.rerollSlot(char, def.potKey, def.cat);
    if (!r.ok) throw new Error("重洗失敗：" + (r.reason || ""));
    note = r.tieredUp
      ? `🎲 重洗成功 · ✨ 跳框！${potential.tierName(r.fromTier)} → ${potential.tierName(r.toTier)}`
      : "🎲 重洗完成";
    if (r.lineUp) note += " · 升為 3 排！";
    detail = { tieredUp: !!r.tieredUp, lineUp: !!r.lineUp, toTier: r.toTier };
  } else if (
    action === "grant" ||
    action === "grant_epic" ||
    action === "grant_legend"
  ) {
    const target =
      action === "grant_legend"
        ? potential.TIER_LEGEND
        : action === "grant_epic"
          ? potential.TIER_EPIC
          : potential.TIER_RARE;
    if ((potBefore.tier || 0) >= target) {
      throw new Error(`已達 ${potential.tierName(target)} 以上，無需使用`);
    }
    potential.invSpend(pp, action, 1);
    const r = potential.grantSlot(char, def.potKey, def.cat, null, target);
    if (!r.ok) throw new Error(r.reason === "already_at_tier" ? "品階已足夠" : "賦予失敗");
    const m = potential.ITEM_META[action];
    note = `${m.emoji} 已拉到【${potential.tierName(target)}】並重洗`;
    detail = { toTier: target };
  } else if (potential.STAMP_KEYS.includes(action)) {
    const stampKind = potential.ITEM_META[action]?.stamp;
    const rate = potential.CONFIG.STAMP_RATE[stampKind];
    if (rate == null) throw new Error("未知印章");
    const lines =
      potBefore.lineCount ||
      (Array.isArray(potBefore.lines) ? potBefore.lines.length : 0) ||
      0;
    if (lines >= 3) throw new Error("已是 3 排，無需印章");
    potential.invSpend(pp, action, 1);
    const r = potential.stampAddLine(char, def.potKey, def.cat, rate);
    if (!r.ok) throw new Error("印章失敗：" + (r.reason || ""));
    const m = potential.ITEM_META[action];
    note = r.success
      ? `${m.emoji} 成功加上第三排！`
      : `${m.emoji} 印章失敗…第三排沒加上`;
    detail = { success: !!r.success };
  }

  return {
    view: getPotentialView(pp),
    result: {
      action,
      note,
      detail,
      slotKey,
      subIdx: Number(subIdx),
      label: def.label,
    },
  };
}

/**
 * 合成賦予券／方塊
 */
export function craftPotential(pp, toKey, times = 1) {
  if (!pp) throw new Error("無帳號");
  const recipe = potential.GRANT_CRAFT[toKey];
  if (!recipe) throw new Error("無法合成此道具");
  const r = potential.craftGrant(pp, toKey, times);
  if (!r.ok) {
    if (r.reason === "not_enough") {
      const fromMeta = potential.ITEM_META[r.fromKey] || {};
      throw new Error(
        `${fromMeta.name || r.fromKey} 不足（需要 ${r.need}，持有 ${r.have}）`
      );
    }
    throw new Error("合成失敗");
  }
  const toMeta = potential.ITEM_META[toKey] || {};
  return {
    view: getPotentialView(pp),
    result: {
      made: r.made,
      toKey,
      note: `🔨 合成 ${toMeta.emoji || ""} ${toMeta.name || toKey} ×${r.made}`,
    },
  };
}
