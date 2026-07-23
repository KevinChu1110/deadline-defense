/**
 * 神木防衛戰役：10 關 × 10 波 = 100 波
 * 每關 W5 中 Boss、W10 終關 Boss
 */
import {
  MAP_SINGLE,
  MAP_DUAL,
  MAP_DUAL_SHORTCUT,
  MAP_TRIPLE,
  MAP_ARENA,
  MAP_CROSS,
  MAP_SERPENTINE,
  MAP_SPIRAL,
} from "./maps.js";

const g = (at, path, units, interval = 0.9) => ({ at, path, units, interval });
const W = (name, intel, groups) => ({ name, intel, groups });

/** @type {Array<{hp:number,spd:number,leak:number,pts:number,core:number,team:number}>} */
export const STAGE_SCALES = [
  { hp: 1.0, spd: 1.0, leak: 1.0, pts: 12, core: 20, team: 6 },
  { hp: 1.15, spd: 1.02, leak: 1.0, pts: 13, core: 22, team: 7 },
  { hp: 1.3, spd: 1.04, leak: 1.0, pts: 14, core: 22, team: 7 },
  { hp: 1.5, spd: 1.06, leak: 1.1, pts: 15, core: 24, team: 8 },
  { hp: 1.75, spd: 1.05, leak: 1.1, pts: 16, core: 24, team: 8 },
  { hp: 2.0, spd: 1.1, leak: 1.2, pts: 17, core: 26, team: 8 },
  { hp: 2.3, spd: 1.08, leak: 1.2, pts: 18, core: 26, team: 9 },
  { hp: 2.7, spd: 1.1, leak: 1.3, pts: 20, core: 28, team: 9 },
  { hp: 3.2, spd: 1.12, leak: 1.3, pts: 22, core: 30, team: 10 },
  { hp: 3.8, spd: 1.15, leak: 1.5, pts: 24, core: 32, team: 10 },
  // ── 第二章 英雄的試煉（11~15）：延續終章難度再往上，給高轉/英雄職發揮 ──
  { hp: 4.6, spd: 1.16, leak: 1.5, pts: 26, core: 34, team: 11 },
  { hp: 5.5, spd: 1.18, leak: 1.6, pts: 27, core: 34, team: 11 },
  { hp: 6.6, spd: 1.2, leak: 1.7, pts: 28, core: 36, team: 12 },
  { hp: 7.8, spd: 1.22, leak: 1.8, pts: 30, core: 38, team: 12 },
  { hp: 9.5, spd: 1.25, leak: 2.0, pts: 32, core: 40, team: 12 },
];

function stage(cfg) {
  const sc = STAGE_SCALES[cfg.index];
  return {
    id: cfg.id,
    index: cfg.index,
    code: cfg.code,
    name: cfg.name,
    nameEn: cfg.nameEn || cfg.code,
    briefing: cfg.briefing,
    coreHp: sc.core,
    teamLimit: sc.team,
    deploymentPoints: sc.pts,
    sellEnabled: true,
    hpScale: sc.hp,
    speedScale: sc.spd,
    leakScale: sc.leak,
    map: cfg.map,
    waves: cfg.waves,
    waveClearBonus: cfg.waveClearBonus || {
      1: 1,
      3: 2,
      5: 2,
      7: 2,
    },
    waveRewards: cfg.waveRewards || {
      2: ["espresso", "keyboard", "sticky"],
      5: ["stapler", "powerBank", "backup"],
      8: ["firewall", "copier", "espresso"],
    },
  };
}

// ═══════════════════════════════════════
// Stage 01 維多利亞港 — 教學
// ═══════════════════════════════════════
const S01_WAVES = [
  W("第一批蝸牛", "部署初心者清怪賺楓幣，存到能一轉！", [g(0, "workflow", [["snail", 10]], 0.9)]),
  W("【教學】破甲", "木妖有裝甲：轉戰士線或破甲技能效率更高。", [
    g(0, "workflow", [["stump", 5]], 1.2),
    g(2, "workflow", [["snail", 6]], 0.85),
  ]),
  W("【教學】破隱", "黑木妖隱形：神射／主教／僧侶才能鎖定。", [
    g(0, "workflow", [["dark_stump", 5]], 1.1),
    g(1.5, "workflow", [["snail", 6]], 0.75),
  ]),
  W("厚血登場", "藍菇耐久，注意集火。", [g(0, "workflow", [["blue_mushroom", 7]], 1.0)]),
  W("【中Boss】菇菇隊長", "半血會招綠菇潮！", [
    g(0, "workflow", [["mid_elite_mushroom", 1]], 1),
    g(2, "workflow", [["green_mushroom", 6]], 0.7),
  ]),
  W("喘息波", "清線補部署。", [g(0, "workflow", [["snail", 12]], 0.6)]),
  W("復活初體驗", "綠水靈會死而復生一次。", [
    g(0, "workflow", [["slime", 7]], 1.0),
    g(2, "workflow", [["stump", 3]], 1.3),
  ]),
  W("綜合小考", "全機制混合。", [
    g(0, "workflow", [
      ["snail", 5],
      ["dark_stump", 3],
      ["blue_mushroom", 3],
      ["slime", 3],
    ], 0.75),
  ]),
  W("王前哨", "肥肥與隱形。", [
    g(0, "workflow", [["pig", 8]], 0.85),
    g(2, "workflow", [["dark_stump", 4]], 1.0),
  ]),
  W("【Boss】肥肥王", "半血召喚緞帶肥肥，並自癒一次。", [
    g(0, "workflow", [["boss_pig_king", 1]], 1),
    g(3, "workflow", [["snail", 8], ["pig", 4]], 0.7),
  ]),
];

