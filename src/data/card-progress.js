/**
 * 職業卡片升級進度 + 楓葉貨幣
 * 對齊 CLASS_DEFS 全職，每張卡獨立 Lv1–5，升級費用不同。
 */
import { SPECIALISTS, SPECIALIST_ORDER } from "./specialists.js";

export const CARD_MAX_LEVEL = 5;
const STORAGE_KEY = "deadline-defense-cards-v1";
const START_LEAVES = 120;

/** 系列係數：英雄團最貴 */
const SERIES_COST_MULT = {
  adventurer: 1,
  royal: 1.35,
  hero: 1.7,
};

/** 家族三轉被動模板 */
const FAMILY_L3 = {
  warrior: { name: "堅韌體魄", desc: "部署費用 −1（最低 1）、傷害 +10%", mods: { costAdd: -1, damageMult: 1.1 } },
  mage: { name: "魔力循環", desc: "攻速 +12%、效果持續 +20%", mods: { intervalMult: 0.88, effectDurMult: 1.2 } },
  archer: { name: "鷹之眼", desc: "射程 +18、易傷倍率 +0.1", mods: { rangeAdd: 18, effectPowerAdd: 0.1 } },
  thief: { name: "影分身", desc: "多重射擊 +1", mods: { multiShotAdd: 1 } },
  pirate: { name: "海盜魂", desc: "破甲 +12%、傷害 +12%", mods: { armorBreakAdd: 0.12, damageMult: 1.12 } },
};

const FAMILY_L5 = {
  warrior: { name: "終極一擊", desc: "傷害 +25%、減速更強", mods: { damageMult: 1.25, effectPowerMult: 0.85 } },
  mage: { name: "奧術爆發", desc: "傷害 +22%、燃燒/標記更強", mods: { damageMult: 1.22, effectPowerMult: 1.25 } },
  archer: { name: "百步穿楊", desc: "射程 +25、傷害 +15%", mods: { rangeAdd: 25, damageMult: 1.15 } },
  thief: { name: "絕對迴避", desc: "攻速 +20%、再 +1 投射", mods: { intervalMult: 0.8, multiShotAdd: 1 } },
  pirate: { name: "加農全開", desc: "傷害 +28%、破甲 +15%", mods: { damageMult: 1.28, armorBreakAdd: 0.15 } },
};

/** 職業專屬 L4 技能名（覆蓋） */
const CLASS_L4 = {
  hero: { name: "進階鬥氣", desc: "傷害 +20%、攻速 +10%", mods: { damageMult: 1.2, intervalMult: 0.9 } },
  paladin: { name: "聖域", desc: "減速大幅強化、射程 +10", mods: { effectPowerMult: 0.75, rangeAdd: 10 } },
  dark_knight: { name: "黑暗守護", desc: "破甲 +15%、傷害 +18%", mods: { armorBreakAdd: 0.15, damageMult: 1.18 } },
  mage: { name: "神聖祈禱", desc: "易傷 +0.15、射程 +12", mods: { effectPowerAdd: 0.15, rangeAdd: 12 } },
  fire_mage: { name: "劇毒麻痺", desc: "燃燒傷害 +40%、持續 +30%", mods: { effectPowerMult: 1.4, effectDurMult: 1.3 } },
  ice_mage: { name: "冰凍術", desc: "減速更強、傷害 +15%", mods: { effectPowerMult: 0.7, damageMult: 1.15 } },
  bowmaster: { name: "箭雨", desc: "雙發射擊、攻速 +8%", mods: { multiShotAdd: 1, intervalMult: 0.92 } },
  marksman: { name: "必殺狙擊·改", desc: "傷害 +30%、易傷更強", mods: { damageMult: 1.3, effectPowerAdd: 0.15 } },
  shadow_bandit: { name: "楓幣炸彈", desc: "傷害 +22%、攻速 +12%", mods: { damageMult: 1.22, intervalMult: 0.88 } },
  night_envoy: { name: "四飛閃", desc: "投射物 +1、傷害 +10%", mods: { multiShotAdd: 1, damageMult: 1.1 } },
  gunslinger: { name: "海盜砲擊", desc: "傷害 +25%、射程 +15", mods: { damageMult: 1.25, rangeAdd: 15 } },
  buccaneer: { name: "鬥神降臨", desc: "攻速 +18%、傷害 +15%", mods: { intervalMult: 0.82, damageMult: 1.15 } },
  soul_swordsman: { name: "靈魂之刃·極", desc: "傷害 +18%、減速強化", mods: { damageMult: 1.18, effectPowerMult: 0.8 } },
  flame_wizard: { name: "火焰風暴·極", desc: "燃燒 +35%", mods: { effectPowerMult: 1.35, damageMult: 1.12 } },
  wind_breaker: { name: "風之箭·極", desc: "三連射、攻速 +10%", mods: { multiShotAdd: 1, intervalMult: 0.9 } },
  night_walker: { name: "吸血術", desc: "毒傷 +30%、攻速 +10%", mods: { effectPowerMult: 1.3, intervalMult: 0.9 } },
  thunder_breaker: { name: "雷電拳·極", desc: "傷害 +20%、減速強化", mods: { damageMult: 1.2, effectPowerMult: 0.8 } },
  aran: { name: "終極之矛", desc: "破甲 +18%、冰緩更強", mods: { armorBreakAdd: 0.18, effectPowerMult: 0.75 } },
  evan: { name: "龍神合擊", desc: "傷害 +25%、燃燒 +25%", mods: { damageMult: 1.25, effectPowerMult: 1.25 } },
  mercedes: { name: "伊修塔爾·極", desc: "三連弩、射程 +12", mods: { multiShotAdd: 1, rangeAdd: 12 } },
  luminous: { name: "絕對擊殺·極", desc: "傷害 +28%、易傷 +0.2", mods: { damageMult: 1.28, effectPowerAdd: 0.2 } },
  phantom: { name: "卡牌風暴·極", desc: "投射 +1、攻速 +15%", mods: { multiShotAdd: 1, intervalMult: 0.85 } },
};

