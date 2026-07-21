/**
 * 受擊 / 技能差異化特效
 */
import {
  createParticles,
  createRing,
  createFloatText,
  createMuzzle,
} from "./fx.js";
import { getJobSkill } from "../data/combat-skills.js";

export function createHitFlash(x, y, color, opts = {}) {
  return {
    id: Math.random().toString(36).slice(2),
    kind: "hitFlash",
    x,
    y,
    color,
    life: opts.life ?? 0.14,
    maxLife: opts.life ?? 0.14,
    r: opts.r ?? 18,
  };
}

export function createSlashArc(x, y, facing = 1, color = "#fde68a") {
  return {
    id: Math.random().toString(36).slice(2),
    kind: "slash",
    x,
    y,
    facing,
    color,
    life: 0.2,
    maxLife: 0.2,
  };
}

export function createIceBurst(x, y) {
  return [
    createRing(x, y, "#7dd3fc", { maxR: 40, life: 0.28, lineWidth: 3 }),
    ...createParticles(x, y, "#bae6fd", 10, { speed: 90, life: 0.4, size: 2.5, gravity: 20 }),
    createHitFlash(x, y, "#e0f2fe", { r: 22 }),
  ];
}

export function createFireBurst(x, y) {
  return [
    createRing(x, y, "#f97316", { maxR: 44, life: 0.3, lineWidth: 2.5 }),
    ...createParticles(x, y, "#fb923c", 12, { speed: 100, life: 0.45, size: 3, gravity: -10 }),
    ...createParticles(x, y, "#fde047", 6, { speed: 50, life: 0.3, size: 2, gravity: -30 }),
    createHitFlash(x, y, "#fdba74", { r: 24 }),
  ];
}

export function createHolyBurst(x, y) {
  return [
    createRing(x, y, "#fef08a", { maxR: 48, life: 0.35, lineWidth: 2 }),
    createRing(x, y, "#fefce8", { maxR: 28, life: 0.25, lineWidth: 1.5 }),
    ...createParticles(x, y, "#fef9c3", 8, { speed: 70, life: 0.5, gravity: -15 }),
  ];
}

export function createShadowBurst(x, y) {
  return [
    createRing(x, y, "#a78bfa", { maxR: 36, life: 0.25 }),
    ...createParticles(x, y, "#6d28d9", 10, { speed: 80, life: 0.35, gravity: 30 }),
    createHitFlash(x, y, "#c4b5fd", { r: 16 }),
  ];
}

export function createArrowSpark(x, y, color = "#86efac") {
  return [
    createHitFlash(x, y, color, { r: 14, life: 0.1 }),
    ...createParticles(x, y, color, 5, { speed: 120, life: 0.22, size: 1.8, gravity: 10 }),
  ];
}

export function createShockwave(x, y, color = "#fca5a5") {
  return {
    id: Math.random().toString(36).slice(2),
    kind: "shockwave",
    x,
    y,
    r: 8,
    maxR: 56,
    life: 0.32,
    maxLife: 0.32,
    color,
    lineWidth: 3,
  };
}

export function createBossBanner(text, color = "#fca5a5") {
  return {
    id: Math.random().toString(36).slice(2),
    kind: "banner",
    text,
    color,
    life: 2.2,
    maxLife: 2.2,
  };
}

/**
 * Build VFX pack for a hit based on projectile / skill / family
 */
