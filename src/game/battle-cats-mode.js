/**
 * 遠征 Boss 專用 — 貓咪大戰爭風格推線
 * 左：我方基地  右：敵方基地
 * 點職業卡出兵 → 自動往右走並交戰
 */

export const BC_DEFAULTS = {
  laneY: 400,
  groundTop: 360,
  maxUnits: 18,
  walletMax: 55,
  walletTick: 0.42,
  walletPerTick: 1,
  spawnCd: 2.2,
  walkSpeed: 42,
  enemyWalkMul: 1,
  baseMeleeRange: 48,
  unitBlockRange: 36,
  castleHitInterval: 0.55,
};

/**
 * @param {object} map
 * @param {object} stage
 */
export function initBcState(map, stage) {
  const laneY = map.laneY ?? BC_DEFAULTS.laneY;
  const player = map.playerBase || { x: 70, y: laneY };
  const enemy = map.enemyBase || { x: 890, y: laneY };
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
    spawnCd: Object.create(null), // typeId -> remaining
    maxUnits: stage.teamLimit || BC_DEFAULTS.maxUnits,
    siege: false, // last wave cleared, push castle
  };
}

export function tickBcWallet(bc, points, dt) {
  if (!bc) return points;
  bc.walletAcc += dt;
  let p = points;
  while (bc.walletAcc >= BC_DEFAULTS.walletTick) {
    bc.walletAcc -= BC_DEFAULTS.walletTick;
    if (p < bc.walletMax) p += BC_DEFAULTS.walletPerTick;
  }
  return p;
}

export function tickBcSpawnCd(bc, dt) {
  if (!bc?.spawnCd) return;
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
 * Specialist BC movement + castle attack bookkeeping
 * @returns {{ castleHits: number, blocked: boolean }}
 */
export function updateBcSpecialist(s, dt, enemies, bc) {
  if (!bc || !s) return { castleHits: 0, blocked: false };
  s.bcMode = true;
  s.facing = 1;
  s.y = bc.laneY + (s.bcYOff || 0);

  const blockR = BC_DEFAULTS.unitBlockRange;
  let blocker = null;
  let best = Infinity;
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.x < s.x - 8) continue;
    const d = e.x - s.x;
    if (d < best && d < (s.def.range || 80) + 20) {
      // melee-ish block when close
      if (d < blockR + Math.min(40, (s.def.range || 40) * 0.25)) {
        best = d;
        blocker = e;
      }
    }
  }

  const castleX = bc.enemyBase.x;
  const distCastle = castleX - s.x;
  const atCastle = distCastle <= BC_DEFAULTS.baseMeleeRange + 10;

  if (blocker) {
    // stop and let combat system shoot
    s.attackT = Math.min(1, (s.attackT || 0) + dt * 3);
    return { castleHits: 0, blocked: true };
  }

  if (atCastle) {
    s.attackT = Math.min(1, (s.attackT || 0) + dt * 3);
    s._castleAtk = (s._castleAtk || 0) - dt;
    if (s._castleAtk <= 0) {
      s._castleAtk = BC_DEFAULTS.castleHitInterval;
      const dmg = Math.max(3, Math.round((s.def.damage || 8) * 0.85));
      return { castleHits: dmg, blocked: true };
    }
    return { castleHits: 0, blocked: true };
  }

  // walk right
  const speed = BC_DEFAULTS.walkSpeed * (0.85 + Math.min(0.5, (s.def.range || 60) / 200));
  s.x += speed * dt;
  if (s.x > castleX - 20) s.x = castleX - 20;
  s.attackT = Math.max(0, (s.attackT || 0) - dt);
  return { castleHits: 0, blocked: false };
}

/** Nudge enemy onto BC lane; slight vertical variance */
export function placeEnemyOnBcLane(enemy, bc, index = 0) {
  if (!enemy || !bc) return;
  enemy.bcMode = true;
  enemy.bcYOff = ((index % 5) - 2) * 6;
  enemy.y = bc.laneY + enemy.bcYOff;
  // Prefer starting near enemy base if just spawned far right
  if (enemy.x > bc.enemyBase.x - 20) {
    enemy.x = bc.enemyBase.x - 10 - (index % 3) * 8;
  }
}

export function damageEnemyCastle(bc, amount) {
  if (!bc || amount <= 0) return false;
  bc.enemyCastleHp = Math.max(0, bc.enemyCastleHp - amount);
  return bc.enemyCastleHp <= 0;
}
