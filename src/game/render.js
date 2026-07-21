/** Canvas rendering for the battlefield. */

import {
  getSpecialistSprite,
  getSpecialistPortrait,
  getCoreSprite,
  drawSprite,
  drawProjectileSprite,
} from "./sprites.js";
import { sampleGifFrame, getCachedMob } from "./assets.js";
import { drawFx } from "./fx.js";
import { drawHazards } from "./hazards.js";
import { MAP_THEMES } from "../data/map-themes.js";

/** @type {Map<string, HTMLImageElement>} */
const bgCache = new Map();
/** @type {Set<string>} */
const bgFailed = new Set();

function ensureMapBg(src) {
  if (!src) return null;
  if (bgFailed.has(src)) return null;
  if (bgCache.has(src)) return bgCache.get(src);
  const img = new Image();
  img.decoding = "async";
  img.onload = () => bgCache.set(src, img);
  img.onerror = () => bgFailed.add(src);
  img.src = src;
  bgCache.set(src, img);
  return img;
}

function resolveTheme(state) {
  return state.mapTheme || MAP_THEMES.victoria;
}

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
  const theme = resolveTheme(state);

  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;

  drawMapBackground(ctx, width, height, theme);
  if (state.hazardState) {
    drawHazards(ctx, state.hazardState, stage.map, state.now || 0);
  }

  ctx.imageSmoothingEnabled = false;
  const pathEntries = Object.entries(paths);
  const pathStyle = pathStyleForTheme(theme);
  pathEntries.forEach(([key, points]) => {
    drawPath(ctx, points, {
      color:
        key === "event"
          ? pathStyle.event
          : key === "pathC"
            ? pathStyle.pathC
            : pathStyle.main,
      lane:
        key === "event"
          ? pathStyle.eventLane
          : key === "pathC"
            ? pathStyle.pathCLane
            : pathStyle.mainLane,
      label: key === "event" ? "B路" : key === "pathC" ? "C路" : "A路",
      labelColor:
        key === "event" ? "#fbbf24" : key === "pathC" ? "#f472b6" : theme.accent || "#fde68a",
    });
  });
  drawPads(ctx, pads, padsOccupied, hoverPad, !!state.placingType);
  if (buffs.coreSlowRadius > 0) {
    drawCoreSlowAura(ctx, core, buffs.coreSlowRadius, state.now);
  }
  drawCore(ctx, core, state.coreHp, state.coreMax, state.now, buffs.coreShield || 0);
  drawSpecialists(ctx, specialists, state.selectedSpecialistId, state.now);
  drawEnemies(ctx, enemies, state.now);
  drawProjectiles(ctx, projectiles, state.now);
  drawFx(ctx, fx);
  drawRangePreview(ctx, state);
  if (state.placingType) {
    drawPlacingBanner(ctx, width, height, state.placingDef);
  }
  // 地圖名角標
  if (theme?.nameZh) {
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = "rgba(20, 16, 12, 0.55)";
    ctx.fillRect(10, height - 28, 140, 20);
    ctx.fillStyle = theme.accent || "#fde68a";
    ctx.font = "700 11px 'PingFang TC', system-ui";
    ctx.textAlign = "left";
    ctx.fillText(theme.nameZh, 18, height - 14);
    ctx.restore();
  }
}

