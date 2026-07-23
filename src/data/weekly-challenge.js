/**
 * 每週挑戰（規則卡）
 *
 * ── 為什麼做這個 ──
 * 三方會診共識：把「舊關變新關」是 CP 值最高的留存機制。這款遊戲已有 10 張關卡，
 * 但線性打完就沒了。每週用**確定性種子**選一張基礎關卡 + 一組修飾符（規則卡），
 * 讓同一張地圖每週玩起來都不一樣：這週禁濺射、下週神木減半、再下週敵人狂暴化。
 *
 * 關鍵是「確定性」：全服玩家同一週打的是**同一個挑戰**，成績才可比、Discord 頻道
 * 才會自然長出「這週好難」「我 XX 分」的話題 —— 這正是「社群活動」定位的引擎。
 *
 * 修飾符只動 stage 的既有旋鈕（coreHp / teamLimit / hpScale / speedScale）與一個
 * 編隊限制過濾，不新增戰鬥機制、不碰平衡公式。純粹是既有內容的重新排列組合。
 */

import { CAMPAIGN_STAGES } from "./campaign.js";
import { SPECIALISTS } from "./specialists.js";
import { getJobSkill } from "./combat-skills.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// 錨定到一個週一（2024-01-01 是週一），之後每 7 天 +1 週
const ANCHOR = Date.UTC(2024, 0, 1);

/** 目前週序（可加 offset 預覽下週）。確定性、與時區無關（用 UTC）。 */
export function getWeekIndex(offset = 0) {
  return Math.floor((Date.now() - ANCHOR) / WEEK_MS) + offset;
}

/** 這週還剩多少秒重置 */
export function weekResetEtaSec(offset = 0) {
  const nextWeekStart = ANCHOR + (getWeekIndex(offset) + 1) * WEEK_MS;
  return Math.max(0, Math.floor((nextWeekStart - Date.now()) / 1000));
}

// 確定性亂數（同一 seed 永遠同一串）
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 修飾符定義 ──
// apply(stage) 就地改 stage（stage 是 structuredClone 出來的副本，改它安全）。
// filterJob(jobId) 回傳 false 表示這個職業本週禁用。
const MODIFIERS = [
  {
    id: "core_half",
    label: "神木脆弱",
    desc: "神木血量減半，別讓怪漏過去",
    icon: "💔",
    apply: (s) => {
      s.coreHp = Math.max(5, Math.round(s.coreHp * 0.5));
    },
  },
  {
    id: "enemy_haste",
    label: "狂暴來襲",
    desc: "所有敵人移動速度 +35%",
    icon: "💨",
    apply: (s) => {
      s.speedScale = (s.speedScale || 1) * 1.35;
    },
  },
  {
    id: "enemy_tanky",
    label: "厚皮怪潮",
    desc: "所有敵人血量 +40%",
    icon: "🛡️",
    apply: (s) => {
      s.hpScale = (s.hpScale || 1) * 1.4;
    },
  },
  {
    id: "small_squad",
    label: "精兵政策",
    desc: "隊伍上限 −2，用最少的人守住",
    icon: "👥",
    apply: (s) => {
      s.teamLimit = Math.max(2, (s.teamLimit || 8) - 2);
    },
  },
  {
    id: "low_budget",
    label: "撙節開支",
    desc: "起始部署點數 −25%",
    icon: "💸",
    apply: (s) => {
      s.deploymentPoints = Math.max(1, Math.round((s.deploymentPoints || 10) * 0.75));
    },
  },
  {
    id: "no_splash",
    label: "禁止範圍",
    desc: "本週不能使用「濺射」型職業",
    icon: "🚫",
    filterJob: (jobId) => !((getJobSkill(jobId) || {}).splashR > 0),
  },
  {
    id: "melee_only",
    label: "近戰試煉",
    desc: "只能使用近戰系職業（劍士/海盜線）",
    icon: "⚔️",
    filterJob: (jobId) => {
      const fam = SPECIALISTS[jobId]?.family;
      return fam === "warrior" || fam === "pirate" || jobId === "beginner";
    },
  },
];

const MOD_BY_ID = new Map(MODIFIERS.map((m) => [m.id, m]));

/**
 * 取某週的挑戰定義（確定性）：一張基礎關卡 + 2 個修飾符。
 * @returns {{ week, baseStageId, baseStageName, modifiers: [{id,label,desc,icon}], resetEta }}
 */
export function getWeeklyChallenge(offset = 0) {
  const week = getWeekIndex(offset);
  const rand = mulberry32(week * 2654435761);

  const base = CAMPAIGN_STAGES[Math.floor(rand() * CAMPAIGN_STAGES.length)];

  // 挑 2 個不重複的修飾符
  const pool = [...MODIFIERS];
  const picked = [];
  while (picked.length < 2 && pool.length) {
    const i = Math.floor(rand() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  // 避免同時「近戰試煉」+「禁止範圍」把可用職業掐太死：撞到就換掉第二個
  if (picked[0].id === "melee_only" && picked[1]?.id === "no_splash") {
    picked[1] = MODIFIERS.find((m) => m.id === "enemy_tanky");
  }

  return {
    week,
    baseStageId: base.id,
    baseStageName: base.name,
    modifiers: picked.map((m) => ({ id: m.id, label: m.label, desc: m.desc, icon: m.icon })),
    resetEta: weekResetEtaSec(offset),
  };
}

/** 把某週挑戰的修飾符套進一個 stage 副本（呼叫端須先 clone） */
export function applyChallengeToStage(stage, challenge) {
  for (const m of challenge.modifiers) {
    MOD_BY_ID.get(m.id)?.apply?.(stage);
  }
  stage.isWeeklyChallenge = true;
  stage.challengeWeek = challenge.week;
  return stage;
}

/** 某職業本週能不能用（所有 filterJob 都要通過） */
export function isJobAllowedThisWeek(jobId, challenge) {
  for (const m of challenge.modifiers) {
    const def = MOD_BY_ID.get(m.id);
    if (def?.filterJob && !def.filterJob(jobId)) return false;
  }
  return true;
}

/** 本週是否有編隊限制（決定 UI 要不要顯示「部分職業已禁用」提示） */
export function hasJobRestriction(challenge) {
  return challenge.modifiers.some((m) => MOD_BY_ID.get(m.id)?.filterJob);
}

export { MODIFIERS };