// ═══════════════════════════════════════
// Stage 02 勇士部落 — 雙路
// ═══════════════════════════════════════
const S02_WAVES = [
  W("上路試探", "敵人走上路。", [g(0, "workflow", [["snail", 8]], 0.85)]),
  W("下路試探", "敵人走下路。", [g(0, "event", [["pig", 7]], 0.9)]),
  W("雙路同時", "上下一起來！", [
    g(0, "workflow", [["snail", 7]], 0.8),
    g(0.3, "event", [["snail", 7]], 0.8),
  ]),
  W("分路隱形", "上路隱形、下路厚血。", [
    g(0, "workflow", [["dark_stump", 5]], 1.0),
    g(0, "event", [["blue_mushroom", 5]], 1.1),
  ]),
  W("【中Boss】幽靈精英", "高速幽靈走下路！", [
    g(0, "event", [["mid_wraith", 1]], 1),
    g(1, "workflow", [["stump", 4]], 1.2),
    g(2, "event", [["jr_wraith", 5]], 0.7),
  ]),
  W("喘息", "雙路小怪。", [
    g(0, "workflow", [["snail", 8]], 0.65),
    g(0, "event", [["snail", 8]], 0.65),
  ]),
  W("復活雙線", "綠水靈分路壓制。", [
    g(0, "workflow", [["slime", 6]], 0.9),
    g(0.4, "event", [["slime", 6], ["pig", 3]], 0.85),
  ]),
  W("高壓雙路", "大量混合。", [
    g(0, "workflow", [["dark_stump", 4], ["blue_mushroom", 4]], 0.75),
    g(0, "event", [["jr_wraith", 5], ["stump", 3]], 0.7),
  ]),
  W("王前哨", "坦克試探。", [
    g(0, "workflow", [["stone_golem", 2]], 2.5),
    g(1, "event", [["pig", 8]], 0.7),
  ]),
  W("【Boss】石巨人王", "高護甲；半血會在另一路刷木妖。", [
    g(0, "workflow", [["boss_golem_king", 1]], 1),
    g(2, "event", [["jr_wraith", 6], ["pig", 5]], 0.65),
  ]),
];

// ═══════════════════════════════════════
// Stage 03 魔法森林 — 隱形復活
// ═══════════════════════════════════════
const S03_WAVES = [
  W("林間蝸牛", "單路推進。", [g(0, "workflow", [["snail", 10]], 0.75)]),
  W("捷徑幽靈", "捷徑路出現幽靈。", [
    g(0, "workflow", [["stump", 4]], 1.1),
    g(1, "event", [["jr_wraith", 5]], 0.8),
  ]),
  W("黑木妖林", "大量隱形。", [g(0, "workflow", [["dark_stump", 8]], 0.9)]),
  W("復活潮", "殭屍菇與水靈。", [
    g(0, "workflow", [["zombie_mushroom", 6], ["slime", 5]], 0.85),
  ]),
  W("【中Boss】暗黑木妖長", "隱形高血精英。", [
    g(0, "workflow", [["mid_dark_stump", 1]], 1),
    g(2, "event", [["dark_stump", 5]], 0.9),
    g(3, "workflow", [["slime", 4]], 0.8),
  ]),
  W("喘息", "綠菇群。", [g(0, "workflow", [["green_mushroom", 14]], 0.55)]),
  W("雙機制", "隱形+復活。", [
    g(0, "workflow", [["dark_stump", 5], ["zombie_mushroom", 5]], 0.8),
    g(2, "event", [["slime", 5]], 0.85),
  ]),
  W("森林狂潮", "混合壓制。", [
    g(0, "workflow", [["stump", 4], ["blue_mushroom", 4], ["dark_stump", 4]], 0.7),
    g(1, "event", [["jr_wraith", 5]], 0.65),
  ]),
  W("王前哨", "厚復活線。", [
    g(0, "workflow", [["zombie_mushroom", 8]], 0.75),
    g(2, "event", [["wraith", 3]], 1.0),
  ]),
  W("【Boss】殭屍菇王", "隱形 Boss；死亡分裂 4 殭屍菇。", [
    g(0, "workflow", [["boss_zombie_shroom", 1]], 1),
    g(3, "workflow", [["slime", 6]], 0.7),
    g(3, "event", [["dark_stump", 4]], 0.85),
  ]),
];

// ═══════════════════════════════════════
// Stage 04 愛奧斯塔 — 空降（distanceRatio）
// ═══════════════════════════════════════
const S04_WAVES = [
  W("雙路蝸牛", "基本雙路。", [
    g(0, "workflow", [["snail", 8]], 0.8),
    g(0, "event", [["snail", 8]], 0.8),
  ]),
  W("空降預告", "蝙蝠從中段出現！", [
    g(0, "workflow", [["pig", 5]], 0.9),
    { at: 1.5, path: "workflow", units: [["bat", 6]], interval: 0.5, distanceRatio: 0.5 },
  ]),
  W("上下空降", "雙路中段蝠群。", [
    { at: 0, path: "workflow", units: [["bat", 7]], interval: 0.55, distanceRatio: 0.45 },
    { at: 0.5, path: "event", units: [["bat", 7]], interval: 0.55, distanceRatio: 0.45 },
  ]),
  W("企鵝與蝠", "企鵝抗減速。", [
    g(0, "workflow", [["pepe", 6]], 1.0),
    { at: 2, path: "event", units: [["bat", 6]], interval: 0.5, distanceRatio: 0.55 },
  ]),
  W("【中Boss】蝠群母體", "半血空降大蝠群。", [
    g(0, "workflow", [["mid_bat_swarm", 1]], 1),
    g(2, "event", [["pepe", 4]], 1.0),
  ]),
  W("喘息", "地面為主。", [
    g(0, "workflow", [["snail", 10]], 0.6),
    g(0, "event", [["pig", 6]], 0.8),
  ]),
  W("夾擊", "起點+空降。", [
    g(0, "workflow", [["stump", 4]], 1.1),
    g(0, "event", [["blue_mushroom", 4]], 1.0),
    { at: 2, path: "workflow", units: [["bat", 8]], interval: 0.45, distanceRatio: 0.6 },
  ]),
  W("高壓空降", "Core 前蝙蝠。", [
    { at: 0, path: "workflow", units: [["bat", 10]], interval: 0.4, distanceRatio: 0.65 },
    { at: 0, path: "event", units: [["bat", 10]], interval: 0.4, distanceRatio: 0.65 },
    g(3, "workflow", [["pepe", 5]], 0.85),
  ]),
  W("王前哨", "全線混合。", [
    g(0, "workflow", [["pig", 6], ["pepe", 4]], 0.75),
    { at: 1, path: "event", units: [["bat", 8]], interval: 0.45, distanceRatio: 0.5 },
  ]),
  W("【Boss】蝙蝠王", "每掉 25% HP 空降蝠群。", [
    g(0, "workflow", [["boss_bat_king", 1]], 1),
    g(2, "event", [["pepe", 5], ["jr_wraith", 4]], 0.75),
  ]),
];

