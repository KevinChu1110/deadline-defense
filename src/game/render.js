/** Canvas rendering for the battlefield. */

import {
  getSpecialistSprite,
  getCoreSprite,
  drawSprite,
  drawProjectileSprite,
} from "./sprites.js";
import { sampleGifFrame, getCachedMob } from "./assets.js";
import { drawFx } from "./fx.js";

export function drawScene(ctx, state) {
  const {
    stage,
    pathMap,
    enemies,
    specialists,
    projectiles,
    hoverPad,
    padsOccupied,
    fx = [],
    buffs = {},
  } = state;
  const { width, height, pads, core } = stage.map;
  const paths =
    pathMap ||
    stage.map.paths ||
    (stage.map.path ? { workflow: stage.map.path } : {});

  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = false;

  // Maple-ish outdoor / temple floor
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, "#1a3a24");
  g.addColorStop(0.45, "#163220");
  g.addColorStop(1, "#0f2418");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  drawGrid(ctx, width, height);
  drawDesks(ctx);
  const pathEntries = Object.entries(paths);
  pathEntries.forEach(([key, points], i) => {
    drawPath(ctx, points, {
      color: key === "event" ? "rgba(251, 191, 36, 0.14)" : "rgba(56, 189, 248, 0.12)",
      lane: key === "event" ? "rgba(180, 140, 60, 0.55)" : "rgba(100, 116, 139, 0.55)",
      label: key === "event" ? "B路" : key === "pathC" ? "C路" : "A路",
      labelColor:
        key === "event" ? "#fbbf24" : key === "pathC" ? "#f472b6" : "#38bdf8",
    });
  });
  drawPads(ctx, pads, padsOccupied, hoverPad);
  if (buffs.coreSlowRadius > 0) {
    drawCoreSlowAura(ctx, core, buffs.coreSlowRadius, state.now);
  }
  drawCore(ctx, core, state.coreHp, state.coreMax, state.now, buffs.coreShield || 0);
  drawSpecialists(ctx, specialists, state.selectedSpecialistId, state.now);
  drawEnemies(ctx, enemies, state.now);
  drawProjectiles(ctx, projectiles, state.now);
  drawFx(ctx, fx);
  drawRangePreview(ctx, state);
  drawScanlines(ctx, width, height);
}

