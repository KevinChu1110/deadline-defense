/**
 * 官方風底部狀態列 HUD（跨掛機探險/神木防衛戰/Boss突襲/城鎮）。
 * 素材：UI.wz/StatusBar.img 解包
 *   panel-full = base/backgrnd2 (570×71，含上緣聊天條)
 *   gauge-bar  = gauge/bar (340×31 HP/MP/EXP 條圖)
 *   quickslot  = base/quickSlot (151×80)
 *
 * 用法：每幀在 render 尾端呼叫 drawHud(ctx, W, H, state)。
 *   state = { level, hp, hpMax, mp, mpMax, expPct(0~1), name?, skills:[{key,label,cd,cdMax,icon}] }
 */

const IMG = {};
function load(name, src) {
  const img = new Image();
  img.src = src;
  IMG[name] = img;
  return img;
}
// 優先用完整 71px 底板；舊 panel.png 當後備
load("panelFull", "/ui/hud/panel-full.png");
load("panel", "/ui/hud/panel.png");
load("quick", "/ui/hud/quickslot.png");
load("topedge", "/ui/hud/topedge.png");
load("gaugeBar", "/ui/hud/gauge-bar.png");
load("gaugeGrad", "/ui/hud/gauge-grad.png");
load("gaugeGray", "/ui/hud/gauge-gray.png");
load("chatLine", "/ui/hud/chat-line.png");

// panel-full(570×71) 內部槽位 — 對齊 TMS113 StatusBar.img 目測座標
// backgrnd2 上方約 33px 是聊天/名條區，下方是 LV + 三條
const P = {
  w: 570, h: 71,
  // 下方 gauge 區（從 y≈33 起）
  lv:  { x: 52,  y: 36, w: 100, h: 28 },
  hp:  { x: 168, y: 40, w: 236, h: 10 },
  mp:  { x: 168, y: 53, w: 236, h: 10 },
  exp: { x: 418, y: 47, w: 140, h: 12 },
  // 上方名牌區
  name: { x: 80, y: 10, w: 200, h: 16 },
};

// 若只用裁切後 38px panel，y 整體上移 33
const P_SHORT = {
  w: 570, h: 38,
  lv:  { x: 52,  y: 3,  w: 100, h: 30 },
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

/** 用官方 gauge/bar 圖拉伸填條（更像原版） */
function gaugeSprite(ctx, px, py, slot, pct, sprite) {
  if (!sprite?.complete || !sprite.naturalWidth) {
    return false;
  }
  const x = px + slot.x, y = py + slot.y, w = slot.w, h = slot.h;
  const fw = Math.max(0, Math.min(1, pct)) * w;
  if (fw < 1) return true;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, fw, h);
  ctx.clip();
  // 拉伸條圖到槽位高度
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, 0, 0, sprite.naturalWidth, sprite.naturalHeight, x, y, w, h);
  ctx.restore();
  return true;
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

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // 底板
  ctx.drawImage(full, px, py + (Math.max(ph, qh) - ph), pw, ph);

  const slot = (s) => ({
    x: s.x * scale,
    y: s.y * scale + (Math.max(ph, qh) - ph),
    w: s.w * scale,
    h: s.h * scale,
  });
  const sx = (v) => px + v * scale;
  const sy = (v) => py + v * scale + (Math.max(ph, qh) - ph);

  const hpPct = (state.hp ?? 1) / (state.hpMax || 1);
  const mpPct = (state.mp ?? 1) / (state.mpMax || 1);
  const expPct = state.expPct ?? 0;

  // 血魔經驗：圓角漸層（對齊原版三槽位置；gauge 圖層作底光可選）
  bar(ctx, px, py, slot(layout.hp), hpPct,
    [[0, "#ff9a9a"], [0.45, "#f03030"], [1, "#a01010"]]);
  bar(ctx, px, py, slot(layout.mp), mpPct,
    [[0, "#9ad8ff"], [0.45, "#2088e0"], [1, "#0a4a98"]]);
  bar(ctx, px, py, slot(layout.exp), expPct,
    [[0, "#f0ff80"], [0.45, "#c8e000"], [1, "#7a9800"]]);

  // LV
  const lv = layout.lv;
  pixText(ctx, String(state.level ?? "—"),
    sx(lv.x + lv.w / 2 + 8), sy(lv.y + lv.h / 2),
    { size: 13 * scale + 2, color: "#ffe9a8" });

  if (state.hpMax) {
    pixText(ctx, `${state.hp | 0}/${state.hpMax | 0}`,
      sx(layout.hp.x + layout.hp.w / 2), sy(layout.hp.y + layout.hp.h / 2), { size: 9 });
  }
  if (state.mpMax) {
    pixText(ctx, `${state.mp | 0}/${state.mpMax | 0}`,
      sx(layout.mp.x + layout.mp.w / 2), sy(layout.mp.y + layout.mp.h / 2), { size: 9 });
  }
  pixText(ctx, `${((expPct) * 100).toFixed(1)}%`,
    sx(layout.exp.x + layout.exp.w / 2), sy(layout.exp.y + layout.exp.h / 2), { size: 8.5 });

  // 角色名（完整底板上方聊天區）
  if (useFull && layout.name && state.name) {
    pixText(ctx, String(state.name),
      sx(layout.name.x), sy(layout.name.y + layout.name.h / 2),
      { size: 11 * scale + 1, color: "#fff4d8", align: "left" });
  }

  // 快捷技能格
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

/** HUD 素材是否就緒 */
export function hudReady() {
  return !!(
    (IMG.panelFull?.complete && IMG.panelFull.naturalWidth)
    || (IMG.panel?.complete && IMG.panel.naturalWidth)
  );
}