// ═══════════════════════════════════════
// Stage 05 天空之城 — 護甲
// ═══════════════════════════════════════
const S05_WAVES = [
  W("鐵皮試探", "石巨人登場。", [g(0, "workflow", [["stone_golem", 3]], 2.2)]),
  W("雙路護甲", "雙路坦克。", [
    g(0, "workflow", [["stone_golem", 2]], 2.4),
    g(0, "event", [["iron_hog", 2]], 2.2),
  ]),
  W("甲+雜兵", "坦克掩護蝸牛。", [
    g(0, "workflow", [["stone_golem", 2], ["snail", 10]], 0.7),
    g(1, "event", [["iron_hog", 2], ["pig", 6]], 0.8),
  ]),
  W("鱷魚線", "中甲鱷魚。", [
    g(0, "workflow", [["croco", 6]], 1.0),
    g(0, "event", [["blue_mushroom", 6]], 0.9),
  ]),
  W("【中Boss】鋼鐵豬精英", "超高護甲，破甲職業優先。", [
    g(0, "workflow", [["mid_iron_hog", 1]], 1),
    g(2, "event", [["iron_hog", 2], ["snail", 8]], 0.7),
  ]),
  W("喘息", "低甲波。", [
    g(0, "workflow", [["green_mushroom", 12]], 0.55),
    g(0, "event", [["pig", 8]], 0.7),
  ]),
  W("裝甲牆", "多坦克。", [
    g(0, "workflow", [["stone_golem", 3], ["croco", 3]], 1.2),
    g(0, "event", [["iron_hog", 3], ["stump", 4]], 1.1),
  ]),
  W("破甲考試", "全高甲。", [
    g(0, "workflow", [["iron_hog", 4]], 1.4),
    g(0, "event", [["stone_golem", 3], ["croco", 4]], 1.2),
  ]),
  W("王前哨", "甲+速。", [
    g(0, "workflow", [["iron_hog", 3], ["fire_boar", 4]], 0.9),
    g(1, "event", [["stone_golem", 2], ["jr_wraith", 5]], 0.75),
  ]),
  W("【Boss】混混石像鬼", "高甲；低血時降甲加速狂暴。", [
    g(0, "workflow", [["boss_stone_gargoyle", 1]], 1),
    g(3, "event", [["iron_hog", 3], ["croco", 4]], 1.0),
  ]),
];

// ═══════════════════════════════════════
// Stage 06 冰原 — 抗緩光環
// ═══════════════════════════════════════
const S06_WAVES = [
  W("雪原蝸牛", "長路推進。", [g(0, "workflow", [["snail", 12]], 0.7)]),
  W("企鵝行軍", "企鵝抗減速。", [g(0, "workflow", [["pepe", 9]], 0.9)]),
  W("冰眼現身", "優先擊殺冰冷之眼！", [
    g(0, "workflow", [["cold_eye", 2], ["pepe", 6]], 1.0),
  ]),
  W("加速潮", "光環+雜兵。", [
    g(0, "workflow", [["cold_eye", 3], ["snail", 10], ["pig", 5]], 0.7),
  ]),
  W("【中Boss】冰眼監護", "強光環加速全場。", [
    g(0, "workflow", [["mid_cold_eye", 1]], 1),
    g(1, "workflow", [["pepe", 8], ["jr_wraith", 4]], 0.7),
  ]),
  W("喘息", "無光環。", [g(0, "workflow", [["green_mushroom", 16]], 0.5)]),
  W("雙冰眼", "兩隻光環。", [
    g(0, "workflow", [["cold_eye", 2]], 2.5),
    g(1, "workflow", [["pepe", 8], ["blue_mushroom", 4]], 0.75),
  ]),
  W("雪暴", "混合。", [
    g(0, "workflow", [["cold_eye", 2], ["pepe", 6], ["fire_boar", 4], ["stump", 3]], 0.7),
  ]),
  W("王前哨", "高速抗緩。", [
    g(0, "workflow", [["pepe", 10], ["jr_wraith", 6]], 0.65),
    g(3, "workflow", [["cold_eye", 2]], 2.0),
  ]),
  W("【Boss】殘暴炎魔", "冰原雪域之王！手臂甦醒三階段。", [
    g(0, "workflow", [["boss_zakum", 1]], 1),
    g(3, "workflow", [["pepe", 6], ["fire_boar", 5]], 0.65),
    g(6, "workflow", [["hellhound", 3], ["cold_eye", 1]], 0.9),
  ]),
];

