/**
 * 世界地圖連結圖：經典楓之谷主城 + 城鎮間旅行傳送門拓樸。
 * 樞紐結構(符合真實地理)：自由市場→弓箭手村(維多利亞樞紐)→各城；港口市鎮⇄奧爾比斯(船,跨大陸)→冰封/玩具城。
 * name=中文名, region=大陸(決定傳送門顏色), links=可直達的地圖 id(合成旅行門,跨區用)。
 * 楓之島內部用「真實傳送門」(map.json 的 pt=2 portal)連接,不靠 links。
 */
export const WORLD = {
  "910000000": { name: "自由市場", region: "維多利亞", links: ["100000000", "000010000"] },
  "100000000": { name: "弓箭手村", region: "維多利亞", links: ["910000000", "100010000", "101000000", "102000000", "103000000", "104000000"] },
  "100010000": { name: "狩獵場", region: "維多利亞", combat: true, links: ["100000000"] },
  "101000000": { name: "魔法森林", region: "維多利亞", links: ["100000000"] },
  "102000000": { name: "勇士之村", region: "維多利亞", links: ["100000000"] },
  "103000000": { name: "墮落城市", region: "維多利亞", links: ["100000000"] },
  "104000000": { name: "港口市鎮", region: "維多利亞", links: ["100000000", "200000000"] },
  "200000000": { name: "奧爾比斯", region: "奧爾比斯", links: ["104000000", "211000000", "220000000"] },
  "211000000": { name: "冰封雪原", region: "奧爾比斯", links: ["200000000"] },
  "220000000": { name: "玩具城", region: "奧爾比斯", links: ["200000000"] },

  // ── 楓之島 Maple Island（新手起點，內部走真實傳送門）──
  "000010000": { name: "楓葉山丘", region: "楓之島" },
  "000020000": { name: "蝸牛公園", region: "楓之島", combat: true },
  "000030000": { name: "蝸牛花園", region: "楓之島", combat: true },
  "000040000": { name: "小森林", region: "楓之島", combat: true },
  "000050000": { name: "危險森林", region: "楓之島", combat: true },
  "000050001": { name: "南港西平原", region: "楓之島", combat: true },
  "000060000": { name: "南港", region: "楓之島", links: ["100000000"] }, // 出島→弓箭手村(Phase C 上閘門)
  "000060001": { name: "武器店", region: "楓之島" },
};

export const REGION_COLOR = {
  "維多利亞": "#7ed957",
  "奧爾比斯": "#5cc8ff",
  "楓之島": "#ffb84d",
};

// 首張家園(自由市場)——探險/塔防/突襲活動也掛在這
export const HOME_MAP = "910000000";

// 已解包、可進入的地圖集合（真實傳送門 warp 前檢查）
export const AVAILABLE_MAPS = new Set(Object.keys(WORLD));

/** 真實 portal 的 tm(數字，去零) → 9 碼 map id */
export function padMapId(tm) {
  return String(tm).padStart(9, "0");
}
