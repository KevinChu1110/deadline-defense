/**
 * 自由市場社交技能 — 綁 WZ 已解包的 icon / fx（public/skills/）
 * 不用 emoji。
 */

/** @typedef {{ id: string, wzId: string, name: string, desc: string, cd: number, keyHint: string, passive?: boolean, note?: string }} TownSkill */

/** 城鎮技能 → 官方技能 id（skills-anim-manifest / public/skills） */
export const TOWN_SKILL_DEFS = {
  haste: {
    id: "haste",
    wzId: "j410_1", // 速度激發
    name: "速度激發",
    desc: "移動速度提升，持續 30 秒",
    cd: 45,
    keyHint: "1",
  },
  teleport: {
    id: "teleport",
    wzId: "j212_1", // 瞬間移動
    name: "瞬間移動",
    desc: "朝面向方向瞬移一段距離",
    cd: 1.1,
    dist: 140,
    keyHint: "2",
  },
  flash: {
    id: "flash",
    wzId: "j500_4", // 衝鋒
    name: "衝鋒",
    desc: "朝面向方向短距衝刺",
    cd: 0.85,
    dist: 100,
    keyHint: "2",
  },
  double_jump: {
    id: "double_jump",
    wzId: "j420_6", // 二段跳（有 icon）
    name: "二段跳",
    desc: "空中再按空白鍵再跳一次",
    cd: 0,
    keyHint: "空白",
    note: "被動 · 自動生效",
    passive: true,
  },
};

export function iconUrl(wzId) {
  return `/skills/${wzId}_icon.png`;
}

export function mobilitySkillForFamily(family) {
  return family === "mage" ? TOWN_SKILL_DEFS.teleport : TOWN_SKILL_DEFS.flash;
}

/** 預設快捷欄 1～4 */
export function defaultHotbar(family) {
  const mob = mobilitySkillForFamily(family);
  return ["haste", mob.id, null, null];
}

export function listTownSkills(family) {
  const mob = mobilitySkillForFamily(family);
  return [
    { ...TOWN_SKILL_DEFS.haste, note: "全職" },
    { ...mob, note: family === "mage" ? "法師" : "職系主動" },
    { ...TOWN_SKILL_DEFS.double_jump },
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

/** 圖示快取 */
const _iconCache = new Map();
export function getSkillIconImg(wzId) {
  if (!wzId) return null;
  if (_iconCache.has(wzId)) return _iconCache.get(wzId);
  const im = new Image();
  im.src = iconUrl(wzId);
  _iconCache.set(wzId, im);
  return im;
}