// ═══════════════════════════════════════
// Stage 07 水下 — 召喚
// ═══════════════════════════════════════
const S07_WAVES = [
  W("雙路開場", "基本。", [
    g(0, "workflow", [["bubbling", 8]], 0.75),
    g(0, "event", [["snail", 8]], 0.75),
  ]),
  W("章魚登場", "先殺召喚源！", [
    g(0, "workflow", [["octopus", 2]], 3.0),
    g(1, "event", [["bubbling", 6]], 0.7),
  ]),
  W("雙召喚", "兩路各一章魚。", [
    g(0, "workflow", [["octopus", 2]], 2.8),
    g(0, "event", [["octopus", 2]], 2.8),
  ]),
  W("鱷魚水域", "甲+召喚。", [
    g(0, "workflow", [["croco", 5]], 1.0),
    g(1, "event", [["octopus", 2], ["bubbling", 6]], 0.8),
  ]),
  W("【中Boss】觸手精英", "持續召喚蝸牛。", [
    g(0, "workflow", [["mid_octopus", 1]], 1),
    g(2, "event", [["croco", 4], ["bubbling", 6]], 0.75),
  ]),
  W("喘息", "無召喚。", [
    g(0, "workflow", [["bubbling", 12]], 0.55),
    g(0, "event", [["pig", 8]], 0.7),
  ]),
  W("召喚牆", "多章魚。", [
    g(0, "workflow", [["octopus", 3]], 2.2),
    g(0, "event", [["octopus", 2], ["slime", 4]], 1.0),
  ]),
  W("深海壓制", "混合。", [
    g(0, "workflow", [["octopus", 2], ["croco", 4], ["bubbling", 8]], 0.7),
    g(0, "event", [["octopus", 2], ["jr_wraith", 5]], 0.75),
  ]),
  W("王前哨", "召喚+復活。", [
    g(0, "workflow", [["octopus", 2], ["zombie_mushroom", 5]], 0.85),
    g(0, "event", [["octopus", 2], ["slime", 5]], 0.85),
  ]),
  W("【Boss】海怒斯", "水世界深海巨怪！觸手潮湧與召喚。", [
    g(0, "workflow", [["boss_hainurs", 1]], 1),
    g(2, "event", [["octopus", 2], ["bubbling", 8]], 0.7),
    g(5, "workflow", [["croco", 4], ["bubbling", 6]], 0.75),
  ]),
];

// ═══════════════════════════════════════
// Stage 08 玩具城 — 三路
// ═══════════════════════════════════════
const S08_WAVES = [
  W("上路", "三路教學·上。", [g(0, "workflow", [["snail", 8]], 0.8)]),
  W("中路", "三路教學·中。", [g(0, "event", [["pig", 8]], 0.85)]),
  W("下路", "三路教學·下。", [g(0, "pathC", [["green_mushroom", 10]], 0.7)]),
  W("三路同時", "全面開戰！", [
    g(0, "workflow", [["snail", 6]], 0.75),
    g(0, "event", [["pig", 6]], 0.75),
    g(0, "pathC", [["stump", 4]], 1.0),
  ]),
  W("【中Boss】工廠監工", "三路壓力精英。", [
    g(0, "event", [["mid_triple_elite", 1]], 1),
    g(1, "workflow", [["fire_boar", 4]], 0.8),
    g(1, "pathC", [["iron_hog", 2]], 1.5),
  ]),
  W("喘息", "三路小怪。", [
    g(0, "workflow", [["snail", 8]], 0.6),
    g(0, "event", [["snail", 8]], 0.6),
    g(0, "pathC", [["snail", 8]], 0.6),
  ]),
  W("裝甲三路", "護甲分散。", [
    g(0, "workflow", [["iron_hog", 2]], 2.0),
    g(0, "event", [["stone_golem", 2]], 2.0),
    g(0, "pathC", [["croco", 4]], 1.0),
  ]),
  W("工廠狂潮", "大量三路。", [
    g(0, "workflow", [["fire_boar", 5], ["pig", 4]], 0.65),
    g(0, "event", [["jr_wraith", 5], ["blue_mushroom", 4]], 0.65),
    g(0, "pathC", [["slime", 5], ["stump", 3]], 0.7),
  ]),
  W("王前哨", "三路精英包。", [
    g(0, "workflow", [["iron_hog", 2], ["fire_boar", 4]], 0.85),
    g(0, "event", [["stone_golem", 2], ["pig", 5]], 0.85),
    g(0, "pathC", [["croco", 4], ["jr_wraith", 4]], 0.75),
  ]),
  W("【Boss】拉圖斯", "玩具城時空之鐘！半血加速與次元裂縫。", [
    g(0, "event", [["boss_papulatus", 1]], 1),
    g(2, "workflow", [["jr_wraith", 5], ["bat", 4]], 0.7),
    g(2, "pathC", [["slime", 6], ["iron_hog", 1]], 0.75),
  ]),
];

// ═══════════════════════════════════════
// Stage 09 神木村 — 換路
// ═══════════════════════════════════════
const S09_WAVES = [
  W("雙路開場", "基本。", [
    g(0, "workflow", [["snail", 10]], 0.7),
    g(0, "event", [["pig", 8]], 0.75),
  ]),
  W("飛龍換路", "飛龍會中途換線！", [
    g(0, "workflow", [["drake", 5]], 1.1),
    g(1, "event", [["stump", 4]], 1.1),
  ]),
  W("紅龍群", "換路壓制。", [
    g(0, "workflow", [["red_drake", 4]], 1.0),
    g(0, "event", [["drake", 4]], 1.0),
  ]),
  W("幽靈換路", "隱形+換路。", [
    g(0, "workflow", [["wraith", 4]], 1.0),
    g(0, "event", [["jr_wraith", 6]], 0.75),
  ]),
  W("【中Boss】幽靈副官", "換路隱形精英。", [
    g(0, "workflow", [["mid_ghost_lieutenant", 1]], 1),
    g(2, "event", [["drake", 4], ["dark_stump", 4]], 0.85),
  ]),
  W("喘息", "少換路。", [
    g(0, "workflow", [["green_mushroom", 12]], 0.55),
    g(0, "event", [["pig", 8]], 0.7),
  ]),
  W("龍與甲", "換路+護甲。", [
    g(0, "workflow", [["drake", 4], ["iron_hog", 2]], 1.0),
    g(0, "event", [["red_drake", 4], ["stone_golem", 2]], 1.0),
  ]),
  W("混亂航線", "大量換路單位。", [
    g(0, "workflow", [["drake", 5], ["wraith", 3], ["jr_wraith", 4]], 0.7),
    g(0, "event", [["red_drake", 5], ["dark_stump", 4]], 0.7),
  ]),
  W("王前哨", "地獄犬+龍。", [
    g(0, "workflow", [["hellhound", 4], ["drake", 3]], 0.8),
    g(0, "event", [["hellhound", 3], ["red_drake", 3]], 0.8),
  ]),
  W("【Boss】暗黑龍王", "神木村三頭龍王！左頭→右頭→本體。", [
    g(0, "workflow", [["boss_dark_dragon", 1]], 1),
    g(2, "event", [["drake", 4], ["hellhound", 3]], 0.75),
    g(5, "workflow", [["red_drake", 3], ["jr_wraith", 5]], 0.8),
  ]),
];

