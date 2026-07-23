/**
 * 多人排行（本機聯賽）：同裝置可多暱稱競分
 * 分數上傳：localStorage；可匯出 JSON 分享
 */
const RANK_KEY = "deadline-defense-ranking-v2";
const NICK_KEY = "deadline-defense-nickname";

export function getNickname() {
  try {
    return localStorage.getItem(NICK_KEY) || "";
  } catch {
    return "";
  }
}

export function setNickname(name) {
  const n = String(name || "").trim().slice(0, 12) || "冒險者";
  try {
    localStorage.setItem(NICK_KEY, n);
  } catch {
    /* ignore */
  }
  return n;
}

export function loadRanking() {
  try {
    const raw = localStorage.getItem(RANK_KEY);
    if (!raw) return { stage: {}, arena: [], all: [], weekly: {} };
    const data = JSON.parse(raw);
    return {
      stage: data.stage || {},
      arena: Array.isArray(data.arena) ? data.arena : [],
      all: Array.isArray(data.all) ? data.all : [],
      weekly: data.weekly && typeof data.weekly === "object" ? data.weekly : {},
    };
  } catch {
    return { stage: {}, arena: [], all: [], weekly: {} };
  }
}

function saveRanking(data) {
  try {
    localStorage.setItem(RANK_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/**
 * 通關分數
 * 基礎 1000 + 神木%*500 + 楓幣剩餘*0.5 - 漏怪*40 + 轉職*80 + 波次
 */
export function computeClearScore({
  coreHp = 0,
  coreMax = 20,
  mesos = 0,
  leaks = 0,
  usedJobChange = false,
  waveTotal = 10,
  stageIndex = 0,
  bossKill = false,
}) {
  const coreRatio = coreHp / Math.max(1, coreMax);
  let score = 1000;
  score += Math.round(coreRatio * 500);
  score += Math.min(400, Math.round(mesos * 0.4));
  score -= leaks * 40;
  if (usedJobChange) score += 80;
  score += waveTotal * 20;
  score += stageIndex * 50;
  if (bossKill) score += 200;
  return Math.max(0, Math.round(score));
}

export function submitStageScore(stageId, entry) {
  const data = loadRanking();
  const nick = entry.nick || getNickname() || "冒險者";
  const row = {
    nick,
    score: entry.score,
    stars: entry.stars || 0,
    coreHp: entry.coreHp,
    leaks: entry.leaks || 0,
    at: Date.now(),
    stageId,
  };
  if (!data.stage[stageId]) data.stage[stageId] = [];
  data.stage[stageId].push(row);
  data.stage[stageId].sort((a, b) => b.score - a.score);
  data.stage[stageId] = data.stage[stageId].slice(0, 20);

  data.all.push({ ...row, mode: "stage" });
  data.all.sort((a, b) => b.score - a.score);
  data.all = data.all.slice(0, 50);
  saveRanking(data);
  return row;
}

export function submitArenaScore(entry) {
  const data = loadRanking();
  const nick = entry.nick || getNickname() || "冒險者";
  const row = {
    nick,
    score: entry.score,
    bossId: entry.bossId,
    bossName: entry.bossName,
    at: Date.now(),
    coreHp: entry.coreHp,
    leaks: entry.leaks || 0,
  };
  data.arena.push(row);
  data.arena.sort((a, b) => b.score - a.score);
  data.arena = data.arena.slice(0, 30);
  data.all.push({ ...row, mode: "arena", stageId: "arena" });
  data.all.sort((a, b) => b.score - a.score);
  data.all = data.all.slice(0, 50);
  saveRanking(data);
  return row;
}

/**
 * 每週挑戰成績。榜按「週序」分開存 —— 每週重置就是換一個 key，舊週榜自動封存。
 * 只保留最近幾週，避免無限長大。
 */
export function submitWeeklyScore(week, entry) {
  const data = loadRanking();
  const nick = entry.nick || getNickname() || "冒險者";
  const row = {
    nick,
    score: entry.score,
    stars: entry.stars || 0,
    coreHp: entry.coreHp,
    leaks: entry.leaks || 0,
    at: Date.now(),
    week,
  };
  const key = String(week);
  if (!data.weekly[key]) data.weekly[key] = [];
  // 同一暱稱只留最高分（週榜比的是「本週最佳」，不是刷榜次數）
  const existing = data.weekly[key].find((r) => r.nick === nick);
  if (existing) {
    if (row.score > existing.score) Object.assign(existing, row);
  } else {
    data.weekly[key].push(row);
  }
  data.weekly[key].sort((a, b) => b.score - a.score);
  data.weekly[key] = data.weekly[key].slice(0, 30);
  // 只保留最近 6 週的榜
  const keys = Object.keys(data.weekly).map(Number).sort((a, b) => b - a);
  for (const k of keys.slice(6)) delete data.weekly[String(k)];
  saveRanking(data);
  return row;
}

export function getWeeklyLeaderboard(week, limit = 15) {
  const data = loadRanking();
  return (data.weekly[String(week)] || []).slice(0, limit);
}

export function getStageLeaderboard(stageId, limit = 10) {
  const data = loadRanking();
  return (data.stage[stageId] || []).slice(0, limit);
}

export function getArenaLeaderboard(limit = 10) {
  return loadRanking().arena.slice(0, limit);
}

export function getGlobalLeaderboard(limit = 15) {
  return loadRanking().all.slice(0, limit);
}

export function exportRankingJson() {
  return JSON.stringify(loadRanking(), null, 2);
}
