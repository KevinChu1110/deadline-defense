/**
 * 自由市場社交技能 — 依職系給「該職業該有的」移動技
 * 綁 public/skills/* 官方 icon/fx，不用 emoji。
 *
 * 規則：
 * - 法師：疾風之步 + 瞬間移動
 * - 盜賊：速度激發 + 二段跳（被動）+ 無主動衝鋒
 * - 劍士/英雄：疾風之步 + 劍氣縱橫（短位移，不是海盜衝鋒）
 * - 弓/海盜：疾風之步 + 衝鋒（海盜才有衝鋒）
 * - 初心者：疾風之步 + 二段跳被動
 */

export const TOWN_SKILL_DEFS = {
  // 全職可用（初心者技）
  haste: {
    id: "haste",
    wzId: "j0_2", // 疾風之步
    name: "疾風之步",
    desc: "移動速度提升，持續 30 秒",
    cd: 45,
    keyHint: "1",
  },
  // 盜賊專屬加速
  haste_thief: {
    id: "haste_thief",
    wzId: "j410_1", // 速度激發
    name: "速度激發",
    desc: "移動速度提升，持續 30 秒",
    cd: 45,
    keyHint: "1",
  },
  teleport: {
    id: "teleport",
    wzId: "j212_1", // 瞬間移動（法師）
    name: "瞬間移動",
    desc: "朝面向方向瞬移一段距離",
    cd: 1.1,
    dist: 140,
    keyHint: "2",
  },
  // 劍士系短位移（劍氣），不是海盜衝鋒
  slash: {
    id: "slash",
    wzId: "j100_5", // 劍氣縱橫
    name: "劍氣縱橫",
    desc: "朝面向短距突進",
    cd: 0.9,
    dist: 95,
    keyHint: "2",
  },
  // 海盜衝鋒
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
    wzId: "j420_6",
    name: "二段跳",
    desc: "空中再按空白鍵再跳一次",
    cd: 0,
    keyHint: "空白",
    note: "被動",
    passive: true,
  },
};

export function iconUrl(wzId) {
  return `/skills/${wzId}_icon.png`;
}

/** 職系 → 加速技 */
export function hasteSkillForFamily(family) {
  return family === "thief" ? TOWN_SKILL_DEFS.haste_thief : TOWN_SKILL_DEFS.haste;
}

/** 職系 → 主動位移（沒有則 null） */
export function mobilitySkillForFamily(family) {
  if (family === "mage") return TOWN_SKILL_DEFS.teleport;
  if (family === "warrior") return TOWN_SKILL_DEFS.slash;
  if (family === "pirate") return TOWN_SKILL_DEFS.flash;
  if (family === "archer") return TOWN_SKILL_DEFS.slash; // 弓用短位移視覺
  if (family === "thief") return null; // 盜賊靠二段跳
  return null;
}

/** 是否有二段跳（盜賊/弓/初心者；劍士法師海盜靠主動位移） */
export function hasDoubleJump(family) {
  return family === "thief" || family === "archer" || family === "beginner" || !family;
}

/** 預設快捷 1～4 */
export function defaultHotbar(family) {
  const h = hasteSkillForFamily(family);
  const m = mobilitySkillForFamily(family);
  return [h.id, m ? m.id : null, null, null];
}

export function listTownSkills(family) {
  const list = [];
  const h = hasteSkillForFamily(family);
  list.push({ ...h, note: family === "thief" ? "盜賊" : "全職可用" });
  const m = mobilitySkillForFamily(family);
  if (m) {
    const note =
      family === "mage" ? "法師" :
      family === "warrior" ? "劍士/英雄" :
      family === "pirate" ? "海盜" : "職系";
    list.push({ ...m, note });
  }
  if (hasDoubleJump(family)) {
    list.push({ ...TOWN_SKILL_DEFS.double_jump });
  }
  return list;
}

export const FAMILY_ZH = {
  warrior: "劍士系",
  mage: "法師系",
  archer: "弓箭手系",
  thief: "盜賊系",
  pirate: "海盜系",
  beginner: "初心者",
};

const _iconCache = new Map();
export function getSkillIconImg(wzId) {
  if (!wzId) return null;
  if (_iconCache.has(wzId)) return _iconCache.get(wzId);
  const im = new Image();
  im.src = iconUrl(wzId);
  _iconCache.set(wzId, im);
  return im;
}

/** 兼容舊 hotbar id：把過期技能換成職系預設 */
export function sanitizeHotbar(hotbar, family) {
  const allowed = new Set(listTownSkills(family).filter((s) => !s.passive).map((s) => s.id));
  const def = defaultHotbar(family);
  const out = (Array.isArray(hotbar) ? hotbar : def).slice(0, 4).map((id, i) => {
    if (!id) return null;
    if (id === "double_jump") return null; // 被動不進快捷
    if (allowed.has(id)) return id;
    // 舊版 haste/flash/teleport 遷移
    if (id === "haste" || id === "haste_thief") return hasteSkillForFamily(family).id;
    if (id === "flash" || id === "teleport" || id === "slash") {
      const m = mobilitySkillForFamily(family);
      return m ? m.id : null;
    }
    return def[i] || null;
  });
  while (out.length < 4) out.push(null);
  return out;
}
