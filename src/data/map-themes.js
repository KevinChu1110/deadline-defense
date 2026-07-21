/**
 * 各地圖視覺主題（render 背景用）
 */
export const MAP_THEMES = {
  victoria: {
    id: "victoria",
    nameZh: "維多利亞港",
    sky: ["#7eb8e8", "#a8d4a0"],
    ground: ["#6aaa58", "#4a8a40"],
    accent: "#fbbf24",
    path: "dirt",
    decor: "trees",
    bgImage: "/maps/bg_victoria.jpg",
    bgAlpha: 0.45,
  },
  perion: {
    id: "perion",
    nameZh: "勇士部落",
    sky: ["#c4a574", "#e8c89a"],
    ground: ["#a67c52", "#8b5a2b"],
    accent: "#dc2626",
    path: "rock",
    decor: "rocks",
    bgAlpha: 0,
  },
  ellinia: {
    id: "ellinia",
    nameZh: "魔法森林",
    sky: ["#5b8c5a", "#2d5a3d"],
    ground: ["#3d6b4f", "#1a3d28"],
    accent: "#a78bfa",
    path: "moss",
    decor: "mushrooms",
    bgAlpha: 0,
  },
  orbis: {
    id: "orbis",
    nameZh: "愛奧斯塔",
    sky: ["#c7d2fe", "#e0e7ff"],
    ground: ["#e2e8f0", "#cbd5e1"],
    accent: "#818cf8",
    path: "cloud",
    decor: "clouds",
    bgAlpha: 0,
  },
  elnath: {
    id: "elnath",
    nameZh: "冰原雪域",
    sky: ["#e0f2fe", "#bae6fd"],
    ground: ["#f0f9ff", "#dbeafe"],
    accent: "#38bdf8",
    path: "ice",
    decor: "ice",
    bgAlpha: 0,
  },
  aqua: {
    id: "aqua",
    nameZh: "水下世界",
    sky: ["#0c4a6e", "#0369a1"],
    ground: ["#0e7490", "#155e75"],
    accent: "#22d3ee",
    path: "coral",
    decor: "bubbles",
    bgAlpha: 0,
  },
  ludi: {
    id: "ludi",
    nameZh: "玩具城",
    sky: ["#fce7f3", "#fbcfe8"],
    ground: ["#f9a8d4", "#f472b6"],
    accent: "#fb923c",
    path: "gear",
    decor: "gears",
    bgAlpha: 0,
  },
  leafre: {
    id: "leafre",
    nameZh: "神木村",
    sky: ["#365314", "#4d7c0f"],
    ground: ["#3f6212", "#365314"],
    accent: "#a3e635",
    path: "root",
    decor: "dragons",
    bgAlpha: 0,
  },
  altar: {
    id: "altar",
    nameZh: "神木祭壇",
    sky: ["#450a0a", "#7f1d1d"],
    ground: ["#292524", "#1c1917"],
    accent: "#ef4444",
    path: "lava",
    decor: "lava",
    bgAlpha: 0,
  },
};

/** stage id / map type → theme */
export function themeForStage(stage) {
  const code = (stage?.code || "").toUpperCase();
  const map = {
    VICTORIA: "victoria",
    PERION: "perion",
    ELLINIA: "ellinia",
    ORBIS: "orbis",
    SKY: "orbis",
    ELNATH: "elnath",
    AQUA: "aqua",
    LUDI: "ludi",
    LEAFRE: "leafre",
    ALTAR: "altar",
  };
  const key = map[code] || "victoria";
  return MAP_THEMES[key] || MAP_THEMES.victoria;
}
