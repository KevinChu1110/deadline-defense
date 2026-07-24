/**
 * 紙娃娃動畫渲染：用 maplestory.io 角色 API 取各動畫多幀(stand1/walk1/...)，快取播放。
 * 動畫由 server 端從 WZ 合成，換裝/美髮/整形只要換 appearance 的 item 即可。
 */
import { appearanceItems } from "../data/avatar-items.js";

// 各動畫幀數（超出範圍的幀 API 會 404，載入失敗自動忽略）
const ANIMS = { stand1: 3, walk1: 4, alert: 3, swingO1: 3, proneStab: 2, jump: 1, shoot1: 2 };

const imgCache = new Map(); // url → {img, ready}
function loadImg(url) {
  if (imgCache.has(url)) return imgCache.get(url);
  const rec = { img: new Image(), ready: false };
  rec.img.crossOrigin = "anonymous";
  rec.img.onload = () => (rec.ready = true);
  rec.img.onerror = () => (rec.failed = true);
  rec.img.src = url;
  imgCache.set(url, rec);
  return rec;
}

function frameUrl(items, anim, frame) {
  const enc = encodeURIComponent(items.map((o) => JSON.stringify(o)).join(","));
  return `https://maplestory.io/api/character/${enc}/${anim}/${frame}?resize=2`;
}

/** 建一個動畫紙娃娃(預載 stand1 + walk1) */
export function createAvatar(appearance) {
  const items = appearanceItems(appearance);
  const frames = {}; // anim → [rec]
  const ensure = (anim) => {
    if (frames[anim]) return;
    frames[anim] = [];
    const n = ANIMS[anim] || 1;
    for (let f = 0; f < n; f++) frames[anim][f] = loadImg(frameUrl(items, anim, f));
  };
  ensure("stand1");
  ensure("walk1");
  ensure("jump");
  ensure("swingO1");
  return { items, frames, ensure, _t: {} };
}

/**
 * 畫紙娃娃。回傳是否有畫出(false 表示還沒載好，呼叫端可用色塊墊)。
 * opts: { anim, dt, flip(1/-1), scale, footY(腳底 y), x }
 */
export function drawAvatar(ctx, avatar, x, footY, opts = {}) {
  const anim = opts.anim || "stand1";
  avatar.ensure(anim);
  const seq = avatar.frames[anim] || avatar.frames.stand1;
  if (!seq) return false;
  // 累積動畫時間
  avatar._t[anim] = (avatar._t[anim] || 0) + (opts.dt || 0.016) * 1000;
  const fps = anim.startsWith("walk") ? 130 : 180;
  const ready = seq.filter((r) => r && r.ready);
  if (!ready.length) return false;
  const idx = Math.floor(avatar._t[anim] / fps) % seq.length;
  const rec = (seq[idx] && seq[idx].ready) ? seq[idx] : ready[0];
  const img = rec.img;
  const scale = opts.targetH ? opts.targetH / img.height : (opts.scale || 1);
  const w = img.width * scale, h = img.height * scale;
  const flip = opts.flip || 1;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (flip < 0) {
    ctx.translate(x, 0); ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, footY - h, w, h);
  } else {
    ctx.drawImage(img, x - w / 2, footY - h, w, h);
  }
  ctx.restore();
  return true;
}
