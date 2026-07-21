/**
 * 轉職樹 + 關卡解鎖
 *
 * 冒險家：初心者 → 一轉 → 二轉 → 三轉 → 四轉（場上轉職）
 * 皇家：通關 S07 解鎖（可部署）
 * 英雄團：通關 S09 解鎖（可部署）
 */
import { SPECIALISTS } from "./specialists.js";
import { loadProgress } from "./stages.js";

const UNLOCK_KEY = "deadline-defense-job-unlock-v1";

/** 轉職階所需「已通關關卡數」（cleared 最高 index+1 或 unlocked 進度） */
/** stagesCleared = progress.unlocked - 1（通關 S01 後 = 1） */
export const TIER_UNLOCK_STAGE = {
  0: 0, // 初心者
  1: 0, // 一轉：開局即可（付楓葉場上轉）
  2: 1, // 二轉：通關第 1 關
  3: 2, // 三轉：通關第 2 關
  4: 4, // 四轉：通關第 4 關
};

/** series 解鎖：需要 progress.unlocked > index（即通關 index 關後 unlocked 會 +） */
export const SERIES_UNLOCK_STAGE = {
  adventurer: 0,
  royal: 7, // 通關 S07 後 unlocked >= 8 → index 7 is S08; 我們用 cleared 判斷
  hero: 9,
};

/**
 * 用「已通關的最高關卡 index+1」或 unlocked 推解鎖。
 * markStageCleared 會把 unlocked 設為 max(unlocked, stageIndex+2)
 * 通關 S01 (index 0) → unlocked >= 2
 * 通關 S07 (index 6) → unlocked >= 8
 * 通關 S09 (index 8) → unlocked >= 10
 */
export function getUnlockProgress(progress = loadProgress()) {
  const unlocked = progress.unlocked || 1;
  // highest cleared index
  let maxCleared = -1;
  for (const id of Object.keys(progress.cleared || {})) {
    // stage ids like s01-victoria — use unlocked-1 as proxy if cleared map incomplete
  }
  // Prefer unlocked count: stages cleared ≈ unlocked - 1
  const stagesCleared = Math.max(0, unlocked - 1);
  return { unlocked, stagesCleared, progress };
}

export function isSeriesUnlocked(series, progress = loadProgress()) {
  if (series === "adventurer" || !series) return true;
  const need = SERIES_UNLOCK_STAGE[series] ?? 99;
  // need N means must have cleared stage index (N-1) → unlocked >= N+1
  // S07 is index 6; clear → unlocked at least 8. stagesCleared >= 7
  const { stagesCleared } = getUnlockProgress(progress);
  return stagesCleared >= need;
}

export function isTierUnlocked(tier, progress = loadProgress()) {
  const need = TIER_UNLOCK_STAGE[tier] ?? 99;
  const { stagesCleared } = getUnlockProgress(progress);
  return stagesCleared >= need;
}

/**
 * 轉職費用（局內楓幣）— 靠擊殺／清波累積，不是帳號楓葉
 * 一轉約需打過 1～2 波小怪
 */
export const JOB_CHANGE_COST = {
  1: 85, // 一轉：約 1～2 波
  2: 220, // 二轉
  3: 400, // 三轉
  4: 650, // 四轉：中後期
};

export function getJobChangeCost(fromId, toId) {
  const to = SPECIALISTS[toId];
  if (!to) return 9999;
  const tier = to.jobTier ?? 4;
  let cost = JOB_CHANGE_COST[tier] ?? 400;
  if (to.series === "royal") cost = Math.round(cost * 1.35);
  if (to.series === "hero") cost = Math.round(cost * 1.6);
  return cost;
}

/** 擊殺掉落楓幣 */
export function mesosForKill(enemyDef) {
  if (!enemyDef) return 5;
  const hp = enemyDef.hp || 30;
  let m = Math.max(5, Math.round(hp * 0.22));
  if (enemyDef.boss) m += 100;
  if (enemyDef.stealth) m += 8;
  if (enemyDef.armor) m += Math.round((enemyDef.armor || 0) * 50);
  return m;
}

/** 清波楓幣（與帳號楓葉分開） */
export function mesosForWaveClear(waveIndex, stageIndex = 0) {
  return 45 + waveIndex * 14 + stageIndex * 5;
}

/**
 * 轉職邊：from → [to, to, ...]
 * 四轉使用現有 id；中間階在 specialists 新增
 */