function defaultProgress() {
  const levels = {};
  for (const id of SPECIALIST_ORDER) levels[id] = 1;
  return { leaves: START_LEAVES, levels, totalEarned: 0 };
}

export function loadCardProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const data = JSON.parse(raw);
    const levels = { ...defaultProgress().levels, ...(data.levels || {}) };
    for (const id of SPECIALIST_ORDER) {
      levels[id] = Math.max(1, Math.min(CARD_MAX_LEVEL, Number(levels[id]) || 1));
    }
    return {
      leaves: Math.max(0, Number(data.leaves) || 0),
      levels,
      totalEarned: Math.max(0, Number(data.totalEarned) || 0),
    };
  } catch {
    return defaultProgress();
  }
}

export function saveCardProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

export function getCardLevel(typeId, progress = loadCardProgress()) {
  return progress.levels[typeId] || 1;
}

/**
 * 升到 nextLevel 需要的楓葉（每張卡不同）
 * level = 目前等級，回傳升到 level+1 的費用
 */
export function getUpgradeCost(typeId, fromLevel) {
  const d = SPECIALISTS[typeId];
  if (!d) return Infinity;
  if (fromLevel >= CARD_MAX_LEVEL) return Infinity;
  const seriesM = SERIES_COST_MULT[d.series] || 1;
  const deploy = d.cost || 2;
  // 費用曲線：基礎 × 部署費 × 系列 × 等級指數
  // Lv1→2 便宜，Lv4→5 昂貴；不同職業因 deploy/series 拉開差距
  const tier = fromLevel; // 1..4
  const curve = [0, 1, 2.2, 4.5, 8.5][tier] || 1;
  const base = 28;
  return Math.max(15, Math.round(base * deploy * seriesM * curve));
}

export function getAllUpgradeCosts(typeId) {
  const out = [];
  for (let lv = 1; lv < CARD_MAX_LEVEL; lv++) {
    out.push({ from: lv, to: lv + 1, cost: getUpgradeCost(typeId, lv) });
  }
  return out;
}

/** 技能樹（含已解鎖判定） */
export function getSkillTree(typeId, level = getCardLevel(typeId)) {
  const d = SPECIALISTS[typeId];
  if (!d) return [];
  const fam = d.family || "warrior";
  const l3 = FAMILY_L3[fam];
  const l4 = CLASS_L4[typeId] || {
    name: `${d.skill}·精通`,
    desc: "傷害 +18%、效果強化",
    mods: { damageMult: 1.18, effectPowerMult: 1.15 },
  };
  const l5 = FAMILY_L5[fam];

  const skills = [
    {
      level: 1,
      name: d.skill,
      desc: d.blurb || "基礎技能",
      mods: {},
    },
    {
      level: 2,
      name: `${d.skill}·強化`,
      desc: "傷害 +15%、射程 +6",
      mods: { damageMult: 1.15, rangeAdd: 6 },
    },
    {
      level: 3,
      name: l3.name,
      desc: l3.desc,
      mods: l3.mods,
    },
    {
      level: 4,
      name: l4.name,
      desc: l4.desc,
      mods: l4.mods,
    },
    {
      level: 5,
      name: l5.name,
      desc: l5.desc,
      mods: l5.mods,
    },
  ];

  return skills.map((s) => ({
    ...s,
    unlocked: level >= s.level,
  }));
}

