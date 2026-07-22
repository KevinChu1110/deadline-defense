import { ENEMIES } from "../data/enemies.js";
import { SPECIALISTS } from "../data/specialists.js";
import { getJobSkill, deriveEnemyTags } from "../data/combat-skills.js";
import { samplePath, dist2 } from "./path.js";
import {
  initBossAttackState,
  tickBossAttacks,
  getBossArmorBonus,
  getBossHasteBonus,
  isBossImmune,
  getBossReflectStun,
} from "./boss-attacks.js";

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

  const tags = deriveEnemyTags(def);
  const enemy = {
    id: uid(),
    typeId,
    def,
    tags,
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
    hitCountFrom: {}, // ownerId -> hits (rage/lock)
    burnStacks: 0,
    bossEvents: [],
    status: {
      slowUntil: 0,
      slowPower: 1,
      burnUntil: 0,
      burnDps: 0,
      analyzedUntil: 0,
      analyzedMult: 1,
      hastePower: 1,
      armorBreakUntil: 0,
      armorBreakAmt: 0,
      noSlow: false,
      hazardSpeedMul: 1,
      bossArmorUntil: 0,
      bossArmorAdd: 0,
      bossHasteUntil: 0,
      bossHasteAdd: 0,
    },
  };
  initBossAttackState(enemy);
  return enemy;
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
    stunnedUntil: 0,
    silencedUntil: 0,
    cursedUntil: 0,
    curseDmgMul: 1,
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

