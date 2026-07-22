/**
 * 五大 Boss — 地區／難度對齊 Discord bot（raid.js / adv-raid-data.json）
 *
 * | Boss     | 地區       | bot key / tier | 難度序 |
 * |----------|------------|----------------|--------|
 * | 海怒斯   | 水世界     | hainurs S 110  | 1 最易 |
 * | 拉圖斯   | 玩具城     | papulatus S 125| 2      |
 * | 殘暴炎魔 | 冰原雪域   | zakum S+ 140   | 3      |
 * | 暗黑龍王 | 神木村     | darkdragon SS 160 | 4   |
 * | 皮卡啾   | 時間神殿   | pinkbean SSS 180 | 5 最難 |
 */
import { MAP_ARENA } from "./maps.js";

const baseBoss = (p) => ({
  boss: true,
  tags: ["boss", ...(p.tags || [])],
  leakDamage: p.leakDamage ?? 8,
  ...p,
});

/**
 * 難度錨點（局內 base HP；再乘 stage.hpScale）
 * 對照 bot maxHp 比例粗略縮放：hainurs/zakum 20k、dark 23k、papu 45k、pink 48k
 * 皮卡啾必須最高。
 */
export const BOSSES = {
  // ── 水世界 · S · 海怒斯（bot: hainurs / pianus，深海巨怪）──
  boss_hainurs: baseBoss({
    id: "boss_hainurs",
    nameZh: "海怒斯",
    region: "aqua",
    regionZh: "水世界",
    tier: "S",
    botKey: "hainurs",
    color: "#1d4e89",
    radius: 32,
    hp: 3400,
    speed: 26,
    armor: 0.12,
    leakDamage: 9,
    sprite: "pianus.png",
    spriteScale: 1.65,
    tags: ["boss", "summoner", "dense"],
    phaseSpawns: [
      { at: 0.7, units: [["bubbling", 8], ["octopus", 1]], path: "both" },
      { at: 0.4, units: [["croco", 4], ["bubbling", 6]], path: "alt" },
      { at: 0.2, units: [["octopus", 2], ["croco", 3], ["slime", 6]], path: "both" },
    ],
    phaseBanner: [
      { at: 0.7, text: "海怒斯 · 召喚小怪" },
      { at: 0.4, text: "海怒斯 · 物理無效循環" },
      { at: 0.2, text: "海怒斯 · 千斤墜＋火柱" },
    ],
  }),

  // ── 玩具城 · S · 拉圖斯 ──
  boss_papulatus: baseBoss({
    id: "boss_papulatus",
    nameZh: "拉圖斯",
    region: "ludi",
    regionZh: "玩具城",
    tier: "S",
    botKey: "papulatus",
    color: "#c084fc",
    radius: 32,
    hp: 4000,
    speed: 28,
    armor: 0.15,
    leakDamage: 9,
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
      { at: 0.75, text: "拉圖斯 · 時鐘機甲" },
      { at: 0.5, text: "拉圖斯 · 本體彈出（加速）" },
      { at: 0.25, text: "拉圖斯 · 時空暫停＋反射" },
    ],
  }),

  // ── 冰原雪域 · S+ · 殘暴炎魔 ──
  boss_zakum: baseBoss({
    id: "boss_zakum",
    nameZh: "殘暴炎魔",
    region: "elnath",
    regionZh: "冰原雪域",
    tier: "S+",
    botKey: "zakum",
    color: "#ef4444",
    radius: 34,
    hp: 4800,
    speed: 24,
    armor: 0.22,
    leakDamage: 10,
    sprite: "zakum.png",
    spriteScale: 1.5,
    tags: ["boss", "armored", "summoner"],
    phaseSpawns: [
      { at: 0.7, units: [["fire_boar", 6], ["hellhound", 2]], path: "both" },
      { at: 0.45, units: [["jr_wraith", 6], ["red_drake", 2]], path: "both" },
      { at: 0.2, units: [["hellhound", 4], ["iron_hog", 3], ["fire_boar", 6]], path: "both" },
    ],
    phaseBanner: [
      { at: 0.7, text: "炎魔 · 八臂揮擊" },
      { at: 0.45, text: "炎魔 · 火柱／魔方" },
      { at: 0.2, text: "炎魔 · 暗黑詛咒" },
    ],
  }),

  // ── 神木村 · SS · 暗黑龍王（bot: darkdragon / 三頭）──
  boss_dark_dragon: baseBoss({
    id: "boss_dark_dragon",
    nameZh: "暗黑龍王",
    region: "leafre",
    regionZh: "神木村",
    tier: "SS",
    botKey: "darkdragon",
    color: "#312e81",
    radius: 35,
    hp: 5800,
    speed: 24,
    armor: 0.3,
    leakDamage: 11,
    sprite: "horntail.png",
    spriteScale: 1.75,
    tags: ["boss", "armored", "summoner", "dense"],
    // 左頭 → 右頭 → 本體（對齊 bot 多部位）
    phaseSpawns: [
      { at: 0.75, units: [["drake", 3], ["jr_wraith", 4]], path: "both" },
      { at: 0.5, units: [["red_drake", 3], ["hellhound", 3]], path: "alt" },
      { at: 0.25, units: [["drake", 4], ["red_drake", 3], ["iron_hog", 2]], path: "both" },
    ],
    phaseBanner: [
      { at: 0.75, text: "暗黑龍王 · 左頭劇毒" },
      { at: 0.5, text: "暗黑龍王 · 右頭雷電" },
      { at: 0.25, text: "暗黑龍王 · 本體龍息" },
    ],
  }),

  // ── 時間神殿 · SSS · 皮卡啾（最難）──
  boss_pink_bean: baseBoss({
    id: "boss_pink_bean",
    nameZh: "皮卡啾",
    region: "temple",
    regionZh: "時間神殿",
    tier: "SSS",
    botKey: "pinkbean",
    color: "#f9a8d4",
    radius: 32,
    hp: 7800,
    speed: 32,
    armor: 0.18,
    leakDamage: 14,
    sprite: "pepe.png",
    spriteScale: 2.4,
    tags: ["boss", "summoner", "swift"],
    hasteAura: 0.22,
    hasteRadius: 140,
    speedBurstAt: 0.4,
    speedBurstMult: 1.35,
    phaseSpawns: [
      { at: 0.8, units: [["slime", 10], ["pig", 5]], path: "both" },
      { at: 0.55, units: [["jr_wraith", 6], ["ribbon_pig", 5], ["bubbling", 4]], path: "both" },
      { at: 0.35, units: [["hellhound", 4], ["wraith", 3], ["slime", 8]], path: "alt" },
      { at: 0.15, units: [["hellhound", 5], ["red_drake", 3], ["iron_hog", 3], ["slime", 10]], path: "both" },
    ],
    splitOnDeath: { type: "slime", count: 8 },
    phaseBanner: [
      { at: 0.8, text: "皮卡啾 · 石像群" },
      { at: 0.55, text: "皮卡啾 · 封印／落石" },
      { at: 0.35, text: "皮卡啾 · 爆裂花瓣" },
      { at: 0.15, text: "皮卡啾 · 狂暴" },
    ],
  }),
};

