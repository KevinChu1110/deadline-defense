import { ENEMIES } from "../data/enemies.js";
import { SPECIALISTS } from "../data/specialists.js";
import { samplePath, dist2 } from "./path.js";

let nextId = 1;
const uid = () => nextId++;

/**
 * @param {string} typeId
 * @param {string} pathKey
 * @param {*} pathMetrics
 * @param {object} opts hpScale, speedScale, leakScale, distanceRatio
 */
export function createEnemy(typeId, pathKey, pathMetrics, opts = {}) {
  const base = ENEMIES[typeId];
  if (!base) throw new Error(`Unknown enemy: ${typeId}`);

  const hpScale = opts.hpScale ?? 1;
  const speedScale = opts.speedScale ?? 1;
  const leakScale = opts.leakScale ?? 1;

  const def = {
    ...base,
    hp: Math.max(1, Math.round(base.hp * hpScale)),
    speed: base.speed * speedScale,
    leakDamage: Math.max(1, Math.ceil((base.leakDamage || 1) * leakScale)),
  };

  let distance = 0;
  if (opts.distanceRatio != null && pathMetrics?.total) {
    distance = Math.max(0, Math.min(0.95, opts.distanceRatio)) * pathMetrics.total;
  }
  const pos = samplePath(pathMetrics, distance);

  return {
    id: uid(),
    typeId,
    def,
    pathKey,
    pathMetrics,
    hp: def.hp,
    maxHp: def.hp,
    distance,
    x: pos.x,
    y: pos.y,
    alive: true,
    leaked: false,
    hidden: !!def.stealth,
    revealed: false,
    revived: false,
    healsUsed: 0,
    hitFlash: 0,
    animTime: Math.random() * 10,
    summonCd: def.summonInterval ? def.summonInterval * (0.4 + Math.random() * 0.4) : 0,
    pathSwapped: false,
    speedBurstUsed: false,
    armorPhased: false,
    phasesFired: {},
    pendingSpawns: [],
    status: {
      slowUntil: 0,
      slowPower: 1,
      burnUntil: 0,
      burnDps: 0,
      analyzedUntil: 0,
      analyzedMult: 1,
      hastePower: 1,
    },
  };
}

export function createSpecialist(typeId, padIndex, pad, leveledDef = null) {
  const def = leveledDef || SPECIALISTS[typeId];
  if (!def) throw new Error(`Unknown specialist: ${typeId}`);
  return {
    id: uid(),
    typeId,
    def,
    padIndex,
    x: pad.x,
    y: pad.y,
    cooldown: 0,
    selected: false,
    kills: 0,
    attackT: 0,
    facing: 1,
    cardLevel: def.cardLevel || 1,
  };
}

export function createProjectile(from, to, def, effectPayload = {}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let ang = Math.atan2(dy, dx);
  if (effectPayload.angleOffset) ang += effectPayload.angleOffset;
  const speed = def.projectileSpeed;
  return {
    id: uid(),
    x: from.x,
    y: from.y - 4,
    vx: Math.cos(ang) * speed,
    vy: Math.sin(ang) * speed,
    targetId: to.id,
    damage: def.damage,
    color: def.color,
    radius: 6,
    alive: true,
    effect: def.effect,
    effectDuration: def.effectDuration,
    effectPower: def.effectPower,
    ownerId: from.id,
    projectileKind: def.anim?.projectile || "bolt",
    ...effectPayload,
  };
}

export function fireSpecialist(specialist, target) {
  const def = specialist.def;
  specialist.attackT = def.anim?.attackDuration || 0.3;
  specialist.facing = target.x >= specialist.x ? 1 : -1;
  specialist.cooldown = def.interval;

  const shots = [];
  const multi = def.anim?.multiShot || 1;
  const spread = def.anim?.multiShotSpread || 0;
  for (let i = 0; i < multi; i++) {
    const offset = multi === 1 ? 0 : (i - (multi - 1) / 2) * spread;
    shots.push(createProjectile(specialist, target, def, { angleOffset: offset }));
  }
  return shots;
}

/**
 * @param {object} ctx { buffs, pathMetricsMap, auras: [{x,y,r,power}] }
 */
