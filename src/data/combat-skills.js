/**
 * 職業 TD 技能 — 名稱／路線對齊台服（artale bot leveling.JOB_TREE + skills.json）
 * 效果為塔防抽象，代表技能取自台服主動技。
 */

/** @typedef {'tank'|'control'|'st'|'aoe'|'util'} Role */

/**
 * skill fields:
 * skillName — 台服技能顯示名
 * role, pierce, splashR, splashMult, chain, lockOn, fort, auraAtk, frontlineAmp,
 * rageHits, killMesoBonus, revealOnHit, armorBreakOnHit, burnStacks, slowChain
 */
export const JOB_SKILLS = {
  // ── 初心者 ──
  beginner: {
    skillName: "嫩寶丟擲術",
    role: "st",
  },

  // ── 劍士線 ──
  swordman: {
    skillName: "劍氣縱橫",
    role: "st",
    splashR: 28,
    splashMult: 0.25,
    armorBreakOnHit: 0.04,
  },
  fighter: {
    skillName: "激勵",
    role: "st",
    rageHits: 5,
    rageMult: 1.2,
  },
  page: {
    skillName: "降魔咒",
    role: "tank",
    revealOnHit: true,
    stallMul: 0.9,
    stallRadius: 48,
  },
  spearman: {
    skillName: "神聖之火",
    role: "tank",
    fort: true,
    auraAtk: 0.05,
    armorBreakOnHit: 0.1,
  },
  crusader: {
    skillName: "鬥氣集中",
    role: "st",
    rageHits: 4,
    rageMult: 1.28,
    armorBreakOnHit: 0.06,
  },
  white_knight: {
    skillName: "屬性攻擊",
    role: "tank",
    fort: true,
    stallMul: 0.85,
    stallRadius: 52,
    armorBreakOnHit: 0.08,
  },
  dragon_knight: {
    skillName: "龍咆哮",
    role: "st",
    splashR: 40,
    splashMult: 0.35,
    armorBreakOnHit: 0.14,
  },
  hero: {
    skillName: "無雙劍舞",
    role: "st",
    rageHits: 4,
    rageMult: 1.35,
    armorBreakOnHit: 0.08,
  },
  paladin: {
    skillName: "騎士衝擊波",
    role: "tank",
    fort: true,
    stallMul: 0.82,
    stallRadius: 55,
    auraAtk: 0.08,
    splashR: 36,
    splashMult: 0.3,
  },
  dark_knight: {
    skillName: "暗之靈魂",
    role: "tank",
    killLifesteal: 0.04,
    cleaveR: 48,
    cleaveMult: 0.35,
    armorBreakOnHit: 0.12,
  },

  // ── 法師線 ──
  magician: {
    skillName: "魔靈彈",
    role: "control",
    slowChain: 1,
    slowChainPower: 0.8,
  },
  cleric: {
    skillName: "神聖之光",
    role: "util",
    revealOnHit: true,
    auraAtk: 0.06,
  },
  wizard_fp: {
    skillName: "火焰箭",
    role: "aoe",
    burnStacks: 2,
    splashR: 40,
    splashMult: 0.35,
  },
  wizard_il: {
    skillName: "冰錐術",
    role: "control",
    slowChain: 2,
    slowChainPower: 0.75,
  },
  priest: {
    skillName: "聖光",
    role: "util",
    revealOnHit: true,
    auraAtk: 0.1,
  },
  mage_fp: {
    skillName: "末日烈焰",
    role: "aoe",
    burnStacks: 3,
    splashR: 46,
    splashMult: 0.4,
    armorBreakOnHit: 0.1,
  },
  mage_il: {
    skillName: "冰風暴",
    role: "control",
    slowChain: 2,
    chain: 1,
    slowChainPower: 0.7,
  },
  mage: {
    skillName: "召喚神龍",
    role: "util",
    auraAtk: 0.12,
    auraRange: 100,
    revealOnHit: true,
  },
  fire_mage: {
    skillName: "炎靈地獄",
    role: "aoe",
    burnStacks: 3,
    burnDetonate: true,
    splashR: 52,
    splashMult: 0.45,
    armorBreakOnHit: 0.12,
  },
  ice_mage: {
    skillName: "暴風雪",
    role: "control",
    slowChain: 2,
    slowChainPower: 0.72,
    chain: 2,
    chainFalloff: 0.55,
  },

  // ── 弓箭手線 ──
  archer_1: {
    skillName: "二連箭",
    role: "st",
    multiShot: 2,
    multiShotSpread: 0.08,
  },
  hunter: {
    skillName: "炸彈箭",
    role: "aoe",
    multiShot: 2,
    splashR: 36,
    splashMult: 0.35,
  },
  crossbowman: {
    skillName: "穿透之箭",
    role: "st",
    pierce: 2,
    pierceFalloff: 0.75,
  },
  ranger: {
    skillName: "箭雨",
    role: "aoe",
    multiShot: 3,
    multiShotSpread: 0.1,
    splashR: 40,
    splashMult: 0.3,
  },
  sniper: {
    skillName: "昇龍弩",
    role: "st",
    pierce: 3,
    revealOnHit: true,
  },
  bowmaster: {
    skillName: "暴風神射",
    role: "aoe",
    multiShot: 3,
    multiShotSpread: 0.1,
    flyerBonus: 1.25,
  },
  marksman: {
    skillName: "必殺狙擊",
    role: "st",
    pierce: 3,
    pierceFalloff: 0.7,
    revealOnHit: true,
    flyerBonus: 1.15,
  },

  // ── 盜賊線 ──
  rogue: {
    skillName: "雙飛斬",
    role: "st",
    multiShot: 2,
    multiShotSpread: 0.1,
  },
  assassin: {
    skillName: "極速暗殺",
    role: "st",
    multiShot: 2,
    critChance: 0.15,
    critMult: 1.6,
  },
  bandit: {
    skillName: "迴旋斬",
    role: "st",
    frontlineAmp: 0.25,
    splashR: 32,
    splashMult: 0.3,
  },
  hermit: {
    skillName: "風魔手裡劍",
    role: "st",
    multiShot: 3,
    critChance: 0.18,
    critMesoBonus: 0.05,
  },
  chief_bandit: {
    skillName: "楓幣炸彈",
    role: "st",
    frontlineAmp: 0.32,
    killMesoBonus: 0.15,
    splashR: 40,
    splashMult: 0.35,
  },
  night_envoy: {
    skillName: "三飛閃",
    role: "st",
    multiShot: 2,
    multiShotSpread: 0.08,
    critChance: 0.22,
    critMult: 1.8,
    critMesoBonus: 0.08,
    mesoCapPerWave: 40,
  },
  shadow_bandit: {
    skillName: "致命暗殺",
    role: "st",
    frontlineAmp: 0.4,
    frontlineRatio: 0.35,
    critChance: 0.12,
  },

  // ── 海盜線 ──
  pirate_1: {
    skillName: "衝擊拳",
    role: "st",
    armorBreakOnHit: 0.05,
    knockbackPath: 8,
  },
  brawler: {
    skillName: "迴旋肘擊",
    role: "tank",
    knockbackPath: 12,
    splashR: 36,
    splashMult: 0.3,
  },
  gunslinger_1: {
    skillName: "散射",
    role: "st",
    multiShot: 2,
    multiShotSpread: 0.12,
    lockOn: true,
    lockOnMult: 0.12,
    lockOnMax: 3,
  },
  marauder: {
    skillName: "能量暴擊",
    role: "tank",
    knockbackPath: 15,
    splashR: 40,
    splashMult: 0.35,
  },
  outlaw: {
    skillName: "3連發",
    role: "st",
    multiShot: 3,
    multiShotSpread: 0.08,
    lockOn: true,
    lockOnMult: 0.15,
    lockOnMax: 4,
  },
  buccaneer: {
    skillName: "閃．連殺",
    role: "tank",
    knockbackPath: 18,
    splashR: 44,
    splashMult: 0.4,
    everyNHits: 5,
  },
  gunslinger: {
    skillName: "海盜加農炮",
    role: "st",
    lockOn: true,
    lockOnMult: 0.18,
    lockOnMax: 5,
    splashR: 32,
    splashMult: 0.25,
  },

  // ── 皇家騎士團（台服 1 轉定職）──
  soul_swordsman: {
    skillName: "魔天一擊",
    role: "st",
    rageHits: 3,
    rageMult: 1.3,
    splashR: 30,
    splashMult: 0.28,
  },
  flame_wizard: {
    skillName: "火牢術",
    role: "aoe",
    burnStacks: 3,
    splashR: 50,
    splashMult: 0.5,
  },
  wind_breaker: {
    skillName: "二連箭",
    role: "aoe",
    multiShot: 3,
    multiShotSpread: 0.09,
  },
  night_walker: {
    skillName: "雙飛斬",
    role: "util",
    multiShot: 2,
    revealOnHit: true,
    armorBreakOnHit: 0.1,
  },
  thunder_breaker: {
    skillName: "衝擊拳",
    role: "tank",
    knockbackPath: 16,
    splashR: 42,
    splashMult: 0.4,
  },

  // ── 英雄團 ──
  aran: {
    skillName: "雙重攻擊",
    role: "st",
    armorBreakOnHit: 0.18,
    pierce: 2,
    multiShot: 2,
  },
  evan: {
    skillName: "魔法飛彈",
    role: "aoe",
    splashR: 55,
    splashMult: 0.5,
    burnStacks: 2,
  },
  mercedes: {
    skillName: "急速雙擊",
    role: "aoe",
    multiShot: 3,
    multiShotSpread: 0.08,
    flyerBonus: 1.2,
  },
  luminous: {
    skillName: "星星閃光",
    role: "st",
    revealOnHit: true,
    lockOn: true,
    lockOnMult: 0.2,
    lockOnMax: 4,
  },
  phantom: {
    skillName: "雙重穿刺",
    role: "st",
    multiShot: 3,
    multiShotSpread: 0.12,
    critChance: 0.2,
  },
};

export function getJobSkill(typeId) {
  return JOB_SKILLS[typeId] || { role: "st" };
}

/** 顯示用技能名（優先 combat skillName，再 specialist.skill） */
export function getSkillDisplayName(typeId, fallback = "普通攻擊") {
  return JOB_SKILLS[typeId]?.skillName || fallback;
}

/** 敵方 tag 推導（也可寫在 enemy def） */
export function deriveEnemyTags(def) {
  const tags = new Set(def.tags || []);
  if (def.armor && def.armor >= 0.12) tags.add("armored");
  if (def.stealth || def.hidden) tags.add("stealth");
  if (def.speed >= 90) tags.add("swift");
  if (def.boss) tags.add("boss");
  if (def.summonInterval || def.splitOnDeath || def.phaseSpawns) tags.add("summoner");
  if (def.reviveOnce) tags.add("regen");
  if ((def.hp || 0) <= 40 && (def.speed || 0) >= 70) tags.add("swarm");
  if (def.canGap || def.flying) tags.add("flyer");
  return [...tags];
}
