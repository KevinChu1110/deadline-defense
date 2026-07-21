/**
 * Lightweight particle / floating-text FX.
 */

let nextId = 1;

export function createParticles(x, y, color, count = 8, opts = {}) {
  const out = [];
  const speed = opts.speed ?? 60;
  const life = opts.life ?? 0.45;
  const size = opts.size ?? 3;
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = speed * (0.4 + Math.random() * 0.8);
    out.push({
      id: nextId++,
      kind: "particle",
      x,
      y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - 20,
      life,
      maxLife: life,
      color,
      size: size * (0.6 + Math.random() * 0.8),
      gravity: opts.gravity ?? 40,
    });
  }
  return out;
}

export function createRing(x, y, color, opts = {}) {
  return {
    id: nextId++,
    kind: "ring",
    x,
    y,
    r: opts.r ?? 6,
    maxR: opts.maxR ?? 36,
    life: opts.life ?? 0.35,
    maxLife: opts.life ?? 0.35,
    color,
    lineWidth: opts.lineWidth ?? 2,
  };
}

export function createFloatText(x, y, text, color = "#fff") {
  return {
    id: nextId++,
    kind: "text",
    x,
    y,
    vy: -28,
    text,
    color,
    life: 0.7,
    maxLife: 0.7,
  };
}

export function createMuzzle(x, y, color) {
  return {
    id: nextId++,
    kind: "muzzle",
    x,
    y,
    color,
    life: 0.08,
    maxLife: 0.08,
    r: 10,
  };
}

export function updateFx(list, dt) {
  for (const fx of list) {
    fx.life -= dt;
    if (fx.kind === "particle") {
      fx.x += fx.vx * dt;
      fx.y += fx.vy * dt;
      fx.vy += fx.gravity * dt;
    } else if (fx.kind === "ring") {
      const t = 1 - fx.life / fx.maxLife;
      fx.r = fx.maxR * t;
    } else if (fx.kind === "text") {
      fx.y += fx.vy * dt;
    } else if (fx.kind === "muzzle") {
      /* flash only */
    } else if (fx.kind === "hitFlash") {
      /* shrink handled in draw */
    } else if (fx.kind === "slash") {
      /* draw only */
    } else if (fx.kind === "shockwave") {
      const t = 1 - fx.life / fx.maxLife;
      fx.r = fx.maxR * t;
    } else if (fx.kind === "banner") {
      /* draw only */
    }
  }
  return list.filter((fx) => fx.life > 0);
}

export function drawFx(ctx, list) {
  for (const fx of list) {
    const a = Math.max(0, fx.life / fx.maxLife);
    ctx.save();
    ctx.globalAlpha = a;
    if (fx.kind === "particle") {
      ctx.fillStyle = fx.color;
      ctx.fillRect(Math.round(fx.x), Math.round(fx.y), Math.round(fx.size), Math.round(fx.size));
    } else if (fx.kind === "ring" || fx.kind === "shockwave") {
      ctx.strokeStyle = fx.color;
      ctx.lineWidth = fx.lineWidth || 2;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (fx.kind === "text") {
      ctx.fillStyle = fx.color;
      ctx.font = fx.big ? "800 16px system-ui" : "700 12px system-ui";
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 3;
      ctx.strokeText(fx.text, fx.x, fx.y);
      ctx.fillText(fx.text, fx.x, fx.y);
    } else if (fx.kind === "muzzle") {
      ctx.fillStyle = fx.color;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.r * a, 0, Math.PI * 2);
      ctx.fill();
    } else if (fx.kind === "hitFlash") {
      const r = fx.r * (0.5 + 0.5 * a);
      const g = ctx.createRadialGradient(fx.x, fx.y, 0, fx.x, fx.y, r);
      g.addColorStop(0, fx.color);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (fx.kind === "slash") {
      ctx.strokeStyle = fx.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      const f = fx.facing || 1;
      ctx.arc(fx.x, fx.y, 20, -0.8 * f, 0.8 * f, f < 0);
      ctx.stroke();
    } else if (fx.kind === "banner") {
      ctx.globalAlpha = Math.min(1, a * 1.4);
      const w = 420;
      const h = 40;
      const x = 480 - w / 2;
      const y = 48;
      ctx.fillStyle = "rgba(20, 10, 10, 0.82)";
      ctx.strokeStyle = fx.color || "#fca5a5";
      ctx.lineWidth = 2;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = fx.color || "#fecdd3";
      ctx.font = "800 16px 'PingFang TC', system-ui";
      ctx.textAlign = "center";
      ctx.fillText(fx.text, 480, y + 26);
    }
    ctx.restore();
  }
}
