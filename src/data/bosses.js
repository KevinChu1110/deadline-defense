/**
 * 五大競賽 Boss：拉圖斯 / 殘暴炎魔 / 暗黑龍王 / 皮卡啾 / 海怒斯
 * 可掛在 campaign 終關或排行挑戰關
 */
import { MAP_ARENA } from "./maps.js";

const baseBoss = (p) => ({
  boss: true,
  tags: ["boss", ...(p.tags || [])],
  leakDamage: p.leakDamage ?? 8,
  ...p,
});

export const BOSSES = {
  boss_papulatus: baseBoss({
    id: "boss_papulatus",
    nameZh: "拉圖斯",
    color: "#c084fc",
    radius: 32,
    hp: 3800,
    speed: 28,
    armor: 0.15,
    sprite: "papulatus.png",
    spriteScale: 1.55,
    tags: ["boss", "summoner"],
    speedBurstAt: 0.5,
    speedBurstMult: 1.45,
    phaseSpawns: [
      { at: 0.75, units: [["jr_wraith", 4], ["bat", 4]], path: "both" },
      { at: 0.5, units: [["wraith", 3], ["slime", 6]], path: "alt" },
      { at: 0.25, units: [["jr_wraith", 6], ["iron_hog", 2]], path: "both" },
    ],
    phaseBanner: [
      { at: 0.75, text: "拉圖斯 · 時鐘加速" },
      { at: 0.5, text: "拉圖斯 · 次元裂縫" },
      { at: 0.25, text: "拉圖斯 · 時間暴走" },
    ],
  }),

  boss_zakum: baseBoss({
    id: "boss_zakum",
    nameZh: "殘暴炎魔",
    color: "#ef4444",
    radius: 34,
    hp: 4200,
    speed: 24,
    armor: 0.22,
    sprite: "zakum.png",
    spriteScale: 1.5,
    tags: ["boss", "armored", "summoner"],
    phaseSpawns: [
      { at: 0.7, units: [["fire_boar", 6], ["hellhound", 2]], path: "both" },
      { at: 0.45, units: [["jr_wraith", 6], ["red_drake", 2]], path: "both" },
      { at: 0.2, units: [["hellhound", 4], ["iron_hog", 3], ["fire_boar", 6]], path: "both" },
    ],
    phaseBanner: [
      { at: 0.7, text: "炎魔 · 手臂甦醒" },
      { at: 0.45, text: "炎魔 · 煉獄" },
      { at: 0.2, text: "炎魔 · 最終審判" },
    ],
  }),

  boss_dark_dragon: baseBoss({
    id: "boss_dark_dragon",
    nameZh: "暗黑龍王",
    color: "#1e1b4b",
    radius: 33,
    hp: 4500,
    speed: 30,
    armor: 0.28,
    sprite: "red_drake.png",
    spriteScale: 2.0,
    tags: ["boss", "armored", "flyer"],
    flying: true,
    canGap: true,
    phaseSpawns: [
      { at: 0.65, units: [["drake", 4], ["red_drake", 2]], path: "both" },
      { at: 0.4, units: [["hellhound", 5]], path: "alt" },
      { at: 0.2, units: [["red_drake", 4], ["drake", 4]], path: "both" },
    ],
    phaseBanner: [
      { at: 0.65, text: "暗黑龍王 · 盤旋" },
      { at: 0.4, text: "暗黑龍王 · 落地狂襲" },
      { at: 0.2, text: "暗黑龍王 · 闇息" },
    ],
  }),

  boss_pink_bean: baseBoss({
    id: "boss_pink_bean",
    nameZh: "皮卡啾",
    color: "#f9a8d4",
    radius: 30,
    hp: 4000,
    speed: 36,
    sprite: "pepe.png",
    spriteScale: 2.3,
    tags: ["boss", "summoner", "swift"],
    hasteAura: 0.18,
    hasteRadius: 130,
    phaseSpawns: [
      { at: 0.8, units: [["slime", 8], ["pig", 4]], path: "both" },
      { at: 0.55, units: [["ribbon_pig", 6], ["bubbling", 4]], path: "alt" },
      { at: 0.3, units: [["slime", 10], ["hellhound", 2]], path: "both" },
    ],
    splitOnDeath: { type: "slime", count: 6 },
    phaseBanner: [
      { at: 0.8, text: "皮卡啾 · 惡作劇" },
      { at: 0.55, text: "皮卡啾 · 分身秀" },
      { at: 0.3, text: "皮卡啾 · 暴走" },
    ],
  }),

  boss_horntail: baseBoss({
    id: "boss_horntail",
    nameZh: "海怒斯",
    color: "#166534",
    radius: 36,
    hp: 5000,
    speed: 22,
    armor: 0.32,
    leakDamage: 12,
    sprite: "drake.png",
    spriteScale: 2.1,
    tags: ["boss", "armored", "summoner", "dense"],
    phaseSpawns: [
      { at: 0.75, units: [["drake", 3], ["red_drake", 2]], path: "both" },
      { at: 0.5, units: [["hellhound", 4], ["iron_hog", 3]], path: "alt" },
      { at: 0.35, units: [["wraith", 4], ["jr_wraith", 5]], path: "both" },
      { at: 0.15, units: [["red_drake", 5], ["hellhound", 4], ["iron_boar", 2]], path: "both" },
    ],
    phaseBanner: [
      { at: 0.75, text: "海怒斯 · 左頭甦醒" },
      { at: 0.5, text: "海怒斯 · 中頭" },
      { at: 0.35, text: "海怒斯 · 右頭" },
      { at: 0.15, text: "海怒斯 · 全力" },
    ],
  }),
};

