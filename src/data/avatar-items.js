/**
 * 紙娃娃外觀模型 + 換裝/美髮/整形素材目錄（官方 item id, maplestory.io 渲染）。
 */
export const AVATAR_VER = "214";
export const AVATAR_REGION = "GMS";

// 外觀槽位（官方 item id）
export const AVATAR_SLOTS = ["skin", "face", "hair", "hat", "top", "bottom", "overall", "cape", "weapon"];

// 職業預設造型
const HAIR = { warrior: 30030, mage: 30020, archer: 34070, thief: 34070, pirate: 30030, beginner: 30030 };
const WEAPON = { sword: 1302000, spear: 1432000, axe: 1312000, staff: 1382000, wand: 1372000, bow: 1452000, crossbow: 1462000, dagger: 1332000, claw: 1472000, knuckle: 1482000, gun: 1492000 };
const CLASS_DEF = {
  beginner: { fam: "beginner" }, noblesse: { fam: "beginner" },
  hero: { fam: "warrior", w: WEAPON.sword }, paladin: { fam: "warrior", w: WEAPON.sword }, dark_knight: { fam: "warrior", w: WEAPON.spear },
  soul_swordsman: { fam: "warrior", w: WEAPON.sword }, aran: { fam: "warrior", w: WEAPON.spear },
  mage: { fam: "mage", w: WEAPON.staff, robe: 1 }, fire_mage: { fam: "mage", w: WEAPON.staff, robe: 1 }, ice_mage: { fam: "mage", w: WEAPON.staff, robe: 1 },
  flame_wizard: { fam: "mage", w: WEAPON.staff, robe: 1 }, evan: { fam: "mage", w: WEAPON.wand, robe: 1 }, luminous: { fam: "mage", w: WEAPON.staff, robe: 1 },
  bowmaster: { fam: "archer", w: WEAPON.bow }, marksman: { fam: "archer", w: WEAPON.crossbow }, mercedes: { fam: "archer", w: WEAPON.bow }, wind_breaker: { fam: "archer", w: WEAPON.bow },
  night_envoy: { fam: "thief", w: WEAPON.claw }, night_walker: { fam: "thief", w: WEAPON.claw }, shadow_bandit: { fam: "thief", w: WEAPON.dagger }, phantom: { fam: "thief", w: WEAPON.dagger },
  buccaneer: { fam: "pirate", w: WEAPON.knuckle }, thunder_breaker: { fam: "pirate", w: WEAPON.knuckle }, gunslinger: { fam: "pirate", w: WEAPON.gun },
};

/** 職業預設外觀 */
export function defaultAppearance(cls) {
  const d = CLASS_DEF[cls] || CLASS_DEF.beginner;
  const a = { skin: 2000, face: 20000, hair: HAIR[d.fam] || 30030, weapon: d.w || 0 };
  if (d.robe) a.overall = 1050131;
  else { a.top = 1040036; a.bottom = 1060026; }
  return a;
}

// 換裝/美髮/整形 目錄（精選官方 id；縮圖用 /item/{id}/icon）
export const AVATAR_CATALOG = {
  hair: [30030, 30020, 34070, 30000, 30150, 30330, 31000, 34100, 33000, 37020, 30240, 34030],
  face: [20000, 20001, 20003, 20012, 20016, 21000, 21012, 20028, 20031, 20100],
  top: [1040036, 1040002, 1040010, 1041006, 1042002, 1040043, 1041047, 1042128],
  bottom: [1060026, 1060002, 1061002, 1062003, 1060100, 1061047],
  overall: [1050131, 1050017, 1051000, 1052002, 1053000, 1050113],
  hat: [0, 1002001, 1002140, 1002357, 1002169, 1003798, 1002007],
  cape: [0, 1102000, 1102041, 1102084, 1102277],
};

// 武器 category → 官方基礎武器 item id(maplestory.io 可渲染;真裝備取近似外觀,
// 自訂裝備因無官方圖也對到同類別官方武器)。已逐一驗證可渲染。
export const WEAPON_CAT_ID = {
  sword_1h: 1302000, sword_2h: 1402000, axe_1h: 1312000, axe_2h: 1412000,
  blunt_1h: 1322000, blunt_2h: 1422000, spear: 1432000, polearm: 1442000,
  dagger: 1332000, wand: 1372000, staff: 1382000, bow: 1452000,
  crossbow: 1462000, claw: 1472000, knuckle: 1482000, gun: 1492000,
  dual_bowgun: 1522000,
};
// 職系 → 官方近似套服/披風(有裝備該槽才套用;取自換裝目錄的合法 id)
const FAMILY_OVERALL = { warrior: 1050131, mage: 1050131, archer: 1050017, thief: 1050017, pirate: 1050113 };

// WZ item id → 外觀槽位鍵(依 id 範圍;Character.wz 目錄對應)
function slotKeyForId(id) {
  if (id >= 1000000 && id < 1006000) return "hat";
  if (id >= 1040000 && id < 1050000) return "top";
  if (id >= 1050000 && id < 1060000) return "overall";
  if (id >= 1060000 && id < 1070000) return "bottom";
  if (id >= 1070000 && id < 1080000) return "shoes";
  if (id >= 1080000 && id < 1090000) return "glove";
  if (id >= 1100000 && id < 1103000) return "cape";
  return null;
}

/** combat profile 的 look → 外觀覆寫。
 *  優先用 wzId(裝備名對到的真實 WZ id→真原圖);對不到才用類別/職系近似。 */
export function applyLook(appearance, look, family) {
  if (!look) return appearance;
  const a = { ...appearance };
  // 武器:真實 id 優先,否則類別後備
  a.weapon = look.weaponWzId || (look.weaponCat && WEAPON_CAT_ID[look.weaponCat]) || a.weapon;
  const s = look.slots || {};
  for (const slot of Object.values(s)) {
    if (slot?.wzId) {
      const key = slotKeyForId(slot.wzId);
      if (key) { a[key] = slot.wzId; if (key === "overall") { delete a.top; delete a.bottom; } }
    }
  }
  // 近似後備:有裝套服/披風但沒對到真實 id → 職系近似
  if (s.overall && !s.overall.wzId && FAMILY_OVERALL[family]) { a.overall = FAMILY_OVERALL[family]; delete a.top; delete a.bottom; }
  if (s.cape && !s.cape.wzId) a.cape = 1102000;
  return a;
}

/** 外觀 → maplestory.io 角色 API item 陣列（過濾 0/空）
 * ⚠️ maplestory.io 角色需「身體(200x)」+「頭(120x = skin+10000)」兩件才有頭;
 *    只給 skin 會渲染成無頭裸身。head 由 skin 自動衍生(不佔外觀槽)。 */
export function appearanceItems(a) {
  const items = [];
  const push = (id) => { if (id && id > 0) items.push({ itemId: id, version: AVATAR_VER, region: AVATAR_REGION }); };
  if (a.skin && a.skin > 0) { push(a.skin); push(a.skin + 10000); } // 身體 + 頭
  for (const s of ["face", "hair", "hat", "overall", "top", "bottom", "cape", "weapon"]) push(a[s]);
  return items;
}

// ── 外觀儲存（localStorage，per 角色）──
const KEY = (charId) => `deadline-defense-avatar-${charId || "default"}`;
export function loadAppearance(charId, cls) {
  try {
    const raw = localStorage.getItem(KEY(charId));
    if (raw) return { ...defaultAppearance(cls), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultAppearance(cls);
}
export function saveAppearance(charId, appearance) {
  try { localStorage.setItem(KEY(charId), JSON.stringify(appearance)); } catch { /* ignore */ }
}
