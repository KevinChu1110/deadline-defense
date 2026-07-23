import { buildArenaStage, ARENA_BOSS_ROTATION } from "./bosses.js";
import { buildWorldStages, getWorldStageById, isContinentUnlocked } from "./world-stages.js";

// 世界地圖：14 大陸 / 448 關（真實 MapleStory 地圖，取代原手刻 10 關）
export const STAGES = buildWorldStages();

const PROGRESS_KEY = "deadline-defense-progress-v1";

export function getStageById(id) {
  if (typeof id === "string" && id.startsWith("arena-")) {
    let bossId = id.slice("arena-".length);
    // 舊競賽 id 相容
    if (bossId === "boss_horntail") bossId = "boss_hainurs";
    return buildArenaStage(ARENA_BOSS_ROTATION.includes(bossId) ? bossId : undefined);
  }
  return getWorldStageById(id) || STAGES[0];
}

export function getStageByIndex(index) {
  const i = Math.max(0, Math.min(STAGES.length - 1, Number(index) || 0));
  return STAGES[i];
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { unlocked: 1, cleared: {} };
    const data = JSON.parse(raw);
    return {
      unlocked: Math.max(1, Math.min(STAGES.length, Number(data.unlocked) || 1)),
      cleared: data.cleared && typeof data.cleared === "object" ? data.cleared : {},
    };
  } catch {
    return { unlocked: 1, cleared: {} };
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

export function markStageCleared(stageId) {
  const progress = loadProgress();
  progress.cleared[stageId] = true;
  // ⚠️ 大陸制：解鎖由「該大陸清 60%」推動（isContinentUnlocked 讀 cleared），
  //    這裡不再線性 +2 推進 unlocked，否則會繞過大陸閘門變回一關一關開。
  saveProgress(progress);
  return progress;
}

export function isStageUnlocked(stageIndex, progress = loadProgress()) {
  // 相容：等級匯入/舊線性解鎖仍認（index < unlocked）
  if (stageIndex < (progress.unlocked || 1)) return true;
  // 大陸制：該關所屬大陸解鎖 → 大陸內全開自由挑
  const s = STAGES[stageIndex];
  return s ? isContinentUnlocked(s.continent, progress) : false;
}