// ═══════════════════════════════════════
// Stage 10 神木祭壇 — 終章
// ═══════════════════════════════════════
const S10_WAVES = [
  W("回顧·隱形", "破隱測試。", [
    g(0, "workflow", [["dark_stump", 6], ["wraith", 3]], 0.8),
    g(0, "event", [["dark_stump", 6]], 0.8),
  ]),
  W("回顧·復活護甲", "混合。", [
    g(0, "workflow", [["zombie_mushroom", 5], ["iron_hog", 2]], 0.9),
    g(0, "event", [["slime", 5], ["stone_golem", 2]], 0.9),
  ]),
  W("回顧·空降", "中段蝙蝠。", [
    { at: 0, path: "workflow", units: [["bat", 10]], interval: 0.4, distanceRatio: 0.5 },
    { at: 0, path: "event", units: [["bat", 10]], interval: 0.4, distanceRatio: 0.5 },
  ]),
  W("召喚+換路", "章魚與飛龍。", [
    g(0, "workflow", [["octopus", 2], ["drake", 3]], 1.0),
    g(0, "event", [["octopus", 2], ["red_drake", 3]], 1.0),
  ]),
  W("【中Boss】神殿守衛", "時間神殿先遣 · 隱形與召喚。", [
    g(0, "workflow", [["mid_ghost_lieutenant", 1]], 1),
    g(2, "event", [["hellhound", 4], ["dark_stump", 5]], 0.7),
  ]),
  W("最後喘息", "補陣形。", [
    g(0, "workflow", [["pig", 10]], 0.6),
    g(0, "event", [["green_mushroom", 12]], 0.55),
  ]),
  W("機制融合 A", "光環+召喚+隱形。", [
    g(0, "workflow", [["cold_eye", 2], ["octopus", 1], ["dark_stump", 4]], 0.85),
    g(0, "event", [["cold_eye", 1], ["wraith", 3], ["iron_hog", 2]], 0.9),
  ]),
  W("機制融合 B", "空降+換路+護甲。", [
    { at: 0, path: "workflow", units: [["bat", 8]], interval: 0.4, distanceRatio: 0.55 },
    g(0, "event", [["drake", 4], ["iron_hog", 2]], 0.85),
    g(2, "workflow", [["fire_boar", 5], ["hellhound", 2]], 0.7),
  ]),
  W("神殿狂潮", "全機制壓力 · 皮卡啾前哨。", [
    g(0, "workflow", [
      ["hellhound", 3],
      ["wraith", 3],
      ["iron_hog", 2],
      ["dark_stump", 3],
    ], 0.65),
    g(0, "event", [
      ["jr_wraith", 5],
      ["red_drake", 2],
      ["slime", 6],
      ["octopus", 1],
    ], 0.7),
    { at: 4, path: "workflow", units: [["bat", 8]], interval: 0.35, distanceRatio: 0.6 },
  ]),
  W("【最終Boss】皮卡啾", "時間神殿 SSS · 石像→女神→本體狂暴。全作最難！", [
    g(0, "workflow", [["boss_pink_bean", 1]], 1),
    g(3, "event", [["slime", 8], ["jr_wraith", 5]], 0.65),
    g(6, "workflow", [["hellhound", 4], ["iron_hog", 2]], 0.8),
    g(9, "event", [["red_drake", 3], ["wraith", 3]], 0.85),
  ]),
];