function drawCoreSlowAura(ctx, core, radius, now) {
  const pulse = 0.12 + Math.sin(now * 2.5) * 0.04;
  ctx.save();
  ctx.beginPath();
  ctx.arc(core.x, core.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(253, 224, 71, ${pulse})`;
  ctx.strokeStyle = "rgba(253, 224, 71, 0.45)";
  ctx.setLineDash([6, 8]);
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawGrid(ctx, w, h) {
  ctx.save();
  ctx.strokeStyle = "rgba(148, 163, 184, 0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDesks(ctx) {
  // Decorative maple trees / rocks
  const props = [
    [70, 70],
    [70, 430],
    [470, 50],
    [500, 470],
    [870, 70],
    [870, 430],
  ];
  ctx.save();
  for (const [x, y] of props) {
    // trunk
    ctx.fillStyle = "#5c3a1e";
    ctx.fillRect(x + 18, y + 22, 10, 18);
    // canopy
    ctx.fillStyle = "#2f8f3a";
    ctx.fillRect(x + 4, y + 6, 38, 22);
    ctx.fillStyle = "#49b84a";
    ctx.fillRect(x + 10, y, 26, 14);
    ctx.fillStyle = "#c43c2c";
    ctx.fillRect(x + 14, y + 8, 4, 4);
    ctx.fillRect(x + 26, y + 12, 4, 4);
  }
  ctx.restore();
}

function drawPath(ctx, points, style = {}) {
  ctx.save();
  ctx.strokeStyle = style.color || "rgba(56, 189, 248, 0.12)";
  ctx.lineWidth = 36;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();

  ctx.strokeStyle = style.lane || "rgba(100, 116, 139, 0.55)";
  ctx.lineWidth = 22;
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();

  ctx.strokeStyle = "rgba(226, 232, 240, 0.28)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  const s = points[0];
  const label = style.label || "INBOX";
  const labelColor = style.labelColor || "#fbbf24";
  ctx.fillStyle = labelColor;
  ctx.fillRect(Math.round(s.x + 18), Math.round(s.y - 5), 10, 10);
  ctx.fillStyle = labelColor;
  ctx.font = "700 11px ui-monospace, monospace";
  ctx.fillText(label, s.x + 32, s.y + 4);
}

function drawPads(ctx, pads, occupied, hoverPad) {
  pads.forEach((pad, i) => {
    const isOcc = occupied.has(i);
    const isHover = hoverPad === i;
    const r = 20;
    ctx.save();
    // pixel diamond pad
    ctx.translate(Math.round(pad.x), Math.round(pad.y));
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r, 0);
    ctx.closePath();
    if (isOcc) {
      ctx.fillStyle = "rgba(15, 23, 42, 0.15)";
      ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
    } else if (isHover) {
      ctx.fillStyle = "rgba(74, 222, 128, 0.28)";
      ctx.strokeStyle = "#4ade80";
    } else {
      ctx.fillStyle = "rgba(74, 222, 128, 0.1)";
      ctx.strokeStyle = "rgba(74, 222, 128, 0.45)";
    }
    ctx.lineWidth = isHover ? 2.5 : 1.5;
    ctx.fill();
    ctx.stroke();
    if (!isOcc) {
      ctx.fillStyle = "#a7f3d0";
      ctx.font = "700 14px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("+", 0, 1);
    }
    ctx.restore();
  });
}

function drawCore(ctx, core, hp, maxHp, now, shield = 0) {
  const ratio = Math.max(0, hp / maxHp);
  const pulse = 1 + Math.sin(now * 3) * 0.04;
  const sprite = getCoreSprite();

  ctx.save();
  ctx.beginPath();
  ctx.arc(core.x, core.y, core.radius + 14, 0, Math.PI * 2);
  ctx.fillStyle = ratio > 0.35 ? "rgba(34, 211, 238, 0.1)" : "rgba(244, 63, 94, 0.15)";
  ctx.fill();

  if (shield > 0) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(103, 232, 249, 0.75)";
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.arc(core.x, core.y, core.radius + 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // outer ring
  ctx.beginPath();
  ctx.strokeStyle = ratio > 0.35 ? "#22d3ee" : "#fb7185";
  ctx.lineWidth = 3;
  ctx.arc(core.x, core.y, core.radius + 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
  ctx.stroke();

  ctx.translate(core.x, core.y);
  ctx.scale(pulse, pulse);
  drawSprite(ctx, sprite, 0, 0);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#ecfeff";
  ctx.font = "700 11px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText("CORE", core.x, core.y + core.radius + 8);
  ctx.font = "600 12px ui-monospace, monospace";
  ctx.fillStyle = ratio > 0.35 ? "#a5f3fc" : "#fecdd3";
  const shieldTxt = shield > 0 ? `  🛡${shield}` : "";
  ctx.fillText(`${hp}/${maxHp}${shieldTxt}`, core.x, core.y + core.radius + 22);
  ctx.restore();
}

function drawSpecialists(ctx, specialists, selectedId, now) {
  for (const s of specialists) {
    const selected = s.id === selectedId;
    const bob = s.attackT > 0 ? 0 : Math.sin(now * 4 + s.id) * 1.5;
    const lunge = s.attackT > 0 ? (s.facing || 1) * 4 : 0;
    const sprite = getSpecialistSprite(s.typeId, s.def, {
      attackT: s.attackT || 0,
      now,
    });

    ctx.save();
    if (selected) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.def.range, 0, Math.PI * 2);
      ctx.fillStyle = hexAlpha(s.def.color, 0.07);
      ctx.strokeStyle = hexAlpha(s.def.color, 0.35);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 16, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    drawSprite(ctx, sprite, s.x + lunge, s.y - 6, {
      bob,
      flip: (s.facing || 1) < 0,
    });

    // skill flash ring while attacking
    if (s.attackT > 0) {
      const dur = s.def.anim?.attackDuration || 0.3;
      const a = s.attackT / dur;
      ctx.beginPath();
      ctx.strokeStyle = hexAlpha(s.def.color, a * 0.8);
      ctx.lineWidth = 2;
      ctx.arc(s.x, s.y, 20 + (1 - a) * 16, 0, Math.PI * 2);
      ctx.stroke();
    }

    const label = s.def.nameZh || s.def.code;
    ctx.font = "700 10px 'PingFang TC', 'Noto Sans TC', system-ui";
    const tw = Math.max(28, ctx.measureText(label).width + 8);
    ctx.fillStyle = "rgba(60, 40, 20, 0.82)";
    ctx.fillRect(Math.round(s.x - tw / 2), Math.round(s.y + 20), tw, 13);
    ctx.strokeStyle = "rgba(255, 220, 120, 0.55)";
    ctx.strokeRect(Math.round(s.x - tw / 2), Math.round(s.y + 20), tw, 13);
    ctx.fillStyle = "#ffe9a8";
    ctx.textAlign = "center";
    ctx.fillText(label, s.x, s.y + 30);

    if (selected) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(Math.round(s.x - 18), Math.round(s.y - 26), 36, 48);
    }
    ctx.restore();
  }
}

function drawEnemies(ctx, enemies, now) {
  for (const e of enemies) {
    if (!e.alive) continue;
    const hidden = e.hidden && !e.revealed && e.status.analyzedUntil <= now;
    const bob = Math.sin(e.animTime * 6) * 1.5;

    ctx.save();
    ctx.globalAlpha = hidden ? 0.3 : 1;

    if (e.status.slowUntil > now) {
      ctx.strokeStyle = "rgba(125, 211, 252, 0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y + 2, e.def.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (e.status.burnUntil > now) {
      ctx.strokeStyle = "rgba(251, 146, 60, 0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y + 2, e.def.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (e.status.analyzedUntil > now) {
      ctx.strokeStyle = "rgba(192, 132, 252, 0.95)";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(e.x, e.y + 2, e.def.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + e.def.radius * 0.55, e.def.radius * 0.9, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Real mob card sprite (animated GIF frames)
    const gif = e.def.sprite ? getCachedMob(e.def.sprite) : null;
    const frame = gif ? sampleGifFrame(gif, e.animTime) : null;
    if (frame) {
      const sc = e.def.spriteScale || 1.5;
      const w = frame.width * sc;
      const h = frame.height * sc;
      ctx.imageSmoothingEnabled = false;
      if (e.hitFlash > 0) {
        ctx.filter = "brightness(2.2)";
      }
      ctx.drawImage(frame, e.x - w / 2, e.y - h / 2 + bob - 4, w, h);
      ctx.filter = "none";
    } else {
      // fallback circle while loading
      ctx.fillStyle = e.def.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y + bob, e.def.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const bw = Math.max(24, e.def.radius * 2.2);
    const ratio = Math.max(0, e.hp / e.maxHp);
    const bx = Math.round(e.x - bw / 2);
    const by = Math.round(e.y - e.def.radius - 14);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#1a1208";
    ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
    ctx.fillStyle = ratio > 0.35 ? "#4ade80" : "#fb7185";
    ctx.fillRect(bx, by, Math.round(bw * ratio), 4);

    ctx.fillStyle = "#fff8e0";
    ctx.font = "700 9px 'PingFang TC', system-ui";
    ctx.textAlign = "center";
    ctx.fillText(e.def.nameZh || e.def.name, e.x, by - 3);

    if (e.def.boss) {
      ctx.fillStyle = "#ff6b6b";
      ctx.font = "800 10px 'PingFang TC', system-ui";
      ctx.fillText("BOSS", e.x, by - 14);
    }
    ctx.restore();
  }
}

function drawProjectiles(ctx, projectiles, now) {
  for (const p of projectiles) {
    if (!p.alive) continue;
    drawProjectileSprite(ctx, p, now);
  }
}

function drawRangePreview(ctx, state) {
  if (!state.placingType || state.hoverPad == null) return;
  const pad = state.stage.map.pads[state.hoverPad];
  if (!pad || state.padsOccupied.has(state.hoverPad)) return;
  const def = state.placingDef;
  if (!def) return;

  const sprite = getSpecialistSprite(state.placingType, def, { now: state.now || 0 });
  ctx.save();
  ctx.globalAlpha = 0.55;
  drawSprite(ctx, sprite, pad.x, pad.y - 4);
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(pad.x, pad.y, def.range, 0, Math.PI * 2);
  ctx.fillStyle = hexAlpha(def.color, 0.08);
  ctx.strokeStyle = hexAlpha(def.color, 0.45);
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawScanlines(ctx, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = "#000";
  for (let y = 0; y < h; y += 3) {
    ctx.fillRect(0, y, w, 1);
  }
  ctx.restore();
}

function hexAlpha(hex, a) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}