/** 合併等級修正後的戰鬥定義（不改原始 SPECIALISTS） */
export function buildLeveledDef(typeId, level = getCardLevel(typeId)) {
  const base = SPECIALISTS[typeId];
  if (!base) return null;
  const def = {
    ...base,
    anim: { ...(base.anim || {}) },
  };

  let damageMult = 1;
  let intervalMult = 1;
  let effectDurMult = 1;
  let effectPowerMult = 1;
  let effectPowerAdd = 0;
  let rangeAdd = 0;
  let costAdd = 0;
  let armorBreakAdd = 0;
  let multiShotAdd = 0;

  const tree = getSkillTree(typeId, level);
  for (const sk of tree) {
    if (!sk.unlocked || !sk.mods) continue;
    const m = sk.mods;
    if (m.damageMult) damageMult *= m.damageMult;
    if (m.intervalMult) intervalMult *= m.intervalMult;
    if (m.effectDurMult) effectDurMult *= m.effectDurMult;
    if (m.effectPowerMult) effectPowerMult *= m.effectPowerMult;
    if (m.effectPowerAdd) effectPowerAdd += m.effectPowerAdd;
    if (m.rangeAdd) rangeAdd += m.rangeAdd;
    if (m.costAdd) costAdd += m.costAdd;
    if (m.armorBreakAdd) armorBreakAdd += m.armorBreakAdd;
    if (m.multiShotAdd) multiShotAdd += m.multiShotAdd;
  }

  def.damage = Math.round(base.damage * damageMult);
  def.interval = Math.max(0.28, +(base.interval * intervalMult).toFixed(3));
  def.range = base.range + rangeAdd;
  def.effectDuration = +(base.effectDuration * effectDurMult).toFixed(2);
  // burn / analyzed: higher effectPower is stronger
  // slow: effectPower is speed mult (lower = stronger); only apply effectPowerMult when < 1
  if (base.effect === "slow") {
    let slow = base.effectPower;
    for (const sk of tree) {
      if (!sk.unlocked || !sk.mods?.effectPowerMult) continue;
      if (sk.mods.effectPowerMult < 1) slow *= sk.mods.effectPowerMult;
    }
    def.effectPower = Math.max(0.28, +slow.toFixed(3));
  } else {
    def.effectPower = +(base.effectPower * effectPowerMult + effectPowerAdd).toFixed(3);
  }

  def.cost = Math.max(1, base.cost + costAdd);
  def.armorBreakBonus = (base.armorBreakBonus || 0) + armorBreakAdd;
  def.cardLevel = level;
  def.skillNames = tree.filter((s) => s.unlocked).map((s) => s.name);

  const multi = (base.anim?.multiShot || 1) + multiShotAdd;
  def.anim = {
    ...def.anim,
    multiShot: multi,
    multiShotSpread: def.anim.multiShotSpread || (multi > 1 ? 0.1 : 0),
  };

  return def;
}

export function tryUpgradeCard(typeId) {
  const progress = loadCardProgress();
  const lv = progress.levels[typeId] || 1;
  if (lv >= CARD_MAX_LEVEL) {
    return { ok: false, reason: "已滿級 ★5" };
  }
  const cost = getUpgradeCost(typeId, lv);
  if (progress.leaves < cost) {
    return { ok: false, reason: `楓葉不足（需要 ${cost}）`, cost, leaves: progress.leaves };
  }
  progress.leaves -= cost;
  progress.levels[typeId] = lv + 1;
  saveCardProgress(progress);
  const tree = getSkillTree(typeId, lv + 1);
  const unlocked = tree.find((s) => s.level === lv + 1);
  return {
    ok: true,
    level: lv + 1,
    cost,
    leaves: progress.leaves,
    skill: unlocked,
  };
}

export function addMapleLeaves(amount, reason = "") {
  if (!amount) return loadCardProgress();
  const progress = loadCardProgress();
  progress.leaves += amount;
  progress.totalEarned += Math.max(0, amount);
  saveCardProgress(progress);
  return { ...progress, gained: amount, reason };
}

/** @returns {{ ok: boolean, reason?: string, leaves?: number }} */
export function spendMapleLeaves(amount, reason = "") {
  const cost = Math.max(0, Math.floor(amount));
  const progress = loadCardProgress();
  if (progress.leaves < cost) {
    return { ok: false, reason: "楓葉不足", leaves: progress.leaves };
  }
  progress.leaves -= cost;
  saveCardProgress(progress);
  return { ok: true, leaves: progress.leaves, spent: cost, reason };
}

export function getLeaves() {
  return loadCardProgress().leaves;
}

/** 波次 / 通關獎勵 */
export function rewardForWaveClear(waveIndex, stageIndex = 0) {
  return 6 + waveIndex * 2 + stageIndex;
}

export function rewardForStageWin(stageIndex = 0, firstClear = false) {
  return 35 + stageIndex * 20 + (firstClear ? 80 : 0);
}