function pathStyleForTheme(theme) {
  const path = theme?.path || "dirt";
  if (path === "ice") {
    return {
      main: "rgba(140, 180, 210, 0.5)",
      mainLane: "rgba(200, 230, 250, 0.75)",
      event: "rgba(100, 160, 200, 0.5)",
      eventLane: "rgba(160, 210, 240, 0.75)",
      pathC: "rgba(120, 140, 190, 0.5)",
      pathCLane: "rgba(180, 190, 230, 0.7)",
    };
  }
  if (path === "lava" || path === "rock") {
    return {
      main: "rgba(90, 50, 40, 0.55)",
      mainLane: "rgba(180, 90, 50, 0.7)",
      event: "rgba(120, 60, 30, 0.55)",
      eventLane: "rgba(220, 120, 40, 0.75)",
      pathC: "rgba(80, 40, 50, 0.5)",
      pathCLane: "rgba(180, 80, 90, 0.7)",
    };
  }
  if (path === "cloud") {
    return {
      main: "rgba(160, 170, 200, 0.45)",
      mainLane: "rgba(230, 235, 255, 0.8)",
      event: "rgba(140, 150, 210, 0.5)",
      eventLane: "rgba(200, 210, 250, 0.75)",
      pathC: "rgba(150, 140, 200, 0.5)",
      pathCLane: "rgba(210, 190, 250, 0.7)",
    };
  }
  if (path === "coral") {
    return {
      main: "rgba(30, 100, 120, 0.5)",
      mainLane: "rgba(80, 200, 210, 0.7)",
      event: "rgba(40, 90, 140, 0.5)",
      eventLane: "rgba(100, 180, 230, 0.75)",
      pathC: "rgba(60, 80, 140, 0.5)",
      pathCLane: "rgba(140, 160, 220, 0.7)",
    };
  }
  if (path === "gear") {
    return {
      main: "rgba(180, 100, 140, 0.45)",
      mainLane: "rgba(250, 160, 190, 0.75)",
      event: "rgba(200, 120, 80, 0.5)",
      eventLane: "rgba(250, 180, 120, 0.75)",
      pathC: "rgba(160, 100, 160, 0.5)",
      pathCLane: "rgba(220, 150, 220, 0.7)",
    };
  }
  // dirt / moss / root default
  return {
    main: "rgba(160, 130, 90, 0.55)",
    mainLane: "rgba(210, 180, 120, 0.75)",
    event: "rgba(196, 150, 70, 0.55)",
    eventLane: "rgba(230, 190, 100, 0.75)",
    pathC: "rgba(160, 100, 140, 0.5)",
    pathCLane: "rgba(210, 140, 180, 0.7)",
  };
}

function drawPlacingBanner(ctx, width, height, def) {
  const name = def?.nameZh || "職業";
  const msg = `部署「${name}」— 拖到綠色「+」格鬆手（或點格部署）`;
  ctx.save();
  ctx.font = "700 14px 'PingFang TC', system-ui, sans-serif";
  const tw = ctx.measureText(msg).width + 28;
  const x = (width - tw) / 2;
  const y = 14;
  ctx.fillStyle = "rgba(30, 50, 30, 0.78)";
  ctx.strokeStyle = "rgba(120, 220, 140, 0.9)";
  ctx.lineWidth = 2;
  roundRectPath(ctx, x, y, tw, 30, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ecfdf5";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(msg, width / 2, y + 15);
  ctx.restore();
}

function drawMapBackground(ctx, width, height, theme = MAP_THEMES.victoria) {
  paintThemeBase(ctx, width, height, theme);

  const src = theme.bgImage || (theme.id === "victoria" ? "/maps/bg_victoria.jpg" : null);
  const alpha = theme.bgAlpha != null ? theme.bgAlpha : src ? 0.45 : 0;
  if (src && alpha > 0) {
    const bg = ensureMapBg(src);
    if (bg && bg.complete && bg.naturalWidth > 0) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(bg, 0, 0, width, height);
      ctx.restore();
    }
  }

  // Soft sky strip
  const skyTop = theme.sky?.[0] || "#9ec8e8";
  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.28);
  sky.addColorStop(0, hexToRgba(skyTop, 0.5));
  sky.addColorStop(1, hexToRgba(skyTop, 0));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height * 0.28);

  drawThemeDecor(ctx, width, height, theme);

  const v = ctx.createRadialGradient(
    width * 0.5,
    height * 0.55,
    Math.min(width, height) * 0.2,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.75
  );
  v.addColorStop(0, "rgba(255, 255, 255, 0)");
  v.addColorStop(1, "rgba(20, 20, 30, 0.22)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, width, height);
}

function hexToRgba(hex, a) {
  if (!hex || hex[0] !== "#") return `rgba(150,180,200,${a})`;
  const h = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function paintThemeBase(ctx, width, height, theme) {
  const sky = theme.sky || ["#9ec8e8", "#b8d9a0"];
  const ground = theme.ground || ["#7ec46a", "#5a9a4e"];
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, sky[0]);
  g.addColorStop(0.22, sky[1] || sky[0]);
  g.addColorStop(0.55, ground[0]);
  g.addColorStop(1, ground[1] || ground[0]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  // texture speckles tinted by ground
  ctx.save();
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 80; i++) {
    const x = (i * 97) % width;
    const y = 80 + ((i * 53) % (height - 100));
    ctx.fillStyle = i % 2 ? ground[1] || "#3d7a38" : sky[1] || "#d4f0a8";
    ctx.fillRect(x, y, 3, 2);
  }
  ctx.restore();
}

