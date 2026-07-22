/**
 * 遠征 Boss 專用 — 貓咪大戰爭風格推線
 * 左：我方基地  右：敵方基地
 * 點卡出兵 → 自動往右走；敵人從右往左；近戰卡住互打
 */

export const BC_DEFAULTS = {
  laneY: 400,
  groundTop: 360,
  maxUnits: 18,
  walletMax: 60,
  walletTick: 0.38,
  walletPerTick: 1,
  spawnCd: 1.6,
  walkSpeed: 55,
  enemyWalkSpeed: 48,
  baseMeleeRange: 52,
  unitBlockRange: 42,
  castleHitInterval: 0.5,
  /** 單位與單位交戰距離 */
  engageRange: 46,
};

/**
 * @param {object} map
 * @param {object} stage
 */
export function initBcState(map, stage) {
  const laneY = map.laneY ?? BC_DEFAULTS.laneY;
  const player = map.playerBase || { x: 72, y: laneY };
  const enemy = map.enemyBase || { x: 888, y: laneY };
  const castleMax = stage.enemyCastleHp || Math.round((stage.coreHp || 20) * 80);
  return {
    enabled: true,
    laneY,
    playerBase: { x: player.x, y: player.y || laneY, r: player.r || 44 },
    enemyBase: { x: enemy.x, y: enemy.y || laneY, r: enemy.r || 48 },
    enemyCastleHp: castleMax,
    enemyCastleMax: castleMax,
    walletMax: stage.bcWalletMax || BC_DEFAULTS.walletMax,
    walletAcc: 0,
    spawnCd: Object.create(null),
    maxUnits: stage.teamLimit || BC_DEFAULTS.maxUnits,
    siege: false,
    spawnCount: 0,
  };
}

export function tickBcWallet(bc, points, dt) {
  if (!bc || dt <= 0) return points;
  bc.walletAcc += dt;
  let p = points;
  while (bc.walletAcc >= BC_DEFAULTS.walletTick) {
    bc.walletAcc -= BC_DEFAULTS.walletTick;
    if (p < bc.walletMax) p += BC_DEFAULTS.walletPerTick;
  }
  return p;
}

export function tickBcSpawnCd(bc, dt) {
  if (!bc?.spawnCd || dt <= 0) return;
  for (const k of Object.keys(bc.spawnCd)) {
    bc.spawnCd[k] = Math.max(0, bc.spawnCd[k] - dt);
    if (bc.spawnCd[k] <= 0) delete bc.spawnCd[k];
  }
}

export function bcSpawnReady(bc, typeId) {
  return !bc?.spawnCd?.[typeId] || bc.spawnCd[typeId] <= 0;
}

export function markBcSpawned(bc, typeId) {
  if (!bc) return;
  bc.spawnCd[typeId] = BC_DEFAULTS.spawnCd;
}

/**
 * 敵軍放在右側、往左走（不依賴路徑取樣）
 */
export function placeEnemyOnBcLane(enemy, bc, index = 0) {
  if (!enemy || !bc) return;
  enemy.bcMode = true;
  enemy.bcYOff = ((index % 5) - 2) * 8;
  enemy.x = bc.enemyBase.x - 16 - (index % 4) * 10;
  enemy.y = bc.laneY + enemy.bcYOff;
  // 關掉路徑漏怪邏輯：改用 BC 專用移動
  enemy.distance = 0;
  enemy.pathMetrics = enemy.pathMetrics || { total: 99999 };
  // 標記走 BC 物理
  enemy._bcWalk = true;
  enemy.facing = -1;
  bc.spawnCount = (bc.spawnCount || 0) + 1;
}

/**
 * 敵軍：往左走；碰到我方單位就停；碰到我方基地扣血
 * @returns {{ hitPlayerBase: number }}
 */