export function buildHitVfx(target, projectile, owner) {
  const fx = [];
  const x = target.x;
  const y = target.y;
  const skill = projectile.skill || getJobSkill(owner?.typeId) || {};
  const fam = owner?.def?.family || "warrior";
  const effect = projectile.effect;
  const typeId = owner?.typeId || "";
  const heavy = !!target.def?.boss || projectile._wasCrit;

  // base impact
  fx.push(createHitFlash(x, y, projectile.color || "#fff", { r: heavy ? 28 : 16 }));
  fx.push(
    ...createParticles(x, y, projectile.color || target.def?.color || "#fff", heavy ? 12 : 6, {
      speed: heavy ? 100 : 55,
      size: heavy ? 3.5 : 2.2,
    })
  );

  // typed by effect / skill / family
  if (effect === "burn" || skill.burnStacks || typeId.includes("fire")) {
    fx.push(...createFireBurst(x, y));
  } else if (effect === "slow" || skill.slowChain || typeId === "ice_mage" || typeId.includes("ice")) {
    fx.push(...createIceBurst(x, y));
  } else if (effect === "analyzed" || skill.revealOnHit) {
    fx.push(...createHolyBurst(x, y));
    fx.push(createFloatText(x, y - 14, "破隱", "#fef08a"));
  } else if (skill.pierce) {
    fx.push(...createArrowSpark(x, y, "#bbf7d0"));
    fx.push(createFloatText(x + 8, y - 10, "貫穿", "#86efac"));
  } else if (skill.multiShot > 1 || fam === "archer") {
    fx.push(...createArrowSpark(x, y, projectile.color || "#86efac"));
  } else if (fam === "thief" || skill.critChance) {
    fx.push(...createShadowBurst(x, y));
  } else if (fam === "warrior" || skill.rageHits || skill.cleaveR) {
    fx.push(createSlashArc(x, y, owner?.facing || 1, projectile.color || "#fde68a"));
  } else if (fam === "pirate" || skill.knockbackPath || skill.lockOn) {
    fx.push(createShockwave(x, y, projectile.color || "#fda4af"));
  } else if (fam === "mage") {
    fx.push(...createHolyBurst(x, y));
  }

  if (skill.splashR > 0 || projectile.splashR > 0) {
    fx.push(
      createRing(x, y, projectile.color || "#fb923c", {
        maxR: (projectile.splashR || skill.splashR || 40) * 0.9,
        life: 0.22,
        lineWidth: 2,
      })
    );
  }

  if (projectile._wasCrit) {
    fx.push(createFloatText(x, y - 22, "CRIT!", "#fbbf24"));
  }
  if (projectile._detonate) {
    fx.push(...createFireBurst(x, y));
    fx.push(createFloatText(x, y - 8, "引爆!", "#fb923c"));
  }
  if (skill.knockbackPath && projectile._knockback) {
    fx.push(createFloatText(x, y - 6, "擊退", "#fda4af"));
  }
  if (projectile._lastDmg != null && (heavy || projectile._wasCrit)) {
    fx.push(
      createFloatText(
        x + (Math.random() * 10 - 5),
        y - 30,
        `${Math.round(projectile._lastDmg)}`,
        heavy ? "#fecdd3" : "#fff"
      )
    );
  }

  return fx;
}

export function buildShootVfx(specialist) {
  const skill = getJobSkill(specialist.typeId) || {};
  const fx = [];
  const x = specialist.x + (specialist.facing || 1) * 10;
  const y = specialist.y - 6;
  const color = specialist.def?.color || "#fff";
  fx.push(createMuzzle(x, y, color));
  if (skill.pierce) {
    fx.push(createRing(x, y, "#86efac", { maxR: 26, life: 0.15 }));
  }
  if (skill.multiShot > 1) {
    fx.push(createRing(x, y, color, { maxR: 22, life: 0.14 }));
    fx.push(...createParticles(x, y, color, 4, { speed: 40, life: 0.15, size: 2, gravity: 0 }));
  }
  if (skill.lockOn) {
    fx.push(createFloatText(x, y - 16, "鎖定", "#fde68a"));
  }
  if (skill.burnStacks) {
    fx.push(...createParticles(x, y, "#fb923c", 5, { speed: 50, life: 0.2, gravity: -20 }));
  }
  if (skill.slowChain) {
    fx.push(...createParticles(x, y, "#7dd3fc", 5, { speed: 45, life: 0.2, gravity: 10 }));
  }
  if (skill.critChance) {
    fx.push(...createParticles(x, y, "#a78bfa", 4, { speed: 55, life: 0.18, gravity: 0 }));
  }
  return fx;
}
