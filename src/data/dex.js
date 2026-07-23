/**
 * 圖鑑 / 收集系統
 *
 * ── 為什麼做這個 ──
 * 三方會診共識：這款遊戲的定位是「Discord bot 的角色養成展場 + 每週守神木」。
 * 已經有 52 職 × 48 敵 × 5 boss × 10+ 關的內容庫，但「多」不等於「耐玩」——
 * 要有系統把庫存變成「收集目標」，玩家才有理由把所有職業都拉上場、把每種怪都
 * 打過一輪。這是 CP 值最高的留存機制：幾乎零新戰鬥內容，純粹盤活既有 asset。
 *
 * 三軸收集：
 *   - 職業（used）  ：這個職業有沒有在塔防裡實際部署過 → 呼應「養成展場」
 *   - 敵人（killed）：這種怪有沒有被擊殺過（遇過但沒殺死也記 seen）→ 呼應「攻略深度」
 *   - 關卡（stars） ：沿用既有的三星系統（meta-progress.js），這裡只做總覽
 *
 * ⚠️ 圖鑑是**帳號級的全域收集成就**，不進存檔槽（SLOT_DATA_KEYS）——
 * 「我用過哪些職業、打過哪些怪」是跨三個存檔累加的，不該因為換存檔槽而重來。
 * 這也順便避開了「新增 SLOT_DATA_KEYS 欄位會被切槽邏輯清掉舊資料」的坑。
 * 不做圖鑑加成 —— 純收集展示，不碰戰鬥平衡。
 */

import { SPECIALISTS, SPECIALIST_ORDER } from "./specialists.js";
import { ENEMIES } from "./enemies.js";
import { loadStars } from "./meta-progress.js";

const DEX_KEY = "deadline-defense-dex-v1";

function loadDex() {
  try {
    const raw = localStorage.getItem(DEX_KEY);
    if (!raw) return { jobs: {}, enemies: {} };
    const d = JSON.parse(raw) || {};
    return { jobs: d.jobs || {}, enemies: d.enemies || {} };
  } catch {
    return { jobs: {}, enemies: {} };
  }
}

function saveDex(d) {
  try {
    localStorage.setItem(DEX_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

// ── 埋點：遊戲呼叫這兩個記錄收集 ──

/** 部署了某職業（第一次才寫檔，避免每次部署都碰 localStorage） */
export function markJobUsed(typeId) {
  if (!typeId || !SPECIALISTS[typeId]) return false;
  const d = loadDex();
  if (d.jobs[typeId]?.used) return false;
  d.jobs[typeId] = { used: true, firstAt: d.jobs[typeId]?.firstAt || Date.now() };
  saveDex(d);
  return true;
}

/**
 * 遇到 / 擊殺某種敵人。
 * ⚠️ 只在「seen/killed 布林狀態轉變」時才寫檔 —— 一場塔防會擊殺幾百隻怪，
 *    若每次擊殺都寫 localStorage 就違背了剛做的效能整頓。圖鑑的核心是「解鎖了沒」，
 *    不是精確擊殺次數，所以不記 count。
 */
export function markEnemy(typeId, { killed = false } = {}) {
  if (!typeId || !ENEMIES[typeId]) return false;
  const d = loadDex();
  const cur = d.enemies[typeId] || {};
  const nextKilled = cur.killed || killed;
  if (cur.seen && cur.killed === nextKilled) return false; // 沒有狀態變化就不寫檔
  d.enemies[typeId] = {
    seen: true,
    killed: nextKilled,
    firstAt: cur.firstAt || Date.now(),
  };
  saveDex(d);
  return true;
}

// ── 查詢：UI 用 ──

/** 職業圖鑑條目（依 SPECIALIST_ORDER，未收集的顯示為問號） */
export function getJobDex() {
  const d = loadDex();
  return SPECIALIST_ORDER.filter((id) => SPECIALISTS[id]).map((id) => {
    const def = SPECIALISTS[id];
    const rec = d.jobs[id];
    return {
      id,
      nameZh: def.nameZh,
      color: def.color,
      family: def.family,
      used: !!rec?.used,
    };
  });
}

/** 敵人圖鑑條目（一般怪在前、boss 在後） */
export function getEnemyDex() {
  const d = loadDex();
  const ids = Object.keys(ENEMIES);
  const rows = ids.map((id) => {
    const def = ENEMIES[id];
    const rec = d.enemies[id];
    return {
      id,
      nameZh: def.nameZh,
      color: def.color,
      boss: !!def.boss,
      seen: !!rec?.seen,
      killed: !!rec?.killed,
    };
  });
  // 一般怪在前、boss 在後，各自維持原順序
  return rows.sort((a, b) => (a.boss === b.boss ? 0 : a.boss ? 1 : -1));
}

/** 三軸完成度摘要（首頁徽章、圖鑑標題用） */
export function getDexSummary() {
  const jobs = getJobDex();
  const enemies = getEnemyDex();
  const stars = loadStars();

  const jobUsed = jobs.filter((j) => j.used).length;
  const enemyKilled = enemies.filter((e) => e.killed).length;
  const enemySeen = enemies.filter((e) => e.seen).length;
  const starTotal = Object.values(stars).reduce((s, n) => s + (Number(n) || 0), 0);

  return {
    jobs: { done: jobUsed, total: jobs.length },
    enemies: { killed: enemyKilled, seen: enemySeen, total: enemies.length },
    stars: { total: starTotal },
    // 總完成度：職業收集 + 敵人擊殺 各半（關卡星星另計，因為上限隨關卡數變動）
    percent: Math.round(
      ((jobUsed / Math.max(1, jobs.length)) * 0.5 +
        (enemyKilled / Math.max(1, enemies.length)) * 0.5) *
        100
    ),
  };
}

export { DEX_KEY };