// ═══════════════════════════════════════
// 第二章 · Stage 11 幽靈船 — 幽靈船長（十字交叉）
// ═══════════════════════════════════════
const S11_WAVES = [
  W("死者甲板", "十字交叉路：中央交會點是關鍵防守位。", [
    g(0, "workflow", [["wraith", 5]], 0.9),
    g(0, "event", [["jr_wraith", 7]], 0.75),
  ]),
  W("幽靈潮", "兩路湧上，交會點集火。", [
    g(0, "workflow", [["jr_wraith", 8]], 0.7),
    g(0.4, "event", [["wraith", 5]], 0.9),
  ]),
  W("隱形甲板", "黑木妖混入。", [
    g(0, "workflow", [["dark_stump", 6]], 0.9),
    g(0, "event", [["wraith", 4], ["jr_wraith", 5]], 0.75),
  ]),
  W("鋼鐵水手", "護甲單位登場。", [
    g(0, "workflow", [["iron_hog", 3]], 1.6),
    g(0, "event", [["croco", 5]], 1.0),
  ]),
  W("【中Boss】亡魂副官", "隱形高血精英，交會點爆發。", [
    g(0, "workflow", [["mid_ghost_lieutenant", 1]], 1),
    g(2, "event", [["wraith", 5], ["dark_stump", 4]], 0.8),
  ]),
  W("喘息", "補陣形。", [
    g(0, "workflow", [["green_mushroom", 14]], 0.55),
    g(0, "event", [["pig", 8]], 0.7),
  ]),
  W("幽靈與甲", "隱形＋護甲雙壓。", [
    g(0, "workflow", [["wraith", 5], ["iron_hog", 2]], 0.9),
    g(0, "event", [["jr_wraith", 6], ["stone_golem", 2]], 0.9),
  ]),
  W("亡靈狂潮", "大量混合。", [
    g(0, "workflow", [["wraith", 6], ["dark_stump", 5], ["hellhound", 3]], 0.65),
    g(0, "event", [["jr_wraith", 8], ["iron_hog", 2]], 0.65),
  ]),
  W("船長前哨", "地獄犬護衛。", [
    g(0, "workflow", [["hellhound", 5]], 0.8),
    g(0, "event", [["wraith", 5], ["croco", 4]], 0.8),
  ]),
  W("【Boss】幽靈船長", "巴洛古船長！隱形突進與亡魂召喚。", [
    g(0, "workflow", [["boss_ghost_captain", 1]], 1),
    g(2, "event", [["wraith", 4], ["hellhound", 3]], 0.75),
    g(5, "workflow", [["jr_wraith", 6], ["dark_stump", 4]], 0.8),
  ]),
];

// ═══════════════════════════════════════
// 第二章 · Stage 12 冰封巨塔 — 雪吉拉王（長蛇）
// ═══════════════════════════════════════
const S12_WAVES = [
  W("蜿蜒雪道", "超長 S 形路：善用全場開火時間。", [g(0, "workflow", [["pepe", 12]], 0.7)]),
  W("冰眼加速", "光環加速全場，優先擊殺。", [
    g(0, "workflow", [["cold_eye", 3], ["pepe", 8]], 0.8),
  ]),
  W("霜甲行軍", "抗緩＋護甲。", [
    g(0, "workflow", [["pepe", 8], ["iron_hog", 3]], 0.85),
  ]),
  W("寒冰復活", "殭屍菇混雪原。", [
    g(0, "workflow", [["zombie_mushroom", 8], ["pepe", 6]], 0.8),
  ]),
  W("【中Boss】冰眼統帥", "全場強光環＋高血。", [
    g(0, "workflow", [["mid_cold_eye", 1]], 1),
    g(2, "workflow", [["pepe", 10], ["cold_eye", 2]], 0.7),
  ]),
  W("喘息", "無光環。", [g(0, "workflow", [["green_mushroom", 18]], 0.5)]),
  W("雙冰眼牆", "兩隻光環同場。", [
    g(0, "workflow", [["cold_eye", 3]], 2.0),
    g(1, "workflow", [["pepe", 10], ["fire_boar", 5]], 0.7),
  ]),
  W("暴風雪", "全機制混合。", [
    g(0, "workflow", [["cold_eye", 2], ["pepe", 8], ["iron_hog", 3], ["hellhound", 3]], 0.65),
  ]),
  W("王前哨", "高速抗緩牆。", [
    g(0, "workflow", [["pepe", 12], ["cold_eye", 2], ["hellhound", 4]], 0.6),
  ]),
  W("【Boss】雪吉拉王", "冰封巨塔之主！冰霜狂暴與召喚企鵝群。", [
    g(0, "workflow", [["boss_yeti", 1]], 1),
    g(3, "workflow", [["pepe", 8], ["cold_eye", 2]], 0.65),
    g(6, "workflow", [["hellhound", 4], ["iron_hog", 2]], 0.85),
  ]),
];

// ═══════════════════════════════════════
// 第二章 · Stage 13 深淵漩渦 — 刺章魚王（螺旋）
// ═══════════════════════════════════════
const S13_WAVES = [
  W("漩渦開場", "由外向內盤旋逼近核心。", [g(0, "workflow", [["bubbling", 12]], 0.65)]),
  W("觸手召喚", "先殺章魚斷召喚源！", [
    g(0, "workflow", [["octopus", 3]], 2.4),
    g(1, "workflow", [["bubbling", 8]], 0.6),
  ]),
  W("深海護甲", "鱷魚＋召喚。", [
    g(0, "workflow", [["croco", 6], ["octopus", 2]], 1.0),
  ]),
  W("復活漩渦", "殭屍菇＋水靈盤旋。", [
    g(0, "workflow", [["zombie_mushroom", 7], ["slime", 6]], 0.75),
  ]),
  W("【中Boss】巨型觸手", "持續召喚，圍點清怪。", [
    g(0, "workflow", [["mid_octopus", 1]], 1),
    g(2, "workflow", [["croco", 5], ["bubbling", 8]], 0.7),
  ]),
  W("喘息", "無召喚。", [g(0, "workflow", [["bubbling", 16]], 0.5)]),
  W("召喚牆", "多章魚圍核。", [
    g(0, "workflow", [["octopus", 4]], 1.8),
    g(0, "workflow", [["croco", 4], ["slime", 5]], 0.9),
  ]),
  W("深淵壓制", "全機制混合。", [
    g(0, "workflow", [["octopus", 3], ["croco", 5], ["zombie_mushroom", 6]], 0.7),
  ]),
  W("王前哨", "召喚＋復活牆。", [
    g(0, "workflow", [["octopus", 3], ["zombie_mushroom", 8], ["hellhound", 3]], 0.65),
  ]),
  W("【Boss】刺章魚王", "深淵漩渦霸主！八爪觸手潮與無盡召喚。", [
    g(0, "workflow", [["boss_octopus", 1]], 1),
    g(2, "workflow", [["octopus", 3], ["bubbling", 10]], 0.65),
    g(5, "workflow", [["croco", 5], ["slime", 6]], 0.75),
  ]),
];

