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

// ── 各武器語意的命中爆點（依 projectileKind 分化，讓刀/斧/棍/暗器/拳霸/火槍長得都不同）──

/** 斧/棍等重武器：更寬更慢的斬擊 + 地面震波，有重量感 */
export function createHeavySlash(x, y, facing = 1, color = "#fcd34d") {
  return [
    { id: Math.random().toString(36).slice(2), kind: "slash", x, y, facing, color, life: 0.28, maxLife: 0.28, scale: 1.6 },
    createShockwave(x, y + 4, color),
    ...createParticles(x, y, color, 8, { speed: 70, life: 0.35, size: 3, gravity: 40 }),
  ];
}

/** 聖屬斬（白騎/騎士）：十字光斬 */
export function createHolySlash(x, y, facing = 1) {
  return [
    { id: Math.random().toString(36).slice(2), kind: "slash", x, y, facing, color: "#fff7cc", life: 0.22, maxLife: 0.22, scale: 1.2 },
    { id: Math.random().toString(36).slice(2), kind: "slash", x, y, facing: -facing, color: "#fde68a", life: 0.22, maxLife: 0.22, scale: 1.0 },
    createHitFlash(x, y, "#fefce8", { r: 22 }),
  ];
}

/** 暗屬斬（黑騎/暗之靈魂/進階鬥氣）：紫黑斬 + 紫色鬥氣環 */
export function createDarkSlash(x, y, facing = 1) {
  return [
    { id: Math.random().toString(36).slice(2), kind: "slash", x, y, facing, color: "#c084fc", life: 0.26, maxLife: 0.26, scale: 1.3 },
    createRing(x, y, "#7c3aed", { maxR: 34, life: 0.3, lineWidth: 3 }),
    createRing(x, y, "#a855f7", { maxR: 20, life: 0.24, lineWidth: 2 }),
    ...createParticles(x, y, "#6d28d9", 10, { speed: 70, life: 0.4, size: 2.6, gravity: -10 }),
  ];
}

/** 連斬（英雄無雙劍舞）：三道快斬 */
export function createComboSlash(x, y, facing = 1, color = "#fca5a5") {
  const out = [];
  for (let i = 0; i < 3; i++) {
    out.push({
      id: Math.random().toString(36).slice(2),
      kind: "slash",
      x: x + (i - 1) * 6,
      y: y + (i - 1) * 4,
      facing: i % 2 ? -facing : facing,
      color,
      life: 0.18 + i * 0.03,
      maxLife: 0.18 + i * 0.03,
      scale: 1.1,
    });
  }
  out.push(createHitFlash(x, y, "#fee2e2", { r: 20 }));
  return out;
}

/** 龍息（幻影龍咆哮/召喚神龍）：綠焰爆吐 */
export function createDragonBurst(x, y) {
  return [
    createRing(x, y, "#4ade80", { maxR: 50, life: 0.34, lineWidth: 3 }),
    ...createParticles(x, y, "#86efac", 12, { speed: 110, life: 0.5, size: 3.2, gravity: -20 }),
    ...createParticles(x, y, "#bbf7d0", 6, { speed: 60, life: 0.35, size: 2, gravity: -30 }),
    createHitFlash(x, y, "#dcfce7", { r: 26 }),
  ];
}

/** 暗器/手裡劍（暗殺/風魔）：旋轉暗影火花 */
export function createShadowSpin(x, y, color = "#c4b5fd") {
  const out = [createHitFlash(x, y, color, { r: 14, life: 0.1 })];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6;
    out.push(...createParticles(x + Math.cos(a) * 4, y + Math.sin(a) * 4, "#7c3aed", 1, {
      speed: 90, life: 0.24, size: 1.8, gravity: 0,
    }));
  }
  return out;
}

/** 撲克牌（夜使者三飛閃）：彩色牌花飛散 */
export function createCardBurst(x, y) {
  const colors = ["#f87171", "#60a5fa", "#facc15", "#4ade80"];
  const out = [createHitFlash(x, y, "#fff", { r: 14 })];
  for (const c of colors) {
    out.push(...createParticles(x, y, c, 3, { speed: 95, life: 0.35, size: 2.4, gravity: 25 }));
  }
  return out;
}

/** 子彈/散射（神槍手）：槍口爆焰 + 煙 */
export function createBulletBurst(x, y, color = "#fcd34d") {
  return [
    createHitFlash(x, y, color, { r: 18, life: 0.08 }),
    ...createParticles(x, y, "#fbbf24", 6, { speed: 130, life: 0.2, size: 2.2, gravity: 0 }),
    ...createParticles(x, y, "#9ca3af", 4, { speed: 40, life: 0.35, size: 3, gravity: -15 }),
  ];
}

