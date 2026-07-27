/**
 * WZ 紙娃娃播放器（route B）：播放 tools/wz/gen-sheet.mjs 產生的 sprite sheet + manifest。
 * 素材由 Character.wz 自解合成（非 maplestory.io），完整 WZ、無外部依賴。
 *
 * manifest 格式：
 *   { groundY, nominalH, anims: { <stance>: [{x,y,w,h,nx,ny,delay}, ...] } }
 *   nx,ny = navel 在該幀圖內的位置 → 對齊 navel 播放，腳底 = navel + groundY，杜絕抖動。
 *
 * 介面刻意對齊 avatar.js：createWzAvatar(base) / drawWzAvatar(ctx, av, x, footY, opts)
 */

// town.js 的 anim 名 → WZ stance
const ANIM_MAP = { idle: "stand1", stand1: "stand1", walk1: "walk1", walk: "walk1", jump: "jump", swingO1: "swingO1", alert: "alert" };

/** 建一個 WZ 紙娃娃。src 可為：
 *  - 靜態目錄(載 <src>/sheet.json + <src>/sheet.png)
 *  - dd-server 端點(含 ? 或 .json;回傳 manifest 內嵌 sheet data URL) */
export function createWzAvatar(src) {
  const av = { src, manifest: null, sheet: null, ready: false, _t: {} };
  const isEndpoint = /[?]|\.json($|\?)/.test(src);
  const manifestUrl = isEndpoint ? src : `${src}/sheet.json`;
  fetch(manifestUrl)
    .then((r) => r.json())
    .then((m) => {
      av.manifest = m;
      const img = new Image();
      img.onload = () => { av.sheet = img; av.ready = true; };
      img.src = m.sheet || `${src}/sheet.png`; // 端點內嵌 data URL;靜態退回 png
    })
    .catch(() => { /* 載入失敗 → ready 保持 false，呼叫端 fallback maplestory.io */ });
  return av;
}

/** 依 delay 累積時間挑當前幀 */
function pickFrame(av, stance, dtMs) {
  const frames = av.manifest.anims[stance] || av.manifest.anims.stand1;
  if (!frames || !frames.length) return null;
  const total = frames.reduce((s, f) => s + (f.delay || 120), 0);
  av._t[stance] = ((av._t[stance] || 0) + dtMs) % total;
  let acc = 0;
  for (const f of frames) { acc += f.delay || 120; if (av._t[stance] < acc) return f; }
  return frames[frames.length - 1];
}

/**
 * 畫 WZ 紙娃娃。回傳是否畫出（false → 尚未載入，呼叫端可墊色塊）。
 * opts: { anim, dt, flip(1/-1), targetH, maxW }
 */
export function drawWzAvatar(ctx, av, x, footY, opts = {}) {
  if (!av || !av.ready) return false;
  const stance = ANIM_MAP[opts.anim] || "stand1";
  const f = pickFrame(av, stance, (opts.dt || 0.016) * 1000);
  if (!f) return false;
  const m = av.manifest;
  let scale = opts.targetH ? opts.targetH / (m.nominalH || 64) : (opts.scale || 1);
  if (opts.maxW && f.w * scale > opts.maxW) scale = opts.maxW / f.w;
  // navel 對齊：navel 螢幕座標 =(x, footY − groundY*scale)；腳底剛好落在 footY
  const navelY = footY - (m.groundY || 0) * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, navelY);
  ctx.scale(opts.flip < 0 ? -1 : 1, 1);
  ctx.drawImage(av.sheet, f.x, f.y, f.w, f.h, -f.nx * scale, -f.ny * scale, f.w * scale, f.h * scale);
  ctx.restore();
  return true;
}
