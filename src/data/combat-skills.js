/**
 * 職業 TD 技能關鍵字（四轉為主，低階繼承家族原型）
 * 由 fireSpecialist / applyHit / Game update 讀取
 */

/** @typedef {'tank'|'control'|'st'|'aoe'|'util'} Role */

/**
 * skill fields:
 * role, pierce, splashR, splashMult, chain, lockOn, fort, auraAtk, frontlineAmp,
 * rageHits, killMesoBonus, revealOnHit, armorBreakOnHit, burnStacks, slowChain
 */
export const JOB_SKILLS = {
  // ── 四轉核心 ──
  hero: {
    role: "st",
    rageHits: 4,
    rageMult: 1.35,
    armorBreakOnHit: 0.08,
  },
  paladin: {
    role: "tank",
    fort: true,
    stallMul: 0.82,
    stallRadius: 55,
    auraAtk: 0.08,
  },
  dark_knight: {
    role: "tank",
    killLifesteal: 0.04,
    cleaveR: 48,
    cleaveMult: 0.35,
  },
  fire_mage: {
    role: "aoe",
    burnStacks: 3,
    burnDetonate: true,
    splashR: 52,
    splashMult: 0.45,
    armorBreakOnHit: 0.12,
  },
  ice_mage: {
    role: "control",
    slowChain: 2,
    slowChainPower: 0.72,
    chain: 2,
    chainFalloff: 0.55,
  },
  mage: {
    role: "util",
    auraAtk: 0.12,
    auraRange: 100,
    revealOnHit: true,
  },
  bowmaster: {
    role: "aoe",
    multiShot: 3,
    multiShotSpread: 0.1,
    flyerBonus: 1.25,
  },
  marksman: {
    role: "st",
    pierce: 3,
    pierceFalloff: 0.7,
    revealOnHit: true,
    flyerBonus: 1.15,
  },
  night_envoy: {
    role: "st",
    multiShot: 2,
    multiShotSpread: 0.08,
    critChance: 0.22,
    critMult: 1.8,
    critMesoBonus: 0.08,
    mesoCapPerWave: 40,
  },
  shadow_bandit: {
    role: "st",
    frontlineAmp: 0.4,
    frontlineRatio: 0.35,
  },
  buccaneer: {
    role: "tank",
    knockbackPath: 18,
    splashR: 44,
    splashMult: 0.4,
    everyNHits: 5,
  },
  gunslinger: {
    role: "st",
    lockOn: true,
    lockOnMult: 0.18,
    lockOnMax: 5,
  },

  // ── 低階原型（繼承用）──
  beginner: { role: "st" },
  swordman: { role: "st", armorBreakOnHit: 0.04 },
  fighter: { role: "st", rageHits: 5, rageMult: 1.2 },
  page: { role: "tank", stallMul: 0.9, stallRadius: 48 },
  spearman: { role: "st", armorBreakOnHit: 0.1 },
  crusader: { role: "st", rageHits: 4, rageMult: 1.28 },
  white_knight: { role: "tank", fort: true, stallMul: 0.85, stallRadius: 52 },
  dragon_knight: { role: "st", armorBreakOnHit: 0.14 },
  magician: { role: "control", slowChain: 1 },
  wizard_fp: { role: "aoe", burnStacks: 2, splashR: 40, splashMult: 0.35 },
  wizard_il: { role: "control", slowChain: 2, slowChainPower: 0.75 },
  cleric: { role: "util", revealOnHit: true, auraAtk: 0.06 },
  mage_fp: { role: "aoe", burnStacks: 3, splashR: 46, splashMult: 0.4, armorBreakOnHit: 0.1 },
  mage_il: { role: "control", slowChain: 2, chain: 1 },
  priest: { role: "util", revealOnHit: true, auraAtk: 0.1 },
  archer_1: { role: "st", multiShot: 2, multiShotSpread: 0.08 },
  hunter: { role: "aoe", multiShot: 2 },
  crossbowman: { role: "st", pierce: 2 },
  ranger: { role: "aoe", multiShot: 3, multiShotSpread: 0.1 },
  sniper: { role: "st", pierce: 3, revealOnHit: true },
  rogue: { role: "st", multiShot: 2 },
  assassin: { role: "st", multiShot: 2, critChance: 0.15 },
  bandit: { role: "st", frontlineAmp: 0.25 },
  hermit: { role: "st", multiShot: 3, critChance: 0.18, critMesoBonus: 0.05 },
  chief_bandit: { role: "st", frontlineAmp: 0.32 },
  pirate_1: { role: "st", armorBreakOnHit: 0.05 },
  brawler: { role: "tank", knockbackPath: 12, splashR: 36, splashMult: 0.3 },
  gunslinger_1: { role: "st", lockOn: true, lockOnMult: 0.12, lockOnMax: 3 },
  marauder: { role: "tank", knockbackPath: 15, splashR: 40, splashMult: 0.35 },
  outlaw: { role: "st", lockOn: true, lockOnMult: 0.15, lockOnMax: 4 },

  // 皇家／英雄簡化
  soul_swordsman: { role: "st", rageHits: 3, rageMult: 1.3 },
  flame_wizard: { role: "aoe", burnStacks: 3, splashR: 50, splashMult: 0.5 },
  wind_breaker: { role: "aoe", multiShot: 3, multiShotSpread: 0.09 },
  night_walker: { role: "util", revealOnHit: true, armorBreakOnHit: 0.1 },
  thunder_breaker: { role: "tank", knockbackPath: 16, splashR: 42, splashMult: 0.4 },
  aran: { role: "st", armorBreakOnHit: 0.18, pierce: 2 },
  evan: { role: "aoe", splashR: 55, splashMult: 0.5, burnStacks: 2 },
  mercedes: { role: "aoe", multiShot: 3, multiShotSpread: 0.08 },
  luminous: { role: "st", revealOnHit: true, lockOn: true, lockOnMult: 0.2, lockOnMax: 4 },
  phantom: { role: "st", multiShot: 3, multiShotSpread: 0.12, critChance: 0.2 },
};

export function getJobSkill(typeId) {
  return JOB_SKILLS[typeId] || { role: "st" };
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