export function updateEnemy(enemy, dt, now, ctx = {}) {
  if (!enemy.alive) return;

  const buffs = ctx.buffs || {};
  const pathMetricsMap = ctx.pathMetricsMap || {};

  enemy.animTime += dt;
  if (enemy.hitFlash > 0) enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);

  // haste aura from other units
  let haste = 1;
  if (ctx.auras?.length) {
    for (const a of ctx.auras) {
      if (a.id === enemy.id) continue;
      if (Math.hypot(enemy.x - a.x, enemy.y - a.y) <= a.r) {
        haste = Math.max(haste, 1 + a.power);
      }
    }
  }
  enemy.status.hastePower = haste;

  if (enemy.status.burnUntil > now) {
    enemy.hp -= enemy.status.burnDps * dt;
  }

  if (buffs.coreSlowRadius > 0 && buffs.corePos) {
    const d = Math.hypot(enemy.x - buffs.corePos.x, enemy.y - buffs.corePos.y);
    if (d <= buffs.coreSlowRadius) {
      enemy.status.slowUntil = Math.max(enemy.status.slowUntil, now + 0.05);
      enemy.status.slowPower = Math.min(enemy.status.slowPower, buffs.coreSlowPower || 0.55);
    }
  }

  // boss heal once
  if (
    enemy.def.healOnceAt != null &&
    enemy.healsUsed === 0 &&
    enemy.hp / enemy.maxHp <= enemy.def.healOnceAt
  ) {
    enemy.healsUsed = 1;
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * 0.35);
  }

  // speed burst
  if (
    enemy.def.speedBurstAt != null &&
    !enemy.speedBurstUsed &&
    enemy.hp / enemy.maxHp <= enemy.def.speedBurstAt
  ) {
    enemy.speedBurstUsed = true;
  }

  // armor phase (gargoyle)
  if (
    enemy.def.phaseArmorBreakAt != null &&
    !enemy.armorPhased &&
    enemy.hp / enemy.maxHp <= enemy.def.phaseArmorBreakAt
  ) {
    enemy.armorPhased = true;
    enemy.def = { ...enemy.def, armor: enemy.def.phaseArmorValue ?? 0.1 };
  }

  // phase spawns
  if (enemy.def.phaseSpawns) {
    for (const ph of enemy.def.phaseSpawns) {
      const key = String(ph.at);
      if (!enemy.phasesFired[key] && enemy.hp / enemy.maxHp <= ph.at) {
        enemy.phasesFired[key] = true;
        enemy.pendingSpawns.push({
          units: ph.units,
          pathMode: ph.path || "same",
          distanceRatio: ph.distanceRatio,
        });
      }
    }
  }

  // summon
  if (enemy.def.summonInterval && enemy.def.summonType) {
    enemy.summonCd -= dt;
    if (enemy.summonCd <= 0) {
      enemy.summonCd = enemy.def.summonInterval;
      enemy.pendingSpawns.push({
        units: [[enemy.def.summonType, enemy.def.summonCount || 1]],
        pathMode: "same",
        distanceRatio: Math.min(0.9, enemy.distance / (enemy.pathMetrics.total || 1)),
      });
    }
  }

  // path swap
  if (
    enemy.def.pathSwapAt != null &&
    !enemy.pathSwapped &&
    enemy.pathMetrics?.total > 0 &&
    enemy.distance / enemy.pathMetrics.total >= enemy.def.pathSwapAt
  ) {
    const alt =
      enemy.def.pathSwapTo ||
      (enemy.pathKey === "workflow" ? "event" : enemy.pathKey === "event" ? "workflow" : null);
    // three-path stages: cycle
    if (!alt && pathMetricsMap.pathC) {
      const keys = Object.keys(pathMetricsMap);
      const i = keys.indexOf(enemy.pathKey);
      const next = keys[(i + 1) % keys.length];
      const m = pathMetricsMap[next];
      if (m) {
        const ratio = enemy.distance / enemy.pathMetrics.total;
        enemy.pathKey = next;
        enemy.pathMetrics = m;
        enemy.distance = m.total * ratio;
        enemy.pathSwapped = true;
      }
    } else if (alt && pathMetricsMap[alt]) {
      const ratio = enemy.distance / enemy.pathMetrics.total;
      enemy.pathKey = alt;
      enemy.pathMetrics = pathMetricsMap[alt];
      enemy.distance = enemy.pathMetrics.total * ratio;
      enemy.pathSwapped = true;
    }
  }

  if (enemy.hp <= 0) {
    if (enemy.def.reviveOnce && !enemy.revived) {
      enemy.revived = true;
      enemy.hp = enemy.maxHp * 0.55;
      enemy.distance = Math.max(0, enemy.distance - 40);
    } else {
      if (enemy.def.splitOnDeath) {
        const { type, count } = enemy.def.splitOnDeath;
        enemy.pendingSpawns.push({
          units: [[type, count || 2]],
          pathMode: "same",
          distanceRatio: Math.min(0.9, enemy.distance / (enemy.pathMetrics.total || 1)),
        });
      }
      enemy.alive = false;
      return;
    }
  }

  let speed = enemy.def.speed * (enemy.status.hastePower || 1);
  if (enemy.speedBurstUsed && enemy.def.speedBurstMult) {
    speed *= enemy.def.speedBurstMult;
  }
  if (enemy.status.slowUntil > now) {
    let slowMul = enemy.status.slowPower;
    if (enemy.def.slowResist) {
      // resist: pull slow toward 1
      slowMul = 1 - (1 - slowMul) * (1 - enemy.def.slowResist);
    }
    speed *= slowMul;
  }

  const metrics = enemy.pathMetrics;
  enemy.distance += speed * dt;
  if (enemy.distance >= metrics.total) {
    enemy.alive = false;
    enemy.leaked = true;
    return;
  }

  const pos = samplePath(metrics, enemy.distance);
  enemy.x = pos.x;
  enemy.y = pos.y;
}