function drawThemeDecor(ctx, w, h, theme) {
  const decor = theme.decor || "trees";
  const accent = theme.accent || "#a3e635";
  ctx.save();

  // soft hills / base mounds
  ctx.fillStyle = hexToRgba(theme.ground?.[1] || "#468c46", 0.35);
  ctx.beginPath();
  ctx.ellipse(w * 0.2, h * 0.85, 220, 60, 0, 0, Math.PI * 2);
  ctx.ellipse(w * 0.7, h * 0.9, 280, 70, 0, 0, Math.PI * 2);
  ctx.fill();

  if (decor === "trees" || decor === "mushrooms" || decor === "dragons") {
    const trees = [
      [60, 80],
      [90, 420],
      [880, 90],
      [850, 400],
      [480, 40],
    ];
    for (const [x, y] of trees) {
      ctx.fillStyle = "#6b4226";
      ctx.fillRect(x + 14, y + 28, 10, 22);
      ctx.fillStyle = decor === "dragons" ? "#365314" : "#2f8f3a";
      ctx.beginPath();
      ctx.arc(x + 19, y + 18, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = decor === "mushrooms" ? "#a78bfa" : "#49b84a";
      ctx.beginPath();
      ctx.arc(x + 12, y + 14, 14, 0, Math.PI * 2);
      ctx.arc(x + 26, y + 14, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.fillRect(x + 10, y + 10, 4, 4);
      ctx.fillRect(x + 24, y + 16, 4, 4);
    }
  }

  if (decor === "rocks" || decor === "lava") {
    const rocks = [
      [70, 100],
      [100, 400],
      [860, 110],
      [820, 390],
      [450, 50],
    ];
    for (const [x, y] of rocks) {
      ctx.fillStyle = decor === "lava" ? "#7f1d1d" : "#78716c";
      ctx.beginPath();
      ctx.moveTo(x, y + 20);
      ctx.lineTo(x + 18, y);
      ctx.lineTo(x + 36, y + 22);
      ctx.closePath();
      ctx.fill();
      if (decor === "lava") {
        ctx.fillStyle = accent;
        ctx.fillRect(x + 12, y + 10, 6, 4);
      }
    }
  }

  if (decor === "clouds" || decor === "ice") {
    const clouds = [
      [80, 60],
      [200, 40],
      [700, 50],
      [850, 70],
      [480, 30],
    ];
    for (const [x, y] of clouds) {
      ctx.fillStyle = decor === "ice" ? "rgba(224, 242, 254, 0.7)" : "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.ellipse(x, y, 36, 14, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 20, y - 6, 22, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (decor === "bubbles") {
    for (let i = 0; i < 18; i++) {
      const x = 40 + ((i * 53) % (w - 80));
      const y = 60 + ((i * 71) % (h - 100));
      ctx.strokeStyle = hexToRgba(accent, 0.45);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 4 + (i % 4), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (decor === "gears") {
    const gears = [
      [70, 90],
      [880, 100],
      [90, 420],
      [850, 400],
    ];
    for (const [x, y] of gears) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
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

function drawPath(ctx, points, style = {}) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Dark earth outline
  ctx.strokeStyle = "rgba(90, 60, 30, 0.55)";
  ctx.lineWidth = 44;
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();

  // Dirt road
  ctx.strokeStyle = style.color || "rgba(196, 150, 70, 0.9)";
  ctx.lineWidth = 34;
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();

  // Light path surface
  ctx.strokeStyle = style.lane || "rgba(232, 200, 130, 0.95)";
  ctx.lineWidth = 22;
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();

  // Center dashes
  ctx.setLineDash([12, 10]);
  ctx.strokeStyle = "rgba(255, 248, 220, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();

  const s = points[0];
  const label = style.label || "A路";
  const labelColor = style.labelColor || "#fde68a";
  ctx.save();
  ctx.fillStyle = "rgba(40, 30, 15, 0.55)";
  ctx.fillRect(Math.round(s.x + 14), Math.round(s.y - 12), 36, 16);
  ctx.fillStyle = labelColor;
  ctx.font = "700 11px 'PingFang TC', system-ui, sans-serif";
  ctx.fillText(label, s.x + 20, s.y);
  ctx.restore();
}

function drawPads(ctx, pads, occupied, hoverPad, placing = false) {
  pads.forEach((pad, i) => {
    const isOcc = occupied.has(i);
    const isHover = hoverPad === i;
    const r = placing && !isOcc ? 26 : 22;
    ctx.save();
    ctx.translate(Math.round(pad.x), Math.round(pad.y));

    // Soft ground shadow / platform disc so pads stay visible on any map art
    ctx.beginPath();
    ctx.ellipse(0, 6, r + 6, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = isOcc ? "rgba(40, 30, 20, 0.25)" : "rgba(30, 60, 30, 0.35)";
    ctx.fill();

    // Stone tile base
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r, 0);
    ctx.closePath();

    if (isOcc) {
      ctx.fillStyle = "rgba(80, 70, 55, 0.45)";
      ctx.strokeStyle = "rgba(180, 160, 120, 0.5)";
    } else if (isHover || placing) {
      ctx.fillStyle = isHover ? "rgba(80, 220, 120, 0.75)" : "rgba(70, 200, 110, 0.55)";
      ctx.strokeStyle = "#ecfdf5";
      // Outer pulse ring while placing
      if (placing) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, r + 10, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(74, 222, 128, 0.55)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      ctx.fillStyle = "rgba(90, 190, 110, 0.42)";
      ctx.strokeStyle = "rgba(220, 255, 220, 0.85)";
    }
    ctx.lineWidth = isHover ? 3 : 2;
    ctx.fill();
    ctx.stroke();

    if (!isOcc) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 16px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 3;
      ctx.fillText("+", 0, 1);
      ctx.shadowBlur = 0;
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
    const lunge = s.attackT > 0 ? (s.facing || 1) * 3 : 0;
    // Prefer AI chibi portrait on the field; fall back to pixel sprite
    const portrait = getSpecialistPortrait(s.typeId, s.def);
    const usePortrait = portrait && (portrait.naturalWidth > 0 || portrait.width > 0);

    ctx.save();
    if (selected) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.def.range, 0, Math.PI * 2);
      ctx.fillStyle = hexAlpha(s.def.color, 0.08);
      ctx.strokeStyle = hexAlpha(s.def.color, 0.4);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 18, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    const dx = s.x + lunge;
    const dy = s.y - 8 + bob;
    if (usePortrait) {
      const size = 48;
      ctx.imageSmoothingEnabled = true;
      // Soft circular-ish clip via rounded rect card
      ctx.save();
      const left = Math.round(dx - size / 2);
      const top = Math.round(dy - size / 2 - 4);
      roundRectPath(ctx, left, top, size, size, 10);
      ctx.clip();
      ctx.drawImage(portrait, left, top, size, size);
      ctx.restore();
      // Card border
      ctx.strokeStyle = selected ? "#fff8e0" : "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = selected ? 2.5 : 1.5;
      roundRectPath(ctx, left, top, size, size, 10);
      ctx.stroke();
    } else {
      const sprite = getSpecialistSprite(s.typeId, s.def, {
        attackT: s.attackT || 0,
        now,
      });
      drawSprite(ctx, sprite, dx, dy, {
        bob: 0,
        flip: (s.facing || 1) < 0,
      });
    }

    if (s.attackT > 0) {
      const dur = s.def.anim?.attackDuration || 0.3;
      const a = s.attackT / dur;
      ctx.beginPath();
      ctx.strokeStyle = hexAlpha(s.def.color, a * 0.8);
      ctx.lineWidth = 2;
      ctx.arc(s.x, s.y, 22 + (1 - a) * 16, 0, Math.PI * 2);
      ctx.stroke();
    }

    const label = s.def.nameZh || s.def.code;
    ctx.font = "700 10px 'PingFang TC', 'Noto Sans TC', system-ui";
    const tw = Math.max(28, ctx.measureText(label).width + 8);
    ctx.fillStyle = "rgba(40, 30, 18, 0.82)";
    ctx.fillRect(Math.round(s.x - tw / 2), Math.round(s.y + 22), tw, 13);
    ctx.strokeStyle = "rgba(255, 220, 120, 0.55)";
    ctx.strokeRect(Math.round(s.x - tw / 2), Math.round(s.y + 22), tw, 13);
    ctx.fillStyle = "#ffe9a8";
    ctx.textAlign = "center";
    ctx.fillText(label, s.x, s.y + 32);

    ctx.restore();
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
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