/** 加農砲（海盜大招）：大爆炸 */
export function createCannonBurst(x, y) {
  return [
    createShockwave(x, y, "#fb923c"),
    createRing(x, y, "#f97316", { maxR: 60, life: 0.36, lineWidth: 3 }),
    ...createParticles(x, y, "#fdba74", 16, { speed: 140, life: 0.5, size: 3.5, gravity: -10 }),
    createHitFlash(x, y, "#fed7aa", { r: 32 }),
  ];
}

/** 拳霸（打手/衝擊拳）：衝擊震波 + 白閃 */
export function createPunchImpact(x, y, color = "#fda4af") {
  return [
    createShockwave(x, y, color),
    createHitFlash(x, y, "#fff", { r: 20, life: 0.1 }),
    ...createParticles(x, y, color, 6, { speed: 110, life: 0.25, size: 2.6, gravity: 0 }),
  ];
}

/**
 * 依 projectileKind 回傳該武器的招牌命中特效。
 * 這是「刀/斧/棍/劍/暗器/飛鏢/火槍/拳霸/龍息…長得都不一樣」的核心。
 */
function vfxByProjectileKind(kind, x, y, facing, color) {
  switch (kind) {
    case "sword":
      return [createSlashArc(x, y, facing, color || "#fde68a")];
    case "heavy":
      return createHeavySlash(x, y, facing, color || "#fcd34d");
    case "holy_slash":
      return createHolySlash(x, y, facing);
    case "dark_slash":
      return createDarkSlash(x, y, facing);
    case "combo":
      return createComboSlash(x, y, facing, color || "#fca5a5");
    case "fireball":
      return createFireBurst(x, y);
    case "iceball":
      return createIceBurst(x, y);
    case "holy":
      return createHolyBurst(x, y);
    case "dragon":
      return createDragonBurst(x, y);
    case "arrow":
      return createArrowSpark(x, y, color || "#86efac");
    case "bolt_arrow":
      return createArrowSpark(x, y, color || "#7dd3fc");
    case "star":
      return createShadowSpin(x, y, color || "#c4b5fd");
    case "dart":
      return createShadowSpin(x, y, color || "#a5b4fc");
    case "card":
      return createCardBurst(x, y);
    case "bullet":
      return createBulletBurst(x, y, color || "#fcd34d");
    case "cannon":
      return createCannonBurst(x, y);
    case "punch":
      return createPunchImpact(x, y, color || "#fda4af");
    default:
      return [];
  }
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

  const facing = owner?.facing || 1;

  // base impact
  fx.push(createHitFlash(x, y, projectile.color || "#fff", { r: heavy ? 28 : 16 }));
  fx.push(
    ...createParticles(x, y, projectile.color || target.def?.color || "#fff", heavy ? 12 : 6, {
      speed: heavy ? 100 : 55,
      size: heavy ? 3.5 : 2.2,
    })
  );

  // 狀態效果優先（燃燒/冰緩/破隱/貫穿）——這些是遊戲機制，要一眼看懂
  if (effect === "burn" || skill.burnStacks) {
    fx.push(...createFireBurst(x, y));
  } else if (effect === "slow" || skill.slowChain) {
    fx.push(...createIceBurst(x, y));
  } else if (effect === "analyzed" || skill.revealOnHit) {
    fx.push(...createHolyBurst(x, y));
    fx.push(createFloatText(x, y - 14, "破隱", "#fef08a"));
  } else {
    // 否則依「武器語意」給招牌命中特效（sword/heavy/holy_slash/dark_slash/combo/
    // fireball/iceball/holy/dragon/arrow/bolt_arrow/star/dart/card/bullet/cannon/punch）
    const kindFx = vfxByProjectileKind(
      projectile.projectileKind,
      x,
      y,
      facing,
      projectile.color
    );
    if (kindFx.length) {
      fx.push(...kindFx);
    } else {
      // 沒對到 kind 才退回家族預設
      if (fam === "thief") fx.push(...createShadowBurst(x, y));
      else if (fam === "warrior") fx.push(createSlashArc(x, y, facing, projectile.color || "#fde68a"));
      else if (fam === "pirate") fx.push(createShockwave(x, y, projectile.color || "#fda4af"));
      else if (fam === "archer") fx.push(...createArrowSpark(x, y, projectile.color || "#86efac"));
      else if (fam === "mage") fx.push(...createHolyBurst(x, y));
    }
    if (skill.pierce) fx.push(createFloatText(x + 8, y - 10, "貫穿", "#86efac"));
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