export function updateSpecialist(specialist, dt) {
  if (specialist.attackT > 0) {
    specialist.attackT = Math.max(0, specialist.attackT - dt);
  }
  specialist.cooldown = Math.max(0, specialist.cooldown - dt);
}

export function isTargetable(enemy, specialist, now) {
  if (!enemy.alive) return false;
  if (enemy.hidden && !enemy.revealed && specialist.def.effect !== "analyzed") {
    if (enemy.status.analyzedUntil <= now) return false;
  }
  const r = specialist.def.range;
  return dist2(specialist.x, specialist.y, enemy.x, enemy.y) <= r * r;
}

export function applyHit(enemy, projectile, now, buffs = {}) {
  if (!enemy.alive) return false;

  let dmg = projectile.damage * (buffs.damageMult || 1);
  if (enemy.status.analyzedUntil > now) {
    dmg *= enemy.status.analyzedMult;
  }
  if (enemy.def.armor) {
    const armor = Math.max(0, enemy.def.armor - (buffs.armorBreak || 0));
    dmg *= 1 - armor;
  }
  enemy.hp -= dmg;
  enemy.hitFlash = 0.12;

  if (projectile.effect === "slow") {
    enemy.status.slowUntil = now + projectile.effectDuration;
    enemy.status.slowPower = projectile.effectPower;
  } else if (projectile.effect === "burn") {
    enemy.status.burnUntil = now + projectile.effectDuration;
    enemy.status.burnDps = projectile.effectPower * (buffs.damageMult || 1);
  } else if (projectile.effect === "analyzed") {
    enemy.status.analyzedUntil = now + projectile.effectDuration;
    enemy.status.analyzedMult = projectile.effectPower;
    enemy.revealed = true;
    enemy.hidden = false;
  }

  if (enemy.hp <= 0) {
    if (enemy.def.reviveOnce && !enemy.revived) {
      enemy.revived = true;
      enemy.hp = enemy.maxHp * 0.55;
      return false;
    }
    if (enemy.def.splitOnDeath) {
      const { type, count } = enemy.def.splitOnDeath;
      enemy.pendingSpawns.push({
        units: [[type, count || 2]],
        pathMode: "same",
        distanceRatio: Math.min(0.9, enemy.distance / (enemy.pathMetrics.total || 1)),
      });
    }
    enemy.alive = false;
    return true;
  }
  return false;
}

export function updateProjectile(p, dt, enemiesById) {
  if (!p.alive) return;
  const target = enemiesById.get(p.targetId);
  if (!target || !target.alive) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life = (p.life ?? 0.35) - dt;
    if (p.life <= 0) p.alive = false;
    return;
  }

  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const dist = Math.hypot(dx, dy);
  const step = Math.hypot(p.vx, p.vy) * dt;
  if (dist <= step + target.def.radius) {
    p.x = target.x;
    p.y = target.y;
    p.alive = false;
    p.hit = true;
    return;
  }
  const spd = Math.hypot(p.vx, p.vy);
  const home = p.projectileKind === "star" ? 0.35 : 0.85;
  const tx = (dx / dist) * spd;
  const ty = (dy / dist) * spd;
  p.vx = p.vx * (1 - home) + tx * home;
  p.vy = p.vy * (1 - home) + ty * home;
  const cur = Math.hypot(p.vx, p.vy) || 1;
  p.vx = (p.vx / cur) * spd;
  p.vy = (p.vy / cur) * spd;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
}
