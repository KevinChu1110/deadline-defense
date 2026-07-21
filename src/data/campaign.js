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
  W("第一批蝸牛", "放置角色，擋住蝸牛。", [g(0, "workflow", [["snail", 8]], 0.95)]),
  W("木妖混入", "木妖較厚，多放輸出。", [
    g(0, "workflow", [["snail", 6]], 0.85),
    g(2, "workflow", [["stump", 3]], 1.4),
  ]),
  W("隱形教學", "黑木妖需破隱（弓／主教）。", [
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
  W("【Boss】雪吉拉王", "光環加速；半血召冰眼與企鵝。", [
    g(0, "workflow", [["boss_yeti", 1]], 1),
    g(3, "workflow", [["pepe", 8], ["snail", 10]], 0.55),
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
  W("【Boss】刺章魚王", "高速召喚；半血另一路生小章魚。", [
    g(0, "workflow", [["boss_octopus", 1]], 1),
    g(2, "event", [["croco", 4], ["bubbling", 8]], 0.65),
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
  W("【Boss】機械豬王", "半血雙階段加兵。", [
    g(0, "event", [["boss_mech_pig", 1]], 1),
    g(2, "workflow", [["fire_boar", 5]], 0.7),
    g(2, "pathC", [["pig", 6]], 0.7),
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
  W("【Boss】幽靈船長", "隱形換路；半血雙路加兵。", [
    g(0, "workflow", [["boss_ghost_captain", 1]], 1),
    g(2, "event", [["jr_wraith", 6], ["drake", 3]], 0.7),
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
  W("【中Boss】拉圖斯幻影", "終章中 Boss。", [
    g(0, "workflow", [["mid_papulatus", 1]], 1),
    g(2, "event", [["hellhound", 4], ["fire_boar", 5]], 0.7),
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
  W("炎魔先遣", "全種類狂潮。", [
    g(0, "workflow", [
      ["hellhound", 3],
      ["fire_boar", 4],
      ["iron_hog", 2],
      ["dark_stump", 3],
    ], 0.65),
    g(0, "event", [
      ["jr_wraith", 5],
      ["red_drake", 3],
      ["zombie_mushroom", 4],
      ["octopus", 1],
    ], 0.7),
    { at: 4, path: "workflow", units: [["bat", 8]], interval: 0.35, distanceRatio: 0.6 },
  ]),
  W("【最終Boss】殘暴炎魔", "三階段加兵。守住神木！", [
    g(0, "workflow", [["boss_zakum", 1]], 1),
    g(4, "event", [["hellhound", 3], ["fire_boar", 5]], 0.7),
    g(8, "workflow", [["iron_hog", 2], ["drake", 3]], 0.9),
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
    briefing: "企鵝抗緩，冰冷之眼會加速友軍——優先擊殺！",
    map: MAP_SINGLE,
    waves: S06_WAVES,
  }),
  stage({
    id: "s07-aqua",
    index: 6,
    code: "AQUA",
    name: "水下世界",
    briefing: "章魚會不斷召喚小怪。先打掉召喚源。",
    map: MAP_DUAL,
    waves: S07_WAVES,
  }),
  stage({
    id: "s08-ludi",
    index: 7,
    code: "LUDI",
    name: "玩具城工廠",
    briefing: "三路線同時進攻，部署點要精打細算。",
    map: MAP_TRIPLE,
    waves: S08_WAVES,
  }),
  stage({
    id: "s09-leafre",
    index: 8,
    code: "LEAFRE",
    name: "神木村外圍",
    briefing: "飛龍與幽靈會中途換路，廣覆蓋佈陣。",
    map: MAP_DUAL,
    waves: S09_WAVES,
  }),
  stage({
    id: "s10-altar",
    index: 9,
    code: "ALTAR",
    name: "神木祭壇",
    briefing: "最終戰。全機制融合，第 10 波殘暴炎魔！",
    map: MAP_ARENA,
    waves: S10_WAVES,
  }),
];

// 驗證
const totalWaves = CAMPAIGN_STAGES.reduce((n, s) => n + s.waves.length, 0);
if (totalWaves !== 100) {
  console.warn(`[campaign] expected 100 waves, got ${totalWaves}`);
}