/** 舊 id 相容：曾誤把海怒斯當 horntail */
BOSSES.boss_horntail = {
  ...BOSSES.boss_hainurs,
  id: "boss_horntail",
};

/** 競賽列表：由易到難（對齊 bot tier） */
export const ARENA_BOSS_ROTATION = [
  "boss_hainurs",
  "boss_papulatus",
  "boss_zakum",
  "boss_dark_dragon",
  "boss_pink_bean",
];

export const ARENA_BOSS_META = {
  boss_hainurs: {
    emoji: "🦑",
    blurb: "物理無效 · 嘴炮 · 火柱 · 千斤墜",
    regionZh: "水世界",
    tier: "S",
  },
  boss_papulatus: {
    emoji: "⏰",
    blurb: "時空暫停 · 反射 · 吸取血魔 · 黑球",
    regionZh: "玩具城",
    tier: "S",
  },
  boss_zakum: {
    emoji: "🔥",
    blurb: "八臂封印 · 火柱 · 魔方回血 · 詛咒",
    regionZh: "冰原雪域",
    tier: "S+",
  },
  boss_dark_dragon: {
    emoji: "🐉",
    blurb: "劇毒吐息 · 連鎖閃電 · 龍息 · 龍鱗反射",
    regionZh: "神木村",
    tier: "SS",
  },
  boss_pink_bean: {
    emoji: "🌸",
    blurb: "封印 · 落石 · 反盾 · 爆裂花瓣 · 狂暴",
    regionZh: "時間神殿",
    tier: "SSS",
  },
};

export function getArenaBossId(weekOffset = 0) {
  const day = Math.floor(Date.now() / 86400000) + weekOffset;
  return ARENA_BOSS_ROTATION[day % ARENA_BOSS_ROTATION.length];
}

const g = (at, path, units, interval = 0.9) => ({ at, path, units, interval });

/** 競賽難度：依 bot tier 調部署點／神木／波次壓 */
const ARENA_SCALE = {
  boss_hainurs: { core: 26, pts: 22, team: 9, hpScale: 1.0 },
  boss_papulatus: { core: 26, pts: 22, team: 9, hpScale: 1.05 },
  boss_zakum: { core: 28, pts: 24, team: 10, hpScale: 1.15 },
  boss_dark_dragon: { core: 30, pts: 24, team: 10, hpScale: 1.3 },
  boss_pink_bean: { core: 32, pts: 26, team: 10, hpScale: 1.55 },
};

/**
 * 建構競賽關：3 波（先鋒 → 加兵 → Boss）
 */
export function buildArenaStage(bossId) {
  const id = ARENA_BOSS_ROTATION.includes(bossId) ? bossId : getArenaBossId();
  const boss = BOSSES[id];
  const meta = ARENA_BOSS_META[id] || { emoji: "⚔️", blurb: "競賽 Boss" };
  const sc = ARENA_SCALE[id] || ARENA_SCALE.boss_hainurs;
  const idx = ARENA_BOSS_ROTATION.indexOf(id);
  // 地圖主題對齊地區
  const codeByRegion = {
    aqua: "AQUA",
    ludi: "LUDI",
    elnath: "ELNATH",
    leafre: "LEAFRE",
    temple: "TEMPLE",
  };
  return {
    id: `arena-${id}`,
    index: 100 + Math.max(0, idx),
    code: codeByRegion[boss.region] || "ALTAR",
    name: `競賽場 · ${boss.nameZh}`,
    nameEn: id,
    arena: true,
    arenaBossId: id,
    briefing: `${meta.emoji} ${boss.regionZh || ""} · ${meta.blurb}。3 波速決，分數進排行榜。`,
    coreHp: sc.core,
    teamLimit: sc.team,
    deploymentPoints: sc.pts,
    sellEnabled: true,
    hpScale: sc.hpScale,
    speedScale: 1 + idx * 0.02,
    leakScale: 1 + idx * 0.05,
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
        name: `【競賽Boss】${boss.nameZh}（${meta.tier || "?"}）`,
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
