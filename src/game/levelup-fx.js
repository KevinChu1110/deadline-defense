/**
 * 官方升級光效（Effect.wz/BasicEff.img/LevelUp，21 幀綠光柱 + 升級了字）。
 * drawLevelUp(ctx, cx, footY, t) — t 為特效已播秒數；回傳 false 表示播完。
 */
const FR = [];
for (let i = 0; i < 21; i++) { const im = new Image(); im.src = `/ui/levelup/lu${i}.png`; FR.push(im); }
const FRAME = 0.085; // 每幀秒數
export const LEVELUP_DURATION = FR.length * FRAME;

export function drawLevelUp(ctx, cx, footY, t) {
  const idx = Math.floor(t / FRAME);
  if (idx >= FR.length) return false;
  const im = FR[idx];
  if (im.complete && im.naturalWidth) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, Math.round(cx - im.width / 2), Math.round(footY - im.height), im.width, im.height);
    ctx.restore();
  }
  return true;
}