export function updateBcEnemy(e, dt, allies, bc) {
  if (!e?.alive || !bc || dt <= 0) return { hitPlayerBase: 0 };
  e.bcMode = true;
  e.y = bc.laneY + (e.bcYOff || 0);
  e.facing = -1;

  const engage = BC_DEFAULTS.engageRange + (e.def.boss ? 18 : 0);
  // 找前方（左側）最近友軍
  let blocker = null;
  let best = Infinity;
  for (const a of allies) {
    if (!a) continue;
    // 在敵人左邊、距離內
    const d = e.x - a.x;
    if (d < 0) continue;
    if (d < best && d < engage) {
      best = d;
      blocker = a;
    }
  }

  if (blocker) {
    // 停下來，由 projectile/近戰系統互打；若沒有攻擊就做接觸傷害
    e.attackT = Math.min(1, (e.attackT || 0) + dt * 2);
    e._bcMeleeCd = (e._bcMeleeCd || 0) - dt;
    if (e._bcMeleeCd <= 0) {
      e._bcMeleeCd = e.def.boss ? 0.9 : 0.7;
      // 對友軍造成簡易近戰（若沒有 specialist 射擊）
      const dmg = Math.max(2, Math.round((e.def.leakDamage || 1) * 2.5));
      // 用 hp 扣在 specialist 上 — 部分 specialist 沒有 hp，加一層
      if (blocker.hp == null) {
        blocker.hp = blocker.maxHp || 40;
        blocker.maxHp = blocker.maxHp || 40;
      }
      blocker.hp -= dmg;
      blocker.hitFlash = 0.12;
      if (blocker.hp <= 0) {
        blocker.alive = false;
        blocker._bcDead = true;
      }
    }
    return { hitPlayerBase: 0 };
  }

  // 碰到我方基地
  const baseX = bc.playerBase.x;
  if (e.x <= baseX + BC_DEFAULTS.baseMeleeRange) {
    e.alive = false;
    e.leaked = true;
    return { hitPlayerBase: e.def.leakDamage || 1 };
  }

  // 往左走
  let speed = (e.def.speed || 40) * 0.55 + BC_DEFAULTS.enemyWalkSpeed * 0.45;
  if (e.def.boss) speed *= 0.72;
  if (e.status?.slowUntil > 0 && e.status.slowPower) {
    speed *= Math.max(0.45, e.status.slowPower);
  }
  e.x -= speed * dt;
  if (e.x < baseX - 10) e.x = baseX - 10;
  // 避免路徑系統把距離走完判定漏怪
  e.distance = 0;
  return { hitPlayerBase: 0 };
}

/**
 * Specialist BC movement + castle attack
 * @returns {{ castleHits: number, blocked: boolean }}
 */
export function updateBcSpecialist(s, dt, enemies, bc) {
  if (!bc || !s || dt <= 0) return { castleHits: 0, blocked: false };
  if (s._bcDead || s.alive === false) return { castleHits: 0, blocked: false };

  s.bcMode = true;
  s.facing = 1;
  s.y = bc.laneY + (s.bcYOff || 0);

  // 確保有血量（遠征互打）
  if (s.hp == null) {
    s.hp = 28 + (s.def.damage || 8) * 2;
    s.maxHp = s.hp;
  }

  const engage = BC_DEFAULTS.engageRange + Math.min(30, (s.def.range || 40) * 0.15);
  let blocker = null;
  let best = Infinity;
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = e.x - s.x;
    if (d < -8) continue;
    if (d < best && d < engage) {
      best = d;
      blocker = e;
    }
  }

  const castleX = bc.enemyBase.x;
  const distCastle = castleX - s.x;
  const atCastle = distCastle <= BC_DEFAULTS.baseMeleeRange + 12;

  if (blocker) {
    s.attackT = 0.25;
    return { castleHits: 0, blocked: true };
  }

  if (atCastle) {
    s.attackT = 0.25;
    s._castleAtk = (s._castleAtk || 0) - dt;
    if (s._castleAtk <= 0) {
      s._castleAtk = BC_DEFAULTS.castleHitInterval;
      const dmg = Math.max(4, Math.round((s.def.damage || 8) * 0.9));
      return { castleHits: dmg, blocked: true };
    }
    return { castleHits: 0, blocked: true };
  }

  // 往右走
  const speed = BC_DEFAULTS.walkSpeed * (0.9 + Math.min(0.4, (s.def.range || 60) / 220));
  s.x += speed * dt;
  if (s.x > castleX - 18) s.x = castleX - 18;
  s.attackT = Math.max(0, (s.attackT || 0) - dt);
  return { castleHits: 0, blocked: false };
}

export function damageEnemyCastle(bc, amount) {
  if (!bc || amount <= 0) return false;
  bc.enemyCastleHp = Math.max(0, bc.enemyCastleHp - amount);
  return bc.enemyCastleHp <= 0;
}
