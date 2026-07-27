/**
 * 官方風底部狀態列 HUD
 * 素材：UI.wz/StatusBar.img（backgrnd2 + number_* + quickSlot）
 *
 * state = { level, hp, hpMax, mp, mpMax, expPct(0~1), name?, skills:[] }
 */

const IMG = {};
function load(name, src) {
  const img = new Image();
  img.src = src;
  IMG[name] = img;
  return img;
}

load("panelFull", "/ui/hud/panel-full.png");
load("panel", "/ui/hud/panel.png");
load("quick", "/ui/hud/quickslot.png");

// 官方數字字型（5×7，繪製時 ×2 放大）
const NUM = {};
for (let i = 0; i <= 9; i++) loadNum(String(i), `/ui/hud/num/${i}.png`);
loadNum("slash", "/ui/hud/num/slash.png");
loadNum("percent", "/ui/hud/num/percent.png");
loadNum("lbracket", "/ui/hud/num/lbracket.png");
loadNum("rbracket", "/ui/hud/num/rbracket.png");
function loadNum(k, src) {
  const img = new Image();
  img.src = src;
  NUM[k] = img;
}

const P = {
  w: 570, h: 71,
  lv:  { x: 58,  y: 42, w: 90, h: 22 },
  hp:  { x: 168, y: 40, w: 236, h: 10 },
  mp:  { x: 168, y: 53, w: 236, h: 10 },
  exp: { x: 418, y: 47, w: 140, h: 12 },
  name: { x: 80, y: 10, w: 200, h: 16 },
};
const P_SHORT = {
  w: 570, h: 38,
  lv:  { x: 58,  y: 8,  w: 90, h: 22 },
  hp:  { x: 168, y: 7,  w: 236, h: 10 },
  mp:  { x: 168, y: 20, w: 236, h: 10 },
  exp: { x: 418, y: 14, w: 140, h: 12 },
  name: null,
};

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function bar(ctx, px, py, slot, pct, colStops) {
  const x = px + slot.x, y = py + slot.y, w = slot.w, h = slot.h;
  const fw = Math.max(0, Math.min(1, pct)) * w;
  if (fw < 1) return;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  for (const [o, c] of colStops) g.addColorStop(o, c);
  ctx.save();
  roundRect(ctx, x, y, fw, h, h / 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.globalAlpha = 0.35;
  roundRect(ctx, x, y + 1, fw, h * 0.42, h / 3);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fill();
  ctx.restore();
}

/** 量測 bitmap 字串寬度（scale 倍） */
function measureNum(str, scale = 2) {
  let w = 0;
  for (const ch of String(str)) {
    const key = ch === "/" ? "slash" : ch === "%" ? "percent" : ch === "[" ? "lbracket" : ch === "]" ? "rbracket" : ch;
    const im = NUM[key];
    if (im?.complete && im.naturalWidth) w += im.naturalWidth * scale + scale; // +1px gap
    else w += 5 * scale + scale;
  }
  return w;
}

/**
 * 繪製官方數字字串
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} str
 * @param {number} x 左上或對齊點
 * @param {number} y 垂直中心
 * @param {{ scale?: number, align?: 'left'|'center'|'right' }} opts
 */
function drawNum(ctx, str, x, y, { scale = 2, align = "left" } = {}) {
  const s = String(str);
  let tw = measureNum(s, scale);
  let cx = x;
  if (align === "center") cx = x - tw / 2;
  else if (align === "right") cx = x - tw;
  const h = 7 * scale;
  const top = Math.round(y - h / 2);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (const ch of s) {
    const key = ch === "/" ? "slash" : ch === "%" ? "percent" : ch === "[" ? "lbracket" : ch === "]" ? "rbracket" : ch;
    const im = NUM[key];
    if (im?.complete && im.naturalWidth) {
      const dw = im.naturalWidth * scale, dh = im.naturalHeight * scale;
      ctx.drawImage(im, Math.round(cx), top, dw, dh);
      cx += dw + scale;
    } else {
      // 後備：系統字
      ctx.font = `700 ${8 * scale}px monospace`;
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.fillText(ch, cx, y);
      cx += 5 * scale + scale;
    }
  }
  ctx.restore();
  return tw;
}

function pixText(ctx, txt, x, y, { size = 11, color = "#fff", align = "center" } = {}) {
  ctx.font = `700 ${size}px "Courier New", "Microsoft JhengHei", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  ctx.strokeText(txt, x, y);
  ctx.fillStyle = color;
  ctx.fillText(txt, x, y);
}

/** 主繪製：置中於畫面底部 */
export function drawHud(ctx, W, H, state = {}) {
  const full = IMG.panelFull?.complete && IMG.panelFull.naturalWidth
    ? IMG.panelFull
    : (IMG.panel?.complete && IMG.panel.naturalWidth ? IMG.panel : null);
  if (!full) return;

  const useFull = full.naturalHeight >= 60;
  const layout = useFull ? P : P_SHORT;
  const quick = IMG.quick;

  const scale = Math.min(1, W / 780);
  const pw = layout.w * scale, ph = layout.h * scale;
  const qw = (quick?.naturalWidth || 151) * scale;
  const qh = (quick?.naturalHeight || 80) * scale;
  const gap = 6 * scale;
  const totalW = pw + gap + qw;
  const px = Math.round((W - totalW) / 2);
  const py = Math.round(H - Math.max(ph, qh) - 4);
  const yOff = Math.max(ph, qh) - ph;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(full, px, py + yOff, pw, ph);

  const slot = (s) => ({
    x: s.x * scale,
    y: s.y * scale + yOff,
    w: s.w * scale,
    h: s.h * scale,
  });
  const sx = (v) => px + v * scale;
  const sy = (v) => py + v * scale + yOff;

  const hpPct = (state.hp ?? 1) / (state.hpMax || 1);
  const mpPct = (state.mp ?? 1) / (state.mpMax || 1);
  const expPct = state.expPct ?? 0;

  bar(ctx, px, py, slot(layout.hp), hpPct,
    [[0, "#ff9a9a"], [0.45, "#f03030"], [1, "#a01010"]]);
  bar(ctx, px, py, slot(layout.mp), mpPct,
    [[0, "#9ad8ff"], [0.45, "#2088e0"], [1, "#0a4a98"]]);
  bar(ctx, px, py, slot(layout.exp), expPct,
    [[0, "#f0ff80"], [0.45, "#c8e000"], [1, "#7a9800"]]);

  // 官方數字（scale 約 2×UI scale）
  const nScale = Math.max(2, Math.round(2 * scale));
  const lv = layout.lv;
  drawNum(ctx, String(state.level ?? 0),
    sx(lv.x + lv.w / 2), sy(lv.y + lv.h / 2), { scale: nScale, align: "center" });

  if (state.hpMax) {
    drawNum(ctx, `${state.hp | 0}/${state.hpMax | 0}`,
      sx(layout.hp.x + layout.hp.w / 2), sy(layout.hp.y + layout.hp.h / 2),
      { scale: nScale, align: "center" });
  }
  if (state.mpMax) {
    drawNum(ctx, `${state.mp | 0}/${state.mpMax | 0}`,
      sx(layout.mp.x + layout.mp.w / 2), sy(layout.mp.y + layout.mp.h / 2),
      { scale: nScale, align: "center" });
  }
  // EXP 百分比（取整，官方字沒有小數點）
  const expPctInt = Math.min(99, Math.max(0, Math.floor((expPct || 0) * 100)));
  drawNum(ctx, `${expPctInt}%`,
    sx(layout.exp.x + layout.exp.w / 2), sy(layout.exp.y + layout.exp.h / 2),
    { scale: nScale, align: "center" });

  if (useFull && layout.name && state.name) {
    pixText(ctx, String(state.name),
      sx(layout.name.x), sy(layout.name.y + layout.name.h / 2),
      { size: 11 * scale + 1, color: "#fff4d8", align: "left" });
  }

  if (quick?.complete && quick.naturalWidth) {
    const qx = px + pw + gap;
    const qy = Math.round(py + Math.max(ph, qh) - qh);
    ctx.drawImage(quick, qx, qy, qw, qh);
    const skills = state.skills || [];
    const cell = 34 * scale, pad = 7 * scale, gcol = 3 * scale;
    for (let i = 0; i < Math.min(8, skills.length); i++) {
      const c = i % 4, r = Math.floor(i / 4);
      const cx = qx + pad + c * (cell + gcol), cy = qy + pad + r * (cell + gcol);
      const s = skills[i];
      if (s.icon?.complete && s.icon.naturalWidth) {
        ctx.drawImage(s.icon, cx + 2, cy + 2, cell - 6, cell - 6);
      } else if (s.label) {
        // emoji / 文字圖示（城鎮社交技）
        ctx.save();
        ctx.font = `${Math.round(14 * scale + 4)}px system-ui`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(s.label, cx + (cell - 4) / 2, cy + (cell - 4) / 2 + 1);
        ctx.restore();
      }
      pixText(ctx, s.key || "", cx + cell - 8 * scale, cy + 9 * scale, { size: 9 * scale + 2, color: "#ffe" });
      if (s.cd > 0 && s.cdMax > 0) {
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(cx, cy + (cell - 4) * (1 - s.cd / s.cdMax), cell - 4, (cell - 4) * (s.cd / s.cdMax));
        ctx.restore();
      }
    }
  }

  ctx.restore();
}

export function hudReady() {
  return !!(
    (IMG.panelFull?.complete && IMG.panelFull.naturalWidth)
    || (IMG.panel?.complete && IMG.panel.naturalWidth)
  );
}
