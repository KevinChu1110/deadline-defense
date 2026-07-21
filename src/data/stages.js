import { CAMPAIGN_STAGES } from "./campaign.js";
import { buildArenaStage, ARENA_BOSS_ROTATION } from "./bosses.js";

export const STAGES = CAMPAIGN_STAGES;

const PROGRESS_KEY = "deadline-defense-progress-v1";

export function getStageById(id) {
  if (typeof id === "string" && id.startsWith("arena-")) {
    const bossId = id.slice("arena-".length);
    return buildArenaStage(ARENA_BOSS_ROTATION.includes(bossId) ? bossId : undefined);
  }
  return STAGES.find((s) => s.id === id) || STAGES[0];
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
  const stage = getStageById(stageId);
  const nextUnlock = (stage?.index ?? 0) + 2;
  progress.unlocked = Math.max(progress.unlocked, Math.min(STAGES.length, nextUnlock));
  saveProgress(progress);
  return progress;
}

export function isStageUnlocked(stageIndex, progress = loadProgress()) {
  return stageIndex < progress.unlocked;
}