export function fireSpecialist(specialist, target, extras = {}) {
  const def = specialist.def;
  const skill = getJobSkill(specialist.typeId);
  specialist.attackT = def.anim?.attackDuration || 0.3;
  specialist.facing = target.x >= specialist.x ? 1 : -1;
  specialist.cooldown = def.interval;
  specialist.hitSerial = (specialist.hitSerial || 0) + 1;

  const shots = [];
  const multi =
    skill.multiShot || def.anim?.multiShot || 1;
  const spread = skill.multiShotSpread || def.anim?.multiShotSpread || 0;
  for (let i = 0; i < multi; i++) {
    const offset = multi === 1 ? 0 : (i - (multi - 1) / 2) * spread;
    shots.push(
      createProjectile(specialist, target, def, {
        angleOffset: offset,
        skill,
        pierceLeft: skill.pierce || 0,
        pierceFalloff: skill.pierceFalloff || 0.7,
        hitIds: new Set(),
        splashR: skill.splashR || 0,
        splashMult: skill.splashMult || 0,
        chainLeft: skill.chain || 0,
        chainFalloff: skill.chainFalloff || 0.55,
      })
    );
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

  // haste aura from other units + boss self haste buff
  let haste = 1;
  if (ctx.auras?.length) {
    for (const a of ctx.auras) {
      if (a.id === enemy.id) continue;
      if (Math.hypot(enemy.x - a.x, enemy.y - a.y) <= a.r) {
        haste = Math.max(haste, 1 + a.power);
      }
    }
  }
  haste = Math.max(haste, 1 + getBossHasteBonus(enemy, now));
  if (enemy.status._hasteExpire && enemy.status._hasteExpire < now) {
    enemy.status._hasteExpire = 0;
  } else if (enemy.status._hasteExpire > now) {
    haste = Math.max(haste, enemy.status.hastePower || 1);
  }
  enemy.status.hastePower = haste;

  // boss attacks (telegraph → cast events)
  if (enemy.def.boss) {
    enemy.bossEvents = tickBossAttacks(enemy, dt, now);
  } else {
    enemy.bossEvents = [];
  }

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

  // phase spawns + banner flags
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
  if (enemy.def.phaseBanner) {
    for (const ph of enemy.def.phaseBanner) {
      const key = `banner_${ph.at}`;
      if (!enemy.phasesFired[key] && enemy.hp / enemy.maxHp <= ph.at) {
        enemy.phasesFired[key] = true;
        enemy._pendingBanner = ph.text || "Boss 相位";
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
  // stall zones from paladin-type
  if (ctx.stallZones?.length) {
    for (const z of ctx.stallZones) {
      if (Math.hypot(enemy.x - z.x, enemy.y - z.y) <= z.r) {
        speed *= z.mul || 0.85;
      }
    }
  }
  // hazard speed
  if (enemy.status.hazardSpeedMul) speed *= enemy.status.hazardSpeedMul;
  if (ctx.hazardExtraDist) {
    enemy.distance += ctx.hazardExtraDist;
  }
  if (enemy.status.slowUntil > now && !enemy.status.noSlow) {
    let slowMul = enemy.status.slowPower;
    // soft-cap slow at 0.45 min speed factor
    slowMul = Math.max(0.45, slowMul);
    if (enemy.def.slowResist || enemy.tags?.includes("swift")) {
      const resist = enemy.def.slowResist || 0.35;
      slowMul = 1 - (1 - slowMul) * (1 - resist);
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

export function isSpecialistDisabled(specialist, now) {
  return (
    (specialist.stunnedUntil || 0) > now || (specialist.silencedUntil || 0) > now
  );
}

export function isTargetable(enemy, specialist, now) {
  if (!enemy.alive) return false;
  const skill = getJobSkill(specialist.typeId);
  const canReveal =
    specialist.def.effect === "analyzed" || skill.revealOnHit;
  if (enemy.hidden && !enemy.revealed && !canReveal) {
    if (enemy.status.analyzedUntil <= now) return false;
  }
  // 含怪物碰撞半徑，避免「圈碰到怪中心才算」造成邊緣點位打不到
  const r = (specialist.def.range || 0) + (enemy.def?.radius || 12) * 0.55;
  return dist2(specialist.x, specialist.y, enemy.x, enemy.y) <= r * r;
}

/** Soft damage mult from tags (never 0) */
export function softDamageMult(enemy, skill, now, buffs = {}) {
  let m = 1;
  const armored =
    enemy.def.armor > 0 || enemy.tags?.includes("armored");
  const broken =
    (buffs.armorBreak || 0) +
      (enemy.status.armorBreakUntil > now ? enemy.status.armorBreakAmt || 0 : 0) >
    0.05;
  if (armored && !broken) m *= 0.65;
  if (enemy.tags?.includes("dense") && !skill?.burnStacks) m *= 0.85;
  if (enemy.hidden && !enemy.revealed && enemy.status.analyzedUntil <= now) m *= 0.5;
  if (enemy.status.analyzedUntil > now) {
    m *= Math.min(1.55, enemy.status.analyzedMult || 1.2);
  }
  if (enemy.tags?.includes("flyer") && skill?.flyerBonus) m *= skill.flyerBonus;
  return m;
}

export function applyHit(enemy, projectile, now, buffs = {}, ctx = {}) {
  if (!enemy.alive) return false;

  // Boss 物理／縮頭無效
  if (isBossImmune(enemy, now)) {
    projectile._lastDmg = 0;
    projectile._wasCrit = false;
    enemy.hitFlash = 0.06;
    return false;
  }

  const skill = projectile.skill || {};
  const ownerId = projectile.ownerId;

  // rage / lock-on stacks
  if (ownerId != null) {
    enemy.hitCountFrom[ownerId] = (enemy.hitCountFrom[ownerId] || 0) + 1;
  }
  let stackMult = 1;
  if (skill.rageHits && ownerId != null) {
    const hits = enemy.hitCountFrom[ownerId] || 0;
    if (hits >= skill.rageHits) stackMult *= skill.rageMult || 1.3;
  }
  if (skill.lockOn && ownerId != null) {
    const hits = Math.min(skill.lockOnMax || 5, enemy.hitCountFrom[ownerId] || 0);
    stackMult *= 1 + (skill.lockOnMult || 0.15) * (hits - 1);
  }
  // frontline amp
  if (skill.frontlineAmp && enemy.pathMetrics?.total) {
    const ratio = enemy.distance / enemy.pathMetrics.total;
    if (ratio >= 1 - (skill.frontlineRatio || 0.35)) {
      stackMult *= 1 + skill.frontlineAmp;
    } else {
      stackMult *= 0.9;
    }
  }

  let dmg =
    projectile.damage * (buffs.damageMult || 1) * stackMult * softDamageMult(enemy, skill, now, buffs);

  // 職業被詛咒時輸出下降
  const owner = ctx.allies?.find?.((s) => s.id === ownerId) || ctx.owner;
  if (owner && (owner.cursedUntil || 0) > now) {
    dmg *= owner.curseDmgMul || 0.75;
  }

  // armor with break + boss temporary armor
  {
    let armor = enemy.def.armor || 0;
    armor += getBossArmorBonus(enemy, now);
    let breakAmt = buffs.armorBreak || 0;
    if (enemy.status.armorBreakUntil > now) breakAmt += enemy.status.armorBreakAmt || 0;
    if (skill.armorBreakOnHit) breakAmt += skill.armorBreakOnHit;
    armor = Math.max(0, armor - breakAmt);
    if (armor > 0) dmg *= 1 - Math.min(0.75, armor);
  }

  // crit
  let wasCrit = false;
  if (skill.critChance && Math.random() < skill.critChance) {
    dmg *= skill.critMult || 1.75;
    wasCrit = true;
  }

  enemy.hp -= dmg;
  enemy.hitFlash = 0.12;
  projectile._lastDmg = dmg;
  projectile._wasCrit = wasCrit;

  // Boss 反射：反震攻擊者
  const refStun = getBossReflectStun(enemy, now);
  if (refStun > 0 && owner) {
    owner.stunnedUntil = Math.max(owner.stunnedUntil || 0, now + refStun);
  }

  // base effects
  if (projectile.effect === "slow" || skill.slowChain) {
    const power = Math.min(
      enemy.status.slowPower,
      projectile.effectPower || skill.slowChainPower || 0.7
    );
    enemy.status.slowUntil = Math.max(
      enemy.status.slowUntil,
      now + (projectile.effectDuration || 1.2)
    );
    enemy.status.slowPower = Math.min(enemy.status.slowPower || 1, power);
  }
  if (projectile.effect === "burn" || skill.burnStacks) {
    enemy.status.burnUntil = now + (projectile.effectDuration || 2.5);
    enemy.status.burnDps = Math.max(
      enemy.status.burnDps || 0,
      (projectile.effectPower || 4) * (buffs.damageMult || 1)
    );
    enemy.burnStacks = (enemy.burnStacks || 0) + 1;
    if (skill.burnDetonate && enemy.burnStacks >= (skill.burnStacks || 3)) {
      enemy.burnStacks = 0;
      enemy.hp -= (projectile.damage || 10) * 0.8;
      projectile._detonate = true;
      if (skill.armorBreakOnHit) {
        enemy.status.armorBreakUntil = now + 3;
        enemy.status.armorBreakAmt = Math.max(
          enemy.status.armorBreakAmt || 0,
          skill.armorBreakOnHit
        );
      }
    }
  }
  if (projectile.effect === "analyzed" || skill.revealOnHit) {
    enemy.status.analyzedUntil = now + (projectile.effectDuration || 3.5);
    enemy.status.analyzedMult = Math.max(
      enemy.status.analyzedMult || 1,
      projectile.effectPower || 1.25
    );
    enemy.revealed = true;
    enemy.hidden = false;
  }
  if (skill.armorBreakOnHit && !skill.burnDetonate) {
    enemy.status.armorBreakUntil = now + 2.5;
    enemy.status.armorBreakAmt = Math.max(
      enemy.status.armorBreakAmt || 0,
      skill.armorBreakOnHit
    );
  }

  // knockback along path
  if (skill.knockbackPath && (!enemy.def.boss || skill.knockbackBossSlow)) {
    if (enemy.def.boss) {
      enemy.status.slowUntil = now + 0.8;
      enemy.status.slowPower = Math.min(enemy.status.slowPower || 1, 0.8);
    } else {
      enemy.distance = Math.max(0, enemy.distance - (skill.knockbackPath || 12));
    }
  }

  // meso crit bonus flag for Game
  if (wasCrit && skill.critMesoBonus) {
    projectile._mesoBonus = skill.critMesoBonus;
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
    if (skill.killLifesteal && ctx.allies?.length) {
      projectile._lifesteal = skill.killLifesteal;
    }
    return true;
  }
  return false;
}

/** Target score for pick */
export function scoreTarget(enemy, specialist, now) {
  const skill = getJobSkill(specialist.typeId);
  let score = enemy.distance * 2 - enemy.hp * 0.05 + (enemy.def.boss ? 80 : 0);
  if (enemy.status.analyzedUntil > now) score += 40;
  if (enemy.tags?.includes("armored") && skill.armorBreakOnHit) score += 25;
  if (enemy.hidden || enemy.tags?.includes("stealth")) {
    if (skill.revealOnHit || specialist.def.effect === "analyzed") score += 50;
    else score -= 100;
  }
  if (skill.frontlineAmp && enemy.pathMetrics?.total) {
    const ratio = enemy.distance / enemy.pathMetrics.total;
    if (ratio >= 1 - (skill.frontlineRatio || 0.35)) score += 60;
  }
  if (skill.lockOn && specialist.lockTargetId === enemy.id) score += 100;
  return score;
}

export function updateProjectile(p, dt, enemiesById) {
  if (!p.alive) return;
  const target = enemiesById.get(p.targetId);
  if (!target || !target.alive) {
    // pierce: try retarget along velocity
    if ((p.pierceLeft || 0) > 0) {
      let best = null;
      let bestD = 80;
      for (const e of enemiesById.values()) {
        if (!e.alive || p.hitIds?.has(e.id)) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (best) {
        p.targetId = best.id;
        const ang = Math.atan2(best.y - p.y, best.x - p.x);
        const sp = Math.hypot(p.vx, p.vy) || 300;
        p.vx = Math.cos(ang) * sp;
        p.vy = Math.sin(ang) * sp;
        return;
      }
    }
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
  if (dist <= step + (target.def.radius || 14)) {
    p.x = target.x;
    p.y = target.y;
    p.hit = true;
    if (!p.hitIds) p.hitIds = new Set();
    p.hitIds.add(target.id);
    if ((p.pierceLeft || 0) > 0) {
      p.pierceLeft -= 1;
      p.damage *= p.pierceFalloff || 0.7;
      p.hit = true; // process hit once in Game, then continue if pierce
      p._pierceContinue = p.pierceLeft > 0;
      if (!p._pierceContinue) p.alive = false;
    } else {
      p.alive = false;
    }
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
