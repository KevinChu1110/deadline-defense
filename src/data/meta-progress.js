/**
 * 三星評價、失敗安慰、編隊推薦
 */
import { loadProgress, saveProgress } from "./stages.js";

const STARS_KEY = "deadline-defense-stars-v1";

export function loadStars() {
  try {
    const raw = localStorage.getItem(STARS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

export function saveStars(data) {
  try {
    localStorage.setItem(STARS_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/**
 * @param {object} run { stageId, coreHp, coreMax, leaks, usedJobChange, waveIndex, waveTotal }
 */
export function evaluateStars(run) {
  const stars = [];
  // 1: clear
  stars.push({ id: "clear", ok: true, label: "通關" });
  // 2: core >= 50%
  const ratio = (run.coreHp || 0) / Math.max(1, run.coreMax || 1);
  stars.push({ id: "core", ok: ratio >= 0.5, label: "神木≥50%" });
  // 3: job change at least once OR low leaks
  const leaks = run.leaks || 0;
  stars.push({ id: "skill", ok: leaks <= 3 || !!run.usedJobChange, label: "漏怪≤3或曾轉職" });
  const count = stars.filter((s) => s.ok).length;
  return { stars, count };
}

export function claimStageStars(stageId, count) {
  const data = loadStars();
  const prev = data[stageId] || 0;
  const next = Math.max(prev, Math.min(3, count));
  const gained = next - prev;
  data[stageId] = next;
  saveStars(data);
  return { prev, next, gained };
}

/** 失敗安慰楓葉 */
export function failConsolationLeaves(waveIndex, waveTotal, stageIndex = 0) {
  if (waveIndex < 0) return 0;
  const progress = (waveIndex + 1) / Math.max(1, waveTotal);
  if (progress < 0.25) return 2 + stageIndex;
  if (progress < 0.5) return 5 + stageIndex * 2;
  return 8 + stageIndex * 2;
}

/** 編隊推薦（顯示用） */
export const LOADOUT_PRESETS = [
  {
    id: "firewall",
    nameZh: "神木火牆",
    desc: "群怪清潮：燒 + 緩 + 連射",
    jobs: ["fire_mage", "ice_mage", "bowmaster", "night_envoy"],
    needTier: 4,
  },
  {
    id: "break",
    nameZh: "破甲處刑",
    desc: "重甲／頭車：破甲 + 鎖定",
    jobs: ["shadow_bandit", "fire_mage", "gunslinger", "hero"],
    needTier: 4,
  },
  {
    id: "reveal",
    nameZh: "顯形天網",
    desc: "隱形關：貫穿破隱 + 控場",
    jobs: ["marksman", "mage", "bowmaster", "ice_mage"],
    needTier: 4,
  },
  {
    id: "fortress",
    nameZh: "要塞不破",
    desc: "衝鋒波：坦 + 震退 + 輔助",
    jobs: ["paladin", "buccaneer", "dark_knight", "mage"],
    needTier: 4,
  },
  {
    id: "beginner_line",
    nameZh: "新手起手",
    desc: "先上初心者，場上轉職發展",
    jobs: ["beginner"],
    needTier: 0,
  },
];
