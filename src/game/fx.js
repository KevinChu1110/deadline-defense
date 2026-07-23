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
    } else if (fx.kind === "pillar") {
      /* draw only — vertical beam */
    } else if (fx.kind === "beam") {
      /* line beam */
    } else if (fx.kind === "clockHand") {
      fx.angle = (fx.angle || 0) + dt * (fx.spin || 8);
    } else if (fx.kind === "spiral") {
      fx.angle = (fx.angle || 0) + dt * 6;
      const t = 1 - fx.life / fx.maxLife;
      fx.r = (fx.maxR || 40) * t;
    } else if (fx.kind === "skull") {
      fx.y += (fx.vy || -20) * dt;
    } else if (fx.kind === "petals") {
      fx.angle = (fx.angle || 0) + dt * 4;
    } else if (fx.kind === "lightning") {
      /* draw only */
    } else if (fx.kind === "rockFall") {
      fx.y += (fx.vy || 180) * dt;
    } else if (fx.kind === "shieldBubble") {
      /* pulse in draw */
    } else if (fx.kind === "hexSeal") {
      fx.angle = (fx.angle || 0) + dt * 2;
    } else if (fx.kind === "crossBolt") {
      /* static X bolts */
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
      const sc = fx.scale || 1;
      ctx.lineWidth = 3 * sc;
      ctx.beginPath();
      const f = fx.facing || 1;
      ctx.arc(fx.x, fx.y, 20 * sc, -0.8 * f, 0.8 * f, f < 0);
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
    } else if (fx.kind === "pillar") {
      // 火柱／光柱
      const h = fx.h || 120;
      const w = fx.w || 18;
      const g = ctx.createLinearGradient(fx.x, fx.y - h, fx.x, fx.y + 20);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.3, fx.color || "#fb923c");
      g.addColorStop(1, fx.color2 || "#ef4444");
      ctx.fillStyle = g;
      ctx.globalAlpha = a * 0.85;
      ctx.fillRect(fx.x - w / 2, fx.y - h, w, h + 20);
      ctx.fillStyle = "#fff7ed";
      ctx.globalAlpha = a * 0.5;
      ctx.fillRect(fx.x - w * 0.25, fx.y - h, w * 0.5, h);
    } else if (fx.kind === "beam") {
      ctx.strokeStyle = fx.color || "#fbbf24";
      ctx.lineWidth = fx.lineWidth || 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(fx.x, fx.y);
      ctx.lineTo(fx.x2, fx.y2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(fx.x, fx.y);
      ctx.lineTo(fx.x2, fx.y2);
      ctx.stroke();
    } else if (fx.kind === "clockHand") {
      ctx.strokeStyle = fx.color || "#c084fc";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.r || 40, 0, Math.PI * 2);
      ctx.stroke();
      const ang = fx.angle || 0;
      const len = fx.r || 40;
      ctx.beginPath();
      ctx.moveTo(fx.x, fx.y);
      ctx.lineTo(fx.x + Math.cos(ang) * len, fx.y + Math.sin(ang) * len);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(fx.x, fx.y);
      ctx.lineTo(fx.x + Math.cos(ang * 0.5) * len * 0.65, fx.y + Math.sin(ang * 0.5) * len * 0.65);
      ctx.stroke();
    } else if (fx.kind === "spiral") {
      ctx.strokeStyle = fx.color || "#a78bfa";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 24; i++) {
        const t = i / 24;
        const ang = (fx.angle || 0) + t * Math.PI * 4;
        const rr = (fx.r || 10) * t;
        const px = fx.x + Math.cos(ang) * rr;
        const py = fx.y + Math.sin(ang) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else if (fx.kind === "skull") {
      ctx.font = `${fx.size || 22}px serif`;
      ctx.textAlign = "center";
      ctx.globalAlpha = a;
      ctx.fillText(fx.glyph || "💀", fx.x, fx.y);
    } else if (fx.kind === "petals") {
      const n = fx.count || 8;
      for (let i = 0; i < n; i++) {
        const ang = (fx.angle || 0) + (i / n) * Math.PI * 2;
        const rr = (fx.r || 28) * (0.5 + 0.5 * a);
        const px = fx.x + Math.cos(ang) * rr;
        const py = fx.y + Math.sin(ang) * rr;
        ctx.fillStyle = fx.color || "#f9a8d4";
        ctx.beginPath();
        ctx.ellipse(px, py, 5, 3, ang, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (fx.kind === "lightning") {
      ctx.strokeStyle = fx.color || "#818cf8";
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      const pts = fx.points || [
        [fx.x, fx.y],
        [fx.x2 || fx.x + 40, fx.y2 || fx.y + 40],
      ];
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        if (i === 0) ctx.moveTo(pts[i][0], pts[i][1]);
        else ctx.lineTo(pts[i][0], pts[i][1]);
      }
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (fx.kind === "rockFall") {
      ctx.fillStyle = fx.color || "#78716c";
      ctx.beginPath();
      ctx.moveTo(fx.x, fx.y - 8);
      ctx.lineTo(fx.x + 10, fx.y + 6);
      ctx.lineTo(fx.x - 10, fx.y + 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#a8a29e";
      ctx.fillRect(fx.x - 4, fx.y - 2, 6, 5);
    } else if (fx.kind === "shieldBubble") {
      const pulse = 0.7 + 0.3 * Math.sin((1 - a) * 12);
      ctx.strokeStyle = fx.color || "#e9d5ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, (fx.r || 36) * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = a * 0.25;
      ctx.fillStyle = fx.color || "#e9d5ff";
      ctx.fill();
    } else if (fx.kind === "hexSeal") {
      const r = fx.r || 40;
      const ang0 = fx.angle || 0;
      ctx.strokeStyle = fx.color || "#c084fc";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = ang0 + (i / 6) * Math.PI * 2;
        const px = fx.x + Math.cos(ang) * r;
        const py = fx.y + Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, r * 0.35, 0, Math.PI * 2);
      ctx.stroke();
    } else if (fx.kind === "crossBolt") {
      ctx.strokeStyle = fx.color || "#fde047";
      ctx.lineWidth = 3;
      const s = fx.r || 28;
      ctx.beginPath();
      ctx.moveTo(fx.x - s, fx.y - s);
      ctx.lineTo(fx.x + s, fx.y + s);
      ctx.moveTo(fx.x + s, fx.y - s);
      ctx.lineTo(fx.x - s, fx.y + s);
      ctx.stroke();
    } else if (fx.kind === "armSlash") {
      ctx.strokeStyle = fx.color || "#ef4444";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.r || 50, fx.a0 || -1.2, fx.a1 || 1.2);
      ctx.stroke();
    } else if (fx.kind === "bubbleBurst") {
      for (let i = 0; i < (fx.count || 6); i++) {
        const ang = (i / (fx.count || 6)) * Math.PI * 2 + (1 - a);
        const rr = (fx.r || 30) * (1 - a * 0.3);
        ctx.strokeStyle = fx.color || "#7dd3fc";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(fx.x + Math.cos(ang) * rr, fx.y + Math.sin(ang) * rr, 4 + a * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (fx.kind === "poisonCloud") {
      const g = ctx.createRadialGradient(fx.x, fx.y, 0, fx.x, fx.y, fx.r || 50);
      g.addColorStop(0, fx.color || "rgba(34,197,94,0.55)");
      g.addColorStop(1, "rgba(34,197,94,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, (fx.r || 50) * (0.6 + 0.4 * a), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** 生成一組粒子（供 boss VFX 使用） */
export function nid() {
  return nextId++;
}
