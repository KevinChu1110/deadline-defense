/**
 * 世界關卡：把 world-generated.js（448 關 real map + 274 怪）
 * 轉成塔防可玩的 stage 物件（地圖輪替 + 自動波次），並提供大陸分組給 UI。
 *
 * 取代原本手刻的 CAMPAIGN_STAGES。
 */
import { WORLD_CONTINENTS } from "./world-generated.js";
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

// 單路 / 多路地圖池（依關卡 index 輪替換版型，讓每張圖長得不一樣）
const SINGLE_MAPS = [MAP_SINGLE, MAP_SERPENTINE, MAP_SPIRAL];
const MULTI_MAPS = [MAP_DUAL, MAP_DUAL_SHORTCUT, MAP_CROSS, MAP_ARENA, MAP_TRIPLE];

function pickMap(globalIdx) {
  // 每 3 關穿插一次多路，其餘單路輪替，兼顧變化與可讀性
  if (globalIdx % 3 === 2) return MULTI_MAPS[Math.floor(globalIdx / 3) % MULTI_MAPS.length];
  return SINGLE_MAPS[globalIdx % SINGLE_MAPS.length];
}

function pathKeysOf(map) {
  return Object.keys(map.paths || { workflow: 1 });
}

/**
 * 依關卡怪物清單自動生成 8 波。
 * mons: [{id, level}]；paths: 該地圖可用路徑鍵
 */
function buildWaves(mons, paths, stageLevel) {
  const W = (name, intel, groups) => ({ name, intel, groups });
  const g = (at, path, units, interval) => ({ at, path, units, interval });
  const types = mons.map((m) => m.id);
  const pick = (i) => types[i % types.length];
  const p = (i) => paths[i % paths.length];
  const waves = [];

  // 前 7 波：數量漸增、間隔漸縮
  for (let w = 0; w < 7; w++) {
    const groups = [];
    const lanes = Math.min(paths.length, 1 + (w >= 3 ? 1 : 0) + (w >= 6 ? 1 : 0));
    const perLane = 5 + w; // 5,6,7,...11
    const interval = Math.max(0.5, 0.95 - w * 0.05);
    for (let ln = 0; ln < lanes; ln++) {
      const units = [];
      const kinds = 1 + (w >= 4 ? 1 : 0);
      for (let k = 0; k < kinds; k++) {
        units.push([pick(w + ln + k), Math.ceil(perLane / kinds)]);
      }
      groups.push(g(ln * 0.25, p(ln), units, interval));
    }
    waves.push(W(`第 ${w + 1} 波`, "", groups));
  }

  // 第 8 波（最終）：全怪種齊上 + 頭目（該圖最高等怪加量）
  const boss = mons.reduce((a, b) => (b.level > a.level ? b : a), mons[0]);
  const finalGroups = [
    g(0, p(0), [[boss.id, 8]], 0.7),
    g(1.5, p(1 % paths.length), types.map((t) => [t, 5]), 0.6),
  ];
  waves.push(W("最終波 · 頭目", `${types.length} 種齊上`, finalGroups));

  return waves;
}

let _flat = null;
let _byId = null;

/** 建全部世界關卡（flat，含大陸/章節資訊），並快取 */
export function buildWorldStages() {
  if (_flat) return _flat;
  const flat = [];
  let gi = 0;
  WORLD_CONTINENTS.forEach((cont, ci) => {
    cont.stages.forEach((ws, si) => {
      const map = pickMap(gi);
      const paths = pathKeysOf(map);
      const lv = ws.level || 1;
      // 難度隨等級：核心血/部署點/隊伍上限成長；HP 倍率溫和（怪本身已依等級）
      const tier = Math.min(9, Math.floor(lv / 15));
      flat.push({
        id: ws.id,
        index: gi,
        code: cont.code.toUpperCase(),
        continent: cont.code,
        continentZh: cont.nameZh,
        chapterIdx: ci,
        name: ws.name,
        nameEn: ws.nameEn,
        stageLevel: lv,
        briefing: `${cont.nameZh} · 建議等級 ${lv} · 真實地圖「${ws.name}」`,
        coreHp: 18 + tier * 3,
        teamLimit: Math.min(12, 6 + Math.floor(tier / 1.5)),
        deploymentPoints: 12 + tier * 2,
        sellEnabled: true,
        hpScale: Number((0.85 + tier * 0.12).toFixed(2)),
        speedScale: Number((1 + tier * 0.015).toFixed(3)),
        leakScale: 1 + tier * 0.05,
        map,
        waves: buildWaves(ws.monsters, paths, lv),
        waveClearBonus: { 1: 1, 3: 2, 5: 2, 7: 2 },
        waveRewards: {
          2: ["espresso", "keyboard", "sticky"],
          5: ["stapler", "powerBank", "backup"],
          8: ["firewall", "copier", "espresso"],
        },
      });
      gi++;
    });
  });
  _flat = flat;
  _byId = new Map(flat.map((s) => [s.id, s]));
  return flat;
}

export function getWorldStageById(id) {
  buildWorldStages();
  return _byId.get(id) || null;
}

/** 大陸分組（給選單）：[{code,nameZh,stages:[{id,index,name,stageLevel,...}]}] */
export function getWorldChapters() {
  buildWorldStages();
  return WORLD_CONTINENTS.map((cont) => ({
    code: cont.code,
    nameZh: cont.nameZh,
    stages: _flat.filter((s) => s.continent === cont.code),
  }));
}

// ── 大陸制解鎖：清前一大陸這個比例 → 解鎖下一大陸；大陸內全開自由挑 ──
const CONTINENT_UNLOCK_RATIO = 0.6;

function clearedCount(stages, progress) {
  const c = progress?.cleared || {};
  return stages.reduce((n, s) => n + (c[s.id] ? 1 : 0), 0);
}

/** 解鎖某大陸需要「前一大陸清幾關」→ {cleared, need, total, prevZh} */
export function continentUnlockReq(code, progress) {
  const chapters = getWorldChapters();
  const ci = chapters.findIndex((c) => c.code === code);
  if (ci <= 0) return { cleared: 0, need: 0, total: 0, prevZh: "" };
  const prev = chapters[ci - 1];
  return {
    cleared: clearedCount(prev.stages, progress),
    need: Math.ceil(prev.stages.length * CONTINENT_UNLOCK_RATIO),
    total: prev.stages.length,
    prevZh: prev.nameZh,
  };
}

/** 大陸是否解鎖：第一個恆開；否則前一大陸清 ≥60% */
export function isContinentUnlocked(code, progress) {
  const chapters = getWorldChapters();
  const ci = chapters.findIndex((c) => c.code === code);
  if (ci <= 0) return true;
  const r = continentUnlockReq(code, progress);
  return r.cleared >= r.need;
}