/** 競賽模式 Boss 輪替表 */
export const ARENA_BOSS_ROTATION = [
  "boss_papulatus",
  "boss_zakum",
  "boss_dark_dragon",
  "boss_pink_bean",
  "boss_horntail",
];

export const ARENA_BOSS_META = {
  boss_papulatus: { emoji: "⏰", blurb: "時鐘相位 · 半血加速" },
  boss_zakum: { emoji: "🔥", blurb: "三階段手臂 · 煉獄加兵" },
  boss_dark_dragon: { emoji: "🐉", blurb: "飛行龍王 · 落地狂襲" },
  boss_pink_bean: { emoji: "💕", blurb: "惡作劇 · 分身與加速" },
  boss_horntail: { emoji: "🐲", blurb: "多頭甦醒 · 高防重壓" },
};

export function getArenaBossId(weekOffset = 0) {
  const day = Math.floor(Date.now() / 86400000) + weekOffset;
  return ARENA_BOSS_ROTATION[day % ARENA_BOSS_ROTATION.length];
}

const g = (at, path, units, interval = 0.9) => ({ at, path, units, interval });

/**
 * 建構競賽關：3 波（先鋒 → 加兵 → Boss）
 */
export function buildArenaStage(bossId) {
  const id = ARENA_BOSS_ROTATION.includes(bossId) ? bossId : getArenaBossId();
  const boss = BOSSES[id];
  const meta = ARENA_BOSS_META[id] || { emoji: "⚔️", blurb: "競賽 Boss" };
  const idx = ARENA_BOSS_ROTATION.indexOf(id);
  return {
    id: `arena-${id}`,
    index: 100 + Math.max(0, idx),
    code: "ALTAR",
    name: `競賽場 · ${boss.nameZh}`,
    nameEn: id,
    arena: true,
    arenaBossId: id,
    briefing: `${meta.emoji} ${boss.nameZh}：${meta.blurb}。3 波速決，分數進排行榜。`,
    coreHp: 28,
    teamLimit: 10,
    deploymentPoints: 24,
    sellEnabled: true,
    hpScale: 1.0,
    speedScale: 1.0,
    leakScale: 1.0,
    map: MAP_ARENA,
    waves: [
      {
        name: "先鋒試煉",
        intel: "清線賺楓幣，先把核心職業轉好。",
        groups: [
          g(0, "workflow", [["fire_boar", 5], ["stump", 4]], 0.75),
          g(0, "event", [["jr_wraith", 5], ["pig", 4]], 0.75),
        ],
      },
      {
        name: "王前加兵",
        intel: "高威脅混合潮，注意護甲與隱形。",
        groups: [
          g(0, "workflow", [["iron_hog", 2], ["hellhound", 3], ["dark_stump", 3]], 0.8),
          g(0, "event", [["drake", 3], ["red_drake", 2], ["wraith", 2]], 0.85),
          { at: 3, path: "workflow", units: [["bat", 8]], interval: 0.4, distanceRatio: 0.5 },
        ],
      },
      {
        name: `【競賽Boss】${boss.nameZh}`,
        intel: `${meta.blurb}。守住神木！`,
        groups: [
          g(0, "workflow", [[id, 1]], 1),
          g(3, "event", [["hellhound", 3], ["fire_boar", 4]], 0.75),
          g(6, "workflow", [["jr_wraith", 4], ["iron_hog", 2]], 0.9),
        ],
      },
    ],
    waveClearBonus: { 0: 2, 1: 3 },
    waveRewards: {
      0: ["espresso", "keyboard", "sticky"],
      1: ["stapler", "firewall", "backup"],
    },
  };
}

export function listArenaStages() {
  return ARENA_BOSS_ROTATION.map((id) => buildArenaStage(id));
}
