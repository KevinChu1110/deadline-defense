/**
 * 動作突襲用戰鬥快照 — 從 player-data 抽出可打的數值
 * v1 簡化：等級 + 裝備物/魔攻 + 基礎素質（完整 class-formula 二期）
 */
import { getItemSlot } from "./equip.js";

const MAGE = new Set([
  "mage",
  "fire_mage",
  "ice_mage",
  "flame_wizard",
  "evan",
  "luminous",
]);
const ARCHER = new Set(["bowmaster", "marksman", "wind_breaker", "mercedes"]);
const THIEF = new Set([
  "shadow_bandit",
  "night_envoy",
  "night_walker",
  "phantom",
]);
const PIRATE = new Set(["gunslinger", "buccaneer", "thunder_breaker"]);
const WARRIOR = new Set([
  "hero",
  "paladin",
  "dark_knight",
  "soul_swordsman",
  "aran",
]);

export const ACTION_BOSSES = {
  zakum: {
    id: "zakum",
    nameZh: "殘暴炎魔",
    tier: "S+",
    regionZh: "冰原雪域",
    sprite: "/mobs/zakum.png",
    maxHp: 12000,
    level: 140,
    armor: 0.15,
    color: "#ef4444",
    blurb: "M3 v1 · 可讀 telegraph · 三階段",
  },
  horntail: {
    id: "horntail",
    nameZh: "暗黑龍王",
    tier: "SS",
    regionZh: "神木村",
    sprite: "/mobs/horntail.png",
    maxHp: 18000,
    level: 160,
    armor: 0.18,
    color: "#7c3aed",
    blurb: "更高血量 · 較快節奏",
    // v1 全開；之後可用 unlockLevel 做進度牆
  },
};

function getActiveChar(pp) {
  if (!pp?.characters || !pp.activeCharId) return null;
  return pp.characters[pp.activeCharId] || null;
}

function findItem(pp, itemId) {
  return (pp.items || []).find((x) => x && x.itemId === itemId && !x.destroyed);
}

function equippedWeapon(pp) {
  const id = pp.equipped?.weapon;
  if (!id) return null;
  return findItem(pp, id);
}

function familyOf(cls) {
  if (MAGE.has(cls)) return "mage";
  if (ARCHER.has(cls)) return "archer";
  if (THIEF.has(cls)) return "thief";
  if (PIRATE.has(cls)) return "pirate";
  if (WARRIOR.has(cls)) return "warrior";
  return "beginner";
}

function styleOf(family) {
  if (family === "mage" || family === "archer" || family === "pirate") {
    return "ranged";
  }
  return "melee";
}

/**
 * @returns combat profile for action raid
 */
export function buildCombatProfile(pp) {
  const char = getActiveChar(pp);
  if (!char) throw new Error("找不到使用中角色");

  const level = Math.max(1, Number(char.level) || 1);
  const cls = char.class || "beginner";
  const family = familyOf(cls);
  const style = styleOf(family);
  const ls = char.levelStats || {};
  const str = Number(ls.str) || 4;
  const dex = Number(ls.dex) || 4;
  const int_ = Number(ls.int) || 4;
  const luk = Number(ls.luk) || 4;

  const weapon = equippedWeapon(pp);
  const wAd = weapon
    ? (weapon.baseAd || 0) + (weapon.scrolledAd || 0)
    : 0;
  const wAp = weapon
    ? (weapon.baseAp || 0) + (weapon.scrolledAp || 0)
    : 0;

  // 星力簡易加成（全部位 att 加總）
  let starAtt = 0;
  const stars = char.starSlots || {};
  for (const k of Object.keys(stars)) {
    const s = stars[k]?.stars || 0;
    // 粗略：每星 +1 att（完整公式在 Bot star-force；v1 夠用）
    starAtt += s;
  }

  const isMage = family === "mage";
  const mainStat = isMage
    ? int_
    : family === "thief"
      ? luk
      : family === "archer" || family === "pirate"
        ? dex
        : str;
  const weaponAtk = isMage ? Math.max(wAp, wAd * 0.5) : wAd;
  // 動作突襲 v1：地板抬高，避免裸裝 / 低等無法破關
  const atk = Math.max(
    28,
    Math.round(weaponAtk + starAtt + mainStat * 0.45 + level * 2.2 + 12)
  );

  // 普攻 / 技能傷害區間（client 再 roll）
  const basicMin = Math.round(atk * 0.88);
  const basicMax = Math.round(atk * 1.18);
  const skillMin = Math.round(atk * 1.75);
  const skillMax = Math.round(atk * 2.4);

  const maxHp = Math.round(120 + level * 28 + str * 4 + (isMage ? int_ * 2 : 0));
  const moveSpeed = family === "thief" ? 230 : family === "archer" ? 210 : 200;
  const jump = 440;
  const attackRange = style === "ranged" ? 300 : 82;
  const attackCd = style === "ranged" ? 0.38 : 0.34;
  const skillCd = 3.8;

  // 可挑戰 Boss 清單
  const bosses = Object.values(ACTION_BOSSES).map((b) => ({
    ...b,
    locked: !!(b.unlockLevel && level < b.unlockLevel),
    lockHint: b.unlockLevel
      ? `角色 Lv.${b.unlockLevel} 解鎖`
      : null,
  }));

  return {
    discordId: null,
    charId: pp.activeCharId,
    name: char.name || pp.username || "冒險者",
    class: cls,
    family,
    style,
    level,
    stats: { str, dex, int: int_, luk },
    weaponName: weapon?.name || "徒手",
    weaponAtk: weaponAtk + starAtt,
    atk,
    maxHp,
    moveSpeed,
    jump,
    attackRange,
    attackCd,
    skillCd,
    basicMin,
    basicMax,
    skillMin,
    skillMax,
    skillName:
      family === "mage"
        ? "魔力爆破"
        : family === "archer"
          ? "箭雨"
          : family === "thief"
            ? "雙飛斬"
            : family === "pirate"
              ? "爆頭射擊"
              : "旋風斬",
    bosses,
    note: "M3 v1 快照；完整 class-formula 戰力二期接入",
  };
}

export function listBosses() {
  return Object.values(ACTION_BOSSES);
}

export function getBoss(bossId) {
  return ACTION_BOSSES[bossId] || ACTION_BOSSES.zakum;
}

/**
 * 依玩家輸出縮放 Boss 血量，目標約 40–70 秒一場（v1 可玩優先）
 */
export function scaleBossForProfile(bossMeta, profile) {
  const avgHit = (profile.basicMin + profile.basicMax) / 2;
  const hitsPerSec = 1 / Math.max(0.25, profile.attackCd);
  const skillDps =
    ((profile.skillMin + profile.skillMax) / 2) / Math.max(1, profile.skillCd);
  // 走位空檔係數；技能貢獻
  const dps = avgHit * hitsPerSec * 0.72 + skillDps * 0.55;
  const targetSec = bossMeta.id === "horntail" ? 55 : 40;
  let hp = Math.round(dps * targetSec);
  // 下限／上限：v1 優先可打完
  hp = Math.max(700, Math.min(bossMeta.maxHp, hp));
  if (profile.level >= 120 || profile.atk >= 150) {
    hp = Math.max(hp, Math.round(bossMeta.maxHp * 0.4));
  }
  return {
    id: bossMeta.id,
    nameZh: bossMeta.nameZh,
    tier: bossMeta.tier,
    regionZh: bossMeta.regionZh,
    sprite: bossMeta.sprite,
    maxHp: hp,
    armor: bossMeta.armor,
    color: bossMeta.color,
    level: bossMeta.level,
  };
}