// ═══════════════════════════════════════
// 第二章 · Stage 14 鋼鐵要塞 — 機械豬王（三路）
// ═══════════════════════════════════════
const S14_WAVES = [
  W("三線鋼鐵", "三路要塞防禦。", [
    g(0, "workflow", [["iron_hog", 3]], 1.6),
    g(0, "event", [["fire_boar", 5]], 0.8),
    g(0, "pathC", [["croco", 5]], 1.0),
  ]),
  W("裝甲洪流", "三路護甲齊上。", [
    g(0, "workflow", [["stone_golem", 3]], 1.8),
    g(0, "event", [["iron_hog", 3]], 1.6),
    g(0, "pathC", [["iron_hog", 3]], 1.6),
  ]),
  W("鋼鐵與火", "護甲＋高速。", [
    g(0, "workflow", [["iron_hog", 3], ["fire_boar", 5]], 0.8),
    g(0, "event", [["stone_golem", 2], ["croco", 5]], 1.0),
    g(0, "pathC", [["fire_boar", 6]], 0.7),
  ]),
  W("空降螺絲", "中段蝙蝠空降。", [
    { at: 0, path: "workflow", units: [["bat", 10]], interval: 0.4, distanceRatio: 0.5 },
    g(0, "event", [["iron_hog", 3]], 1.5),
    { at: 1, path: "pathC", units: [["bat", 8]], interval: 0.4, distanceRatio: 0.55 },
  ]),
  W("【中Boss】工廠總監", "三路壓力精英，超高護甲。", [
    g(0, "event", [["mid_triple_elite", 1]], 1),
    g(1, "workflow", [["iron_hog", 3]], 1.4),
    g(1, "pathC", [["stone_golem", 2]], 1.8),
  ]),
  W("喘息", "低甲三路。", [
    g(0, "workflow", [["pig", 8]], 0.6),
    g(0, "event", [["green_mushroom", 10]], 0.55),
    g(0, "pathC", [["snail", 10]], 0.6),
  ]),
  W("重裝牆", "全高甲。", [
    g(0, "workflow", [["stone_golem", 3], ["iron_hog", 2]], 1.4),
    g(0, "event", [["iron_hog", 4]], 1.3),
    g(0, "pathC", [["croco", 6], ["stone_golem", 2]], 1.1),
  ]),
  W("鋼鐵狂潮", "全機制三路。", [
    g(0, "workflow", [["iron_hog", 3], ["fire_boar", 5], ["hellhound", 3]], 0.65),
    g(0, "event", [["stone_golem", 3], ["croco", 5]], 0.7),
    g(0, "pathC", [["iron_hog", 3], ["fire_boar", 5]], 0.65),
  ]),
  W("王前哨", "三路重裝包夾。", [
    g(0, "workflow", [["stone_golem", 3], ["iron_hog", 3]], 1.2),
    g(0, "event", [["iron_hog", 4], ["hellhound", 3]], 0.9),
    g(0, "pathC", [["croco", 6], ["fire_boar", 5]], 0.8),
  ]),
  W("【Boss】機械豬王", "鋼鐵要塞核心！裝甲衝鋒與飛彈齊射。", [
    g(0, "event", [["boss_mech_pig", 1]], 1),
    g(2, "workflow", [["iron_hog", 3], ["fire_boar", 5]], 0.7),
    g(2, "pathC", [["stone_golem", 3], ["hellhound", 3]], 0.85),
  ]),
];

// ═══════════════════════════════════════
// 第二章 · Stage 15 時空盡頭 — 終極試煉（競技場）
// ═══════════════════════════════════════
const S15_WAVES = [
  W("回顧·全機制", "隱形＋護甲＋復活。", [
    g(0, "workflow", [["dark_stump", 6], ["iron_hog", 3]], 0.8),
    g(0, "event", [["zombie_mushroom", 6], ["wraith", 4]], 0.8),
  ]),
  W("回顧·召喚換路", "章魚＋飛龍。", [
    g(0, "workflow", [["octopus", 3], ["drake", 4]], 1.0),
    g(0, "event", [["octopus", 2], ["red_drake", 4]], 1.0),
  ]),
  W("回顧·空降光環", "蝙蝠＋冰眼。", [
    { at: 0, path: "workflow", units: [["bat", 12]], interval: 0.35, distanceRatio: 0.5 },
    g(0, "event", [["cold_eye", 3], ["pepe", 8]], 0.75),
  ]),
  W("龍潮", "紅龍＋地獄犬。", [
    g(0, "workflow", [["red_drake", 5], ["hellhound", 4]], 0.75),
    g(0, "event", [["drake", 6], ["wraith", 4]], 0.75),
  ]),
  W("【中Boss】時空守衛×2", "雙精英同場！", [
    g(0, "workflow", [["mid_ghost_lieutenant", 1]], 1),
    g(0.5, "event", [["mid_cold_eye", 1]], 1),
    g(2, "workflow", [["hellhound", 5], ["dark_stump", 5]], 0.65),
  ]),
  W("最後喘息", "補滿陣形。", [
    g(0, "workflow", [["pig", 12]], 0.55),
    g(0, "event", [["green_mushroom", 14]], 0.5),
  ]),
  W("裂縫爆發 A", "召喚＋護甲＋光環。", [
    g(0, "workflow", [["octopus", 2], ["cold_eye", 2], ["iron_hog", 3]], 0.8),
    g(0, "event", [["wraith", 4], ["stone_golem", 3]], 0.85),
  ]),
  W("裂縫爆發 B", "空降＋換路＋復活。", [
    { at: 0, path: "workflow", units: [["bat", 10]], interval: 0.35, distanceRatio: 0.55 },
    g(0, "event", [["red_drake", 5], ["zombie_mushroom", 6]], 0.75),
    g(2, "workflow", [["hellhound", 5], ["fire_boar", 6]], 0.65),
  ]),
  W("盡頭狂潮", "全作最高壓力波。", [
    g(0, "workflow", [
      ["hellhound", 5],
      ["wraith", 4],
      ["iron_hog", 3],
      ["red_drake", 3],
    ], 0.6),
    g(0, "event", [
      ["dark_stump", 5],
      ["octopus", 2],
      ["stone_golem", 3],
      ["cold_eye", 2],
    ], 0.65),
    { at: 4, path: "workflow", units: [["bat", 12]], interval: 0.3, distanceRatio: 0.6 },
  ]),
  W("【最終Boss】暗黑龍王·真", "時空盡頭的三頭龍王覺醒——第二章最難！", [
    g(0, "workflow", [["boss_dark_dragon", 1]], 1),
    g(3, "event", [["red_drake", 4], ["hellhound", 4]], 0.65),
    g(6, "workflow", [["wraith", 5], ["iron_hog", 3]], 0.8),
    g(9, "event", [["octopus", 2], ["cold_eye", 2]], 0.85),
  ]),
];

