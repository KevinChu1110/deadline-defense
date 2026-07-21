/**
 * 場上職業共鳴（軟加成）
 */
import { getJobSkill } from "./combat-skills.js";

/**
 * @param {Array<{def: object, typeId: string}>} specialists
 */
export function computeSynergies(specialists) {
  const roles = {};
  const families = {};
  for (const s of specialists) {
    const sk = getJobSkill(s.typeId);
    const role = sk.role || "st";
    roles[role] = (roles[role] || 0) + 1;
    const fam = s.def?.family || "warrior";
    families[fam] = (families[fam] || 0) + 1;
  }

  const buffs = {
    attackSpeedMult: 1,
    damageMult: 1,
    armorBreak: 0,
    labels: [],
  };

  if ((families.warrior || 0) >= 2) {
    buffs.damageMult *= 1.06;
    buffs.labels.push("劍士連線 +6%傷");
  }
  if ((families.mage || 0) >= 2) {
    buffs.attackSpeedMult *= 1.08;
    buffs.labels.push("法師共鳴 +8%攻速");
  }
  if ((families.archer || 0) >= 2) {
    buffs.damageMult *= 1.05;
    buffs.labels.push("弓手齊射 +5%傷");
  }
  if ((roles.tank || 0) >= 1 && (roles.st || 0) >= 1) {
    buffs.damageMult *= 1.05;
    buffs.labels.push("坦輸出搭檔 +5%傷");
  }
  if ((roles.control || 0) >= 1 && (roles.aoe || 0) >= 1) {
    buffs.attackSpeedMult *= 1.05;
    buffs.labels.push("控場清潮 +5%攻速");
  }
  if ((roles.util || 0) >= 1) {
    buffs.armorBreak += 0.05;
    buffs.labels.push("輔助破甲 +5%");
  }

  return buffs;
}
