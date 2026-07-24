/**
 * 官方楓之谷傷害跳字（Effect.wz/BasicEff.img 解包）。
 *   普通=NoRed1(橘黃) / 暴擊=NoCri1(粉紅較大) / Miss=NoRed0.Miss
 * drawDmgNumber(ctx, cx, baselineY, value, kind, alpha, scale)
 *   kind: "normal" | "crit" | "miss"
 */
const D = {};
function L(k, src) { const i = new Image(); i.src = src; D[k] = i; return i; }
for (let i = 0; i < 10; i++) { L("n" + i, `/ui/dmg/n${i}.png`); L("c" + i, `/ui/dmg/c${i}.png`); }
L("miss", "/ui/dmg/miss.png");

function ok(im) { return im && im.complete && im.naturalWidth; }

export function drawDmgNumber(ctx, cx, y, value, kind = "normal", alpha = 1, scale = 1) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.imageSmoothingEnabled = false;
  if (kind === "miss") {
    const m = D.miss;
    if (ok(m)) ctx.drawImage(m, cx - (m.width * scale) / 2, y - m.height * scale, m.width * scale, m.height * scale);
    ctx.restore();
    return ok(m);
  }
  const pfx = kind === "crit" ? "c" : "n";
  const str = String(Math.max(0, Math.round(value)));
  const imgs = [];
  let total = 0;
  for (const ch of str) {
    const im = D[pfx + ch];
    if (!ok(im)) { ctx.restore(); return false; }
    imgs.push(im); total += im.width * scale;
  }
  const overlap = 2 * scale; // 官方數字微重疊
  total -= overlap * (imgs.length - 1);
  let x = cx - total / 2;
  const h = imgs[0].height * scale;
  for (const im of imgs) {
    ctx.drawImage(im, x, y - h, im.width * scale, im.height * scale);
    x += im.width * scale - overlap;
  }
  ctx.restore();
  return true;
}

export function dmgReady() { return ok(D.n1); }
