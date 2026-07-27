/**
 * 自由市場 / 聊天城鎮 — 社交移動技能（非戰鬥）
 * 全職：二段跳（空白空中再按）、速度激發
 * 法師：瞬間移動｜其他：突刺/衝刺位移
 */

/** @typedef {'haste'|'teleport'|'flash'} TownSkillId */

export const TOWN_SKILL_DEFS = {
  haste: {
    id: "haste",
    name: "速度激發",
    desc: "移動速度提升 45%，持續 30 秒",
    cd: 45,
    icon: "⚡",
    keyHint: "1",
  },
  teleport: {
    id: "teleport",
    name: "瞬間移動",
    desc: "朝面向方向瞬移一段距離",
    cd: 1.1,
    dist: 140,
    icon: "✦",
    keyHint: "2",
  },
  flash: {
    id: "flash",
    name: "突刺",
    desc: "朝面向方向短距衝刺",
    cd: 0.85,
    dist: 100,
    icon: "»",
    keyHint: "2",
  },
};

/** 職系 → 主動位移技 */
export function mobilitySkillForFamily(family) {
  return family === "mage" ? TOWN_SKILL_DEFS.teleport : TOWN_SKILL_DEFS.flash;
}

/**
 * 預設快捷欄 1～4（slot index 0～3）
 * [0]=速度激發 [1]=職業位移 [2][3]=空
 */
export function defaultHotbar(family) {
  const mob = mobilitySkillForFamily(family);
  return ["haste", mob.id, null, null];
}

/** 技能窗列表（可裝備） */
export function listTownSkills(family) {
  const mob = mobilitySkillForFamily(family);
  return [
    { ...TOWN_SKILL_DEFS.haste, note: "全職" },
    { ...mob, note: family === "mage" ? "法師" : "職系主動" },
    {
      id: "double_jump",
      name: "二段跳",
      desc: "空中再按空白鍵再跳一次",
      cd: 0,
      icon: "⤴",
      keyHint: "空白",
      note: "被動 · 自動生效",
      passive: true,
    },
  ];
}

export const FAMILY_ZH = {
  warrior: "劍士系",
  mage: "法師系",
  archer: "弓箭手系",
  thief: "盜賊系",
  pirate: "海盜系",
  beginner: "初心者",
};
