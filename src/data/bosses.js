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
import { MAP_BC_ARENA } from "./maps.js";

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
    sprite: "pianus.png", // maplestory.io GMS83 8510000 stand (GIF bytes)
    spriteScale: 0.42,
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
    sprite: "papulatus.png", // maplestory.io GMS83 8500001 stand
    spriteScale: 0.55,
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
    sprite: "zakum.png", // maplestory.io 8800000 stand（完整本體＋雙手持板，不疊手臂零件）
    spriteScale: 0.42,
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
    sprite: "horntail.png", // full multi-head body art (not MS part ID wing/head only)
    spriteScale: 0.32,
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
    sprite: "pinkbean.png", // maplestory.io GMS83 8820001 stand
    spriteScale: 1.85,
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

// 動作突襲：每王難度倍率（由易到難）
const ACTION_BOSS_TIER = {
  boss_hainurs: 0.62,
  boss_papulatus: 0.82,
  boss_zakum: 1.0,
  boss_dark_dragon: 1.28,
  boss_pink_bean: 1.65,
};

/** 由玩家 profile 估每秒輸出（給 boss HP 縮放用） */
function estimateDps(p) {
  if (!p) return 60;
  const basic = ((p.basicMin || 20) + (p.basicMax || 30)) / 2 / Math.max(0.2, p.attackCd || 0.5);
  const skill = ((p.skillMin || 40) + (p.skillMax || 60)) / 2 / Math.max(1, p.skillCd || 3);
  return basic + skill;
}

/**
 * 建動作突襲用的 Boss（本機資料，不依賴 server）。
 * maxHp 依玩家 profile DPS × 目標秒數 × 難度倍率動態縮放 → 每王都是平衡戰。
 * 組隊時 partySize>1 會加大血量（見 launchActionRaid）。
 */
export function buildActionBoss(bossKey, profile, opts = {}) {
  const src = BOSSES[bossKey] || BOSSES.boss_zakum;
  const tier = ACTION_BOSS_TIER[bossKey] ?? 1.0;
  const fightSec = 42;
  const dps = estimateDps(profile);
  let maxHp = Math.round(dps * fightSec * tier);
  // 組隊：血量隨人數放大（略低於線性，鼓勵組隊）
  const party = Math.max(1, opts.partySize || 1);
  if (party > 1) maxHp = Math.round(maxHp * (1 + (party - 1) * 0.8));
  maxHp = Math.max(400, maxHp);
  return {
    id: src.id,
    botKey: src.botKey,
    nameZh: src.nameZh,
    region: src.region,
    regionZh: src.regionZh,
    tier: src.tier,
    color: src.color,
    armor: src.armor || 0.1,
    maxHp,
    sprite: src.sprite,
  };
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
  // 敵方城堡血量隨難度；貓咪大戰爭式推線
  const castleHp =
    tierCastleHp(meta.tier) * (0.9 + idx * 0.08);
  return {
    id: `arena-${id}`,
    index: 100 + Math.max(0, idx),
    code: codeByRegion[boss.region] || "ALTAR",
    name: `遠征 · ${boss.nameZh}`,
    nameEn: id,
    arena: true,
    bcMode: true,
    arenaBossId: id,
    briefing: `${meta.emoji} ${boss.regionZh || ""} · ${meta.blurb}。點職業卡出兵，推倒對方基地！`,
    coreHp: Math.max(12, Math.round(sc.core * 0.85)),
    teamLimit: 16,
    deploymentPoints: Math.max(18, Math.round(sc.pts * 1.2)),
    bcWalletMax: 60,
    enemyCastleHp: Math.round(castleHp),
    sellEnabled: false,
    hpScale: sc.hpScale * 0.92,
    speedScale: 0.95 + idx * 0.02,
    leakScale: 1 + idx * 0.04,
    map: MAP_BC_ARENA,
    waves: [
      {
        name: "先鋒線",
        intel: "點右側職業卡出兵 · 錢包會自動回復",
        groups: [
          g(0, "workflow", [["fire_boar", 6], ["stump", 5]], 0.7),
          g(2, "event", [["pig", 5], ["jr_wraith", 4]], 0.7),
        ],
      },
      {
        name: "加派援軍",
        intel: "敵人變強了，混編近戰遠程推線",
        groups: [
          g(0, "workflow", [["iron_hog", 2], ["hellhound", 3], ["dark_stump", 3]], 0.75),
          g(2, "event", [["drake", 3], ["red_drake", 2], ["wraith", 2]], 0.8),
          { at: 4, path: "workflow", units: [["bat", 7]], interval: 0.35 },
        ],
      },
      {
        name: `【Boss】${boss.nameZh}（${meta.tier || "?"}）`,
        intel: `${meta.blurb} · 打倒 Boss 並推倒敵方基地！`,
        groups: [
          g(0, "workflow", [[id, 1]], 1),
          g(4, "event", [["hellhound", 3], ["fire_boar", 4]], 0.7),
          g(8, "workflow", [["jr_wraith", 4], ["iron_hog", 2]], 0.85),
        ],
      },
    ],
    waveClearBonus: { 0: 3, 1: 4 },
    // 遠征不中斷選道具，保持推線節奏
    waveRewards: {},
  };
}

function tierCastleHp(tier) {
  switch (tier) {
    case "SSS":
      return 4200;
    case "SS":
      return 3200;
    case "S+":
      return 2600;
    case "S":
      return 2100;
    default:
      return 1800;
  }
}

export function listArenaStages() {
  return ARENA_BOSS_ROTATION.map((id) => buildArenaStage(id));
}