export const JOB_NEXT = {
  beginner: ["swordman", "magician", "archer_1", "rogue", "pirate_1"],

  // 劍士線
  swordman: ["fighter", "page", "spearman"],
  fighter: ["crusader"],
  page: ["white_knight"],
  spearman: ["dragon_knight"],
  crusader: ["hero"],
  white_knight: ["paladin"],
  dragon_knight: ["dark_knight"],

  // 法師線
  magician: ["wizard_fp", "wizard_il", "cleric"],
  wizard_fp: ["mage_fp"],
  wizard_il: ["mage_il"],
  cleric: ["priest"],
  mage_fp: ["fire_mage"],
  mage_il: ["ice_mage"],
  priest: ["mage"],

  // 弓手線
  archer_1: ["hunter", "crossbowman"],
  hunter: ["ranger"],
  crossbowman: ["sniper"],
  ranger: ["bowmaster"],
  sniper: ["marksman"],

  // 盜賊線
  rogue: ["assassin", "bandit"],
  assassin: ["hermit"],
  bandit: ["chief_bandit"],
  hermit: ["night_envoy"],
  chief_bandit: ["shadow_bandit"],

  // 海盜線
  pirate_1: ["brawler", "gunslinger_1"],
  brawler: ["marauder"],
  gunslinger_1: ["outlaw"],
  marauder: ["buccaneer"],
  outlaw: ["gunslinger"],
};

/** 皇家／英雄：解鎖後可從初心者直接轉（高價捷徑）或部署 */
export const LATERAL_FROM_BEGINNER = {
  // filled at runtime for unlocked series
};

export function getNextJobIds(fromId, progress = loadProgress()) {
  const next = [...(JOB_NEXT[fromId] || [])];
  // 初心者在皇家／英雄解鎖後可直轉該系四轉（較貴，見 getJobChangeCost）
  if (fromId === "beginner") {
    if (isSeriesUnlocked("royal", progress)) {
      next.push(
        "soul_swordsman",
        "flame_wizard",
        "wind_breaker",
        "night_walker",
        "thunder_breaker"
      );
    }
    if (isSeriesUnlocked("hero", progress)) {
      next.push("aran", "evan", "mercedes", "luminous", "phantom");
    }
  }
  return next.filter((id) => SPECIALISTS[id]);
}

export function isJobUnlocked(jobId, progress = loadProgress()) {
  const def = SPECIALISTS[jobId];
  if (!def) return false;
  if (jobId === "beginner") return true;
  if (!isSeriesUnlocked(def.series || "adventurer", progress)) return false;
  const tier = def.jobTier ?? 4;
  return isTierUnlocked(tier, progress);
}

/**
 * 可部署：解鎖 + （初心者 或 已學會）
 * 學會 = 至少轉職過一次到該職，或皇家／英雄解鎖後直接可學
 */
export function loadLearnedJobs() {
  try {
    const raw = localStorage.getItem(UNLOCK_KEY);
    if (!raw) return { beginner: true };
    const data = JSON.parse(raw);
    return { beginner: true, ...(data.learned || data) };
  } catch {
    return { beginner: true };
  }
}

export function saveLearnedJobs(learned) {
  try {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify({ learned }));
  } catch {
    /* ignore */
  }
}

export function markJobLearned(jobId) {
  const learned = loadLearnedJobs();
  learned[jobId] = true;
  saveLearnedJobs(learned);
  return learned;
}

export function isJobLearned(jobId) {
  if (jobId === "beginner") return true;
  const learned = loadLearnedJobs();
  if (learned[jobId]) return true;
  // 皇家／英雄解鎖後視為可直接編隊（不必先場上轉過）
  const def = SPECIALISTS[jobId];
  if (!def) return false;
  if (def.series === "royal" || def.series === "hero") {
    return isSeriesUnlocked(def.series);
  }
  return false;
}

export function canDeployJob(jobId, progress = loadProgress()) {
  return isJobUnlocked(jobId, progress) && isJobLearned(jobId);
}

export function canJobChange(fromId, toId, progress = loadProgress()) {
  const next = getNextJobIds(fromId, progress);
  if (!next.includes(toId)) return { ok: false, reason: "無法轉成此職業" };
  if (!isJobUnlocked(toId, progress)) {
    const def = SPECIALISTS[toId];
    const tier = def?.jobTier ?? 4;
    if (!isSeriesUnlocked(def?.series || "adventurer", progress)) {
      if (def?.series === "royal") return { ok: false, reason: "通關第 7 關解鎖皇家騎士團" };
      if (def?.series === "hero") return { ok: false, reason: "通關第 9 關解鎖英雄團" };
      return { ok: false, reason: "系列未解鎖" };
    }
    const need = TIER_UNLOCK_STAGE[tier] ?? 99;
    return { ok: false, reason: `通關第 ${need} 關後可轉此階` };
  }
  return { ok: true, cost: getJobChangeCost(fromId, toId) };
}

export function getUnlockHint(jobId, progress = loadProgress()) {
  const def = SPECIALISTS[jobId];
  if (!def) return "未知職業";
  if (isJobUnlocked(jobId, progress) && isJobLearned(jobId)) return "已可使用";
  if (!isSeriesUnlocked(def.series || "adventurer", progress)) {
    if (def.series === "royal") return "🔒 通關第 7 關解鎖";
    if (def.series === "hero") return "🔒 通關第 9 關解鎖";
  }
  const tier = def.jobTier ?? 4;
  if (!isTierUnlocked(tier, progress)) {
    const need = TIER_UNLOCK_STAGE[tier];
    return `🔒 通關第 ${need} 關解鎖 ${tier} 轉`;
  }
  if (!isJobLearned(jobId)) return "場上轉職後可編隊";
  return "已可使用";
}
