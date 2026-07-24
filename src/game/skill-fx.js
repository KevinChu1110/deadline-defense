/**
 * 技能特效渲染：優先用 WZ 解出的真實動畫 spritesheet(public/skills/{id}_fx.png)，
 * 沒有真動畫的技能退回程序化 shape×element 特效。
 */
import manifest from "../data/skills-anim-manifest.json";
import { SKILLS } from "../data/skills-generated.js";

const sheetCache = new Map(); // id → HTMLImageElement | null(loading/failed)
function getSheet(id) {
  if (sheetCache.has(id)) return sheetCache.get(id);
  const img = new Image();
  img.src = `/skills/${id}_fx.png`;
  const rec = { img, ready: false };
  img.onload = () => { rec.ready = true; };
  img.onerror = () => { rec.failed = true; };
  sheetCache.set(id, rec);
  return rec;
}

/** 預載一批技能的特效圖（進場時呼叫，避免首次施放卡頓） */
export function preloadSkillFx(ids) {
  for (const id of ids) if (manifest[id]?.fx) getSheet(id);
}

const ELEM_COLOR = {
  physical: "#fde68a", fire: "#fb7185", ice: "#7dd3fc",
  thunder: "#c4b5fd", poison: "#a3e635", holy: "#fef08a", dark: "#c084fc",
};

/**
 * 生成一個技能特效實例，push 進 fx list。
 * @param {Array} list  特效陣列
 * @param {string} skillId  內部技能 id (j200_4)
 * @param {number} x,y  施放世界座標（通常是命中點/目標）
 * @param {object} opts  {flip, scale}
 */
export function spawnSkillFx(list, skillId, x, y, opts = {}) {
  const man = manifest[skillId];
  const def = SKILLS[skillId] || {};
  if (man?.fx) {
    const { fw, fh, n, delays } = man.fx;
    list.push({
      real: true, id: skillId, x, y, t: 0,
      fw, fh, n, delays, total: delays.reduce((a, b) => a + b, 0),
      flip: opts.flip ? -1 : 1, scale: opts.scale || 1, loop: opts.loop ? 1 : 0,
    });
  } else {
    // 程序化 fallback：依 shape×element
    list.push({
      real: false, t: 0, life: 0.45, x, y,
      shape: def.shape || "arc", color: ELEM_COLOR[def.element] || "#fde68a",
      scale: opts.scale || 1, flip: opts.flip ? -1 : 1,
    });
  }
}

export function updateSkillFx(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const f = list[i];
    f.t += dt * 1000; // ms（真動畫 delays 是 ms）
    if (f.real) {
      if (!f.loop && f.t >= f.total) list.splice(i, 1);
    } else if (f.t / 1000 >= f.life) {
      list.splice(i, 1);
    }
  }
}

function frameAt(f) {
  let t = f.loop ? f.t % f.total : Math.min(f.t, f.total - 1);
  for (let i = 0; i < f.n; i++) {
    if (t < f.delays[i]) return i;
    t -= f.delays[i];
  }
  return f.n - 1;
}

export function drawSkillFx(ctx, list) {
  for (const f of list) {
    if (f.real) {
      const rec = getSheet(f.id);
      if (!rec.ready) continue;
      const fr = frameAt(f);
      const { fw, fh, scale, flip } = f;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(flip * scale, scale);
      ctx.imageSmoothingEnabled = false;
      // 幀在直向 sheet 的第 fr 格；以格中心對齊目標點
      ctx.drawImage(rec.img, 0, fr * fh, fw, fh, -fw / 2, -fh / 2, fw, fh);
      ctx.restore();
    } else {
      drawProcedural(ctx, f);
    }
  }
}

// ── 程序化 shape×element（沒真動畫的技能）──
function drawProcedural(ctx, f) {
  const p = Math.min(1, f.t / 1000 / f.life);
  const a = 1 - p;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(f.x, f.y);
  ctx.scale(f.flip * f.scale, f.scale);
  ctx.strokeStyle = f.color;
  ctx.fillStyle = f.color;
  ctx.lineWidth = 3;
  const R = 20 + p * 40;
  switch (f.shape) {
    case "bolt":
      ctx.fillRect(-6, -3, 40 * (1 - p * 0.5), 6);
      break;
    case "beam":
      ctx.globalAlpha = a * 0.7;
      ctx.fillRect(0, -8, 140, 16);
      break;
    case "arc":
      ctx.beginPath(); ctx.arc(0, 0, 34, -0.9, 0.9); ctx.stroke();
      break;
    case "multi":
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(i * 14 - 14, 0, 22, -0.7, 0.7); ctx.stroke(); }
      break;
    case "aoe":
    case "nova":
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = a * 0.25; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      break;
    case "rain":
      for (let i = 0; i < 5; i++) { const rx = (i - 2) * 24; ctx.fillRect(rx - 2, -80 + p * 90, 4, 20); }
      break;
    case "dash":
      ctx.globalAlpha = a * 0.6; ctx.fillRect(-50 * p, -14, 50, 28);
      break;
    case "buff":
      ctx.beginPath(); ctx.arc(0, 0, R * 0.8, 0, Math.PI * 2); ctx.stroke();
      break;
    case "heal":
      ctx.globalAlpha = a; ctx.font = "bold 20px system-ui"; ctx.textAlign = "center";
      ctx.fillText("✚", 0, -R); break;
    default:
      ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

/** 技能 icon 路徑（給技能列/ buff UI） */
export function skillIconUrl(skillId) {
  return manifest[skillId]?.icon ? `/skills/${skillId}_icon.png` : null;
}
