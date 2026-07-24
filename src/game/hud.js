/**
 * 共用官方風底部狀態列 HUD（跨掛機探險/神木防衛戰/Boss突襲）。
 * 素材：UI.wz/StatusBar.img 解包(panel=backgrnd2 / quickslot / topedge)。
 * 用法：每幀在 render 尾端呼叫 drawHud(ctx, W, H, state)。
 *   state = { level, hp, hpMax, mp, mpMax, expPct(0~1), skills:[{key,label,cd,cdMax,icon}] }
 */

const IMG = {};
function load(name, src) {
  const img = new Image();
  img.src = src;
  IMG[name] = img;
  return img;
}
load("panel", "/ui/hud/panel.png");       // 570x71 暗底板(LV框+血魔/經驗槽)
load("quick", "/ui/hud/quickslot.png");    // 151x80 2x4 技能格
load("topedge", "/ui/hud/topedge.png");    // 800x71 上緣金屬邊(可選)

// panel(570x38，已裁掉上方聊天白框，原 backgrnd2 y33 起)內部槽位
const P = {
  w: 570, h: 38,
  lv:  { x: 52,  y: 3,  w: 100, h: 30 },   // LV 數字框
  hp:  { x: 168, y: 7,  w: 236, h: 10 },   // HP 條(中槽上)
  mp:  { x: 168, y: 20, w: 236, h: 10 },   // MP 條(中槽下)
  exp: { x: 418, y: 14, w: 140, h: 12 },   // EXP 條(右槽)
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
  // 高光
  ctx.globalAlpha = 0.35;
  roundRect(ctx, x, y + 1, fw, h * 0.42, h / 3);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fill();
  ctx.restore();
}

function pixText(ctx, txt, x, y, { size = 11, color = "#fff", align = "center" } = {}) {
  ctx.font = `700 ${size}px "Courier New", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.strokeText(txt, x, y);
  ctx.fillStyle = color;
  ctx.fillText(txt, x, y);
}

/** 主繪製：置中於畫面底部 */
export function drawHud(ctx, W, H, state = {}) {
  const panel = IMG.panel, quick = IMG.quick;
  if (!panel?.complete || !panel.naturalWidth) return; // 尚未載入

  const scale = Math.min(1, W / 780); // 窄畫面縮小
  const pw = P.w * scale, ph = P.h * scale;
  const qw = (quick?.naturalWidth || 151) * scale, qh = (quick?.naturalHeight || 80) * scale;
  const gap = 8 * scale;
  const totalW = pw + gap + qw;
  const px = Math.round((W - totalW) / 2);
  const py = Math.round(H - ph - 6);

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // 底板
  ctx.drawImage(panel, px, py, pw, ph);

  // 座標轉換到 panel 內部(以 scale 縮放)
  const sx = (v) => px + v * scale;
  const sy = (v) => py + v * scale;
  const sw = (v) => v * scale;
  const slot = (s) => ({ x: s.x * scale, y: s.y * scale, w: s.w * scale, h: s.h * scale });

  // 血魔經驗條
  bar(ctx, px, py, slot(P.hp), (state.hp ?? 1) / (state.hpMax || 1),
    [[0, "#ff8a8a"], [0.5, "#ee2b2b"], [1, "#b41414"]]);
  bar(ctx, px, py, slot(P.mp), (state.mp ?? 1) / (state.mpMax || 1),
    [[0, "#8fd6ff"], [0.5, "#1e9be6"], [1, "#0f5fb0"]]);
  bar(ctx, px, py, slot(P.exp), state.expPct ?? 0,
    [[0, "#eaff70"], [0.5, "#c8e000"], [1, "#8faa00"]]);

  // 文字
  const lv = P.lv;
  pixText(ctx, String(state.level ?? "—"), sx(lv.x + lv.w / 2 + 8), sy(lv.y + lv.h / 2),
    { size: 13 * scale + 2, color: "#ffe9a8" });
  if (state.hpMax) pixText(ctx, `${state.hp | 0}/${state.hpMax | 0}`,
    sx(P.hp.x + P.hp.w / 2), sy(P.hp.y + P.hp.h / 2), { size: 9 });
  if (state.mpMax) pixText(ctx, `${state.mp | 0}/${state.mpMax | 0}`,
    sx(P.mp.x + P.mp.w / 2), sy(P.mp.y + P.mp.h / 2), { size: 9 });
  pixText(ctx, `${((state.expPct ?? 0) * 100).toFixed(1)}%`,
    sx(P.exp.x + P.exp.w / 2), sy(P.exp.y + P.exp.h / 2), { size: 8.5 });

  // 快捷技能格
  if (quick?.complete && quick.naturalWidth) {
    const qx = px + pw + gap, qy = Math.round(H - qh - 6);
    ctx.drawImage(quick, qx, qy, qw, qh);
    const skills = state.skills || [];
    // 2x4 格；格內距量測: 邊框約 6px，格 ~33px
    const cell = 34 * scale, pad = 7 * scale, gcol = 3 * scale;
    for (let i = 0; i < Math.min(8, skills.length); i++) {
      const c = i % 4, r = Math.floor(i / 4);
      const cx = qx + pad + c * (cell + gcol), cy = qy + pad + r * (cell + gcol);
      const s = skills[i];
      if (s.icon?.complete && s.icon.naturalWidth) {
        ctx.drawImage(s.icon, cx + 2, cy + 2, cell - 6, cell - 6);
      }
      // 按鍵字
      pixText(ctx, s.key || "", cx + cell - 8 * scale, cy + 9 * scale, { size: 9 * scale + 2, color: "#ffe" });
      // 冷卻遮罩
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

/** HUD 素材是否就緒(避免第一幀空白) */
export function hudReady() {
  return !!(IMG.panel?.complete && IMG.panel.naturalWidth);
}
