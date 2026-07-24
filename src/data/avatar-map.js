/**
 * 角色真實 Discord 裝備 → 紙娃娃外觀（中文名對照官方 item id）。
 * 對照表 official-items.json 由 String.wz(v120,中文) 抽出。
 */
import OFFICIAL from "./official-items.json";
import { defaultAppearance } from "./avatar-items.js";

// Artale equipType/slot → avatar 部位
const SLOT_MAP = {
  weapon: "weapon", bullet: null,
  helmet: "hat", hat: "hat", cap: "hat",
  overall: "overall", top: "top", coat: "top",
  bottom: "bottom", pants: "bottom",
  cape: "cape", shoes: "shoes",
  glove: "glove", gloves: "glove",
  face: "face", shield: "shield",
};
const COLOR_RE = /^(深|淺|亮)?(黑|白|紅|藍|綠|黃|紫|褐|灰|粉紅|粉|橘|金|銀|棕|青|紅寶|翠綠|天藍)色?/;

function findId(slot, name) {
  const table = OFFICIAL[slot];
  if (!table || !name) return 0;
  const n = String(name).trim();
  if (table[n]) return table[n];
  // 去顏色前綴再試
  const bare = n.replace(COLOR_RE, "").trim();
  if (bare && bare !== n && table[bare]) return table[bare];
  // 包含比對（挑最短匹配，避免抓到過長的變體）
  let best = 0, bestLen = 1e9;
  for (const k in table) {
    if ((k.includes(bare) || bare.includes(k)) && k.length < bestLen) { best = table[k]; bestLen = k.length; }
  }
  return best;
}

/** 取角色已裝備的 {slotKey, item} */
function* equippedSlots(equip) {
  const S = equip?.slots || {};
  for (const [k, v] of Object.entries(S)) {
    if (v?.item) yield [k, v.item];
    if (Array.isArray(v?.items)) for (const it of v.items) if (it) yield [k, it];
  }
}

/** 真實裝備 → appearance（對不到的部位保留職業預設） */
export function equipToAppearance(equip, cls) {
  const app = defaultAppearance(cls);
  let matched = 0;
  for (const [slotKey, item] of equippedSlots(equip)) {
    const avSlot = SLOT_MAP[String(slotKey).toLowerCase()];
    if (!avSlot) continue;
    const id = findId(avSlot, item.name);
    if (id) {
      app[avSlot] = id;
      matched++;
      if (avSlot === "overall") { app.top = 0; app.bottom = 0; }
      if (avSlot === "top" || avSlot === "bottom") app.overall = 0;
    }
  }
  app._matched = matched;
  return app;
}