export const CAMPAIGN_STAGES = [
  stage({
    id: "s01-victoria",
    index: 0,
    code: "VICTORIA",
    name: "維多利亞港外圍",
    briefing: "教學關。學習部署、破隱與復活。第 5／10 波有 Boss。",
    map: MAP_SINGLE,
    waves: S01_WAVES,
  }),
  stage({
    id: "s02-perion",
    index: 1,
    code: "PERION",
    name: "勇士部落岔路",
    briefing: "雙路線！上下都要顧。第 5／10 波有 Boss。",
    map: MAP_DUAL,
    waves: S02_WAVES,
  }),
  stage({
    id: "s03-ellinia",
    index: 2,
    code: "ELLINIA",
    name: "魔法森林",
    briefing: "隱形與復活為主。捷徑路會抄近路。",
    map: MAP_DUAL_SHORTCUT,
    waves: S03_WAVES,
  }),
  stage({
    id: "s04-orbis",
    index: 3,
    code: "ORBIS",
    name: "愛奧斯塔",
    briefing: "蝙蝠會從路徑中段空降，後排也要佈防！",
    map: MAP_DUAL,
    waves: S04_WAVES,
  }),
  stage({
    id: "s05-orphina",
    index: 4,
    code: "SKY",
    name: "天空之城走廊",
    briefing: "高護甲敵人。帶破甲職業（黑騎／槍神／狂狼）。",
    map: MAP_DUAL,
    waves: S05_WAVES,
  }),
  stage({
    id: "s06-elnath",
    index: 5,
    code: "ELNATH",
    name: "冰原雪域",
    briefing: "企鵝抗緩 · 第 10 波殘暴炎魔（冰原雪域之王）。",
    map: MAP_SINGLE,
    waves: S06_WAVES,
  }),
  stage({
    id: "s07-aqua",
    index: 6,
    code: "AQUA",
    name: "水下世界",
    briefing: "章魚召喚 · 第 10 波海怒斯（深海巨怪）。",
    map: MAP_DUAL,
    waves: S07_WAVES,
  }),
  stage({
    id: "s08-ludi",
    index: 7,
    code: "LUDI",
    name: "玩具城工廠",
    briefing: "三路線進攻 · 第 10 波拉圖斯（時空之鐘）。",
    map: MAP_TRIPLE,
    waves: S08_WAVES,
  }),
  stage({
    id: "s09-leafre",
    index: 8,
    code: "LEAFRE",
    name: "神木村外圍",
    briefing: "飛龍換路 · 第 10 波暗黑龍王（三頭，SS）。",
    map: MAP_DUAL,
    waves: S09_WAVES,
  }),
  stage({
    id: "s10-altar",
    index: 9,
    code: "TEMPLE",
    name: "時間神殿",
    briefing: "最終戰 · 第 10 波皮卡啾（SSS，全作最難）！",
    map: MAP_ARENA,
    waves: S10_WAVES,
  }),
  // ══════ 第二章 · 英雄的試煉（11~15）══════
  stage({
    id: "s11-ghostship",
    index: 10,
    code: "GHOSTSHIP",
    name: "幽靈船・詛咒甲板",
    briefing: "第二章開幕！十字交叉路 · 第 10 波幽靈船長（隱形突進）。",
    map: MAP_CROSS,
    waves: S11_WAVES,
  }),
  stage({
    id: "s12-icetower",
    index: 11,
    code: "ICETOWER",
    name: "冰封巨塔",
    briefing: "蜿蜒長廊 · 抗緩光環 · 第 10 波雪吉拉王（冰霜狂暴）。",
    map: MAP_SERPENTINE,
    waves: S12_WAVES,
  }),
  stage({
    id: "s13-abyss",
    index: 12,
    code: "ABYSS",
    name: "深淵漩渦",
    briefing: "螺旋逼近核心 · 無盡召喚 · 第 10 波刺章魚王。",
    map: MAP_SPIRAL,
    waves: S13_WAVES,
  }),
  stage({
    id: "s14-fortress",
    index: 13,
    code: "FORTRESS",
    name: "鋼鐵要塞",
    briefing: "三路重裝 · 破甲為王 · 第 10 波機械豬王（裝甲衝鋒）。",
    map: MAP_TRIPLE,
    waves: S14_WAVES,
  }),
  stage({
    id: "s15-endoftime",
    index: 14,
    code: "ENDTIME",
    name: "時空盡頭",
    briefing: "終極試煉 · 全機制融合 · 第 10 波暗黑龍王·真（第二章最難）！",
    map: MAP_ARENA,
    waves: S15_WAVES,
  }),
];

// 驗證
const totalWaves = CAMPAIGN_STAGES.reduce((n, s) => n + s.waves.length, 0);
if (totalWaves !== 150) {
  console.warn(`[campaign] expected 150 waves, got ${totalWaves}`);
}
