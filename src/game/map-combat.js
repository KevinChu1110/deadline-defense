/**
 * 地圖戰鬥層：野外圖的怪物 spawn/AI/攻擊/HP/死亡重生/接觸傷害/傷害跳字。
 * 由 town.js(通用地圖引擎)在偵測到 life 有 type==="m" 時啟用。
 * 怪物數值/圖來自 maplestory.io：/mob/{id}(maxHP/exp/physicalDamage) + /render/{stance}.gif
 */
import { sfx } from "../audio/sfx.js";

const MOB_API = "https://maplestory.io/api/GMS/214/mob";
const statCache = new Map();   // id -> {maxHp, exp, pad, name}
const spriteCache = new Map(); // id/stance -> Image

function mobStats(id) {
  if (statCache.has(id)) return statCache.get(id);
  const s = { maxHp: 20, exp: 3, pad: 5, name: "怪物", ready: false };
  statCache.set(id, s);
  fetch(`${MOB_API}/${id}`).then((r) => r.json()).then((d) => {
    s.maxHp = d?.meta?.maxHP || s.maxHp; s.exp = d?.meta?.exp ?? s.exp;
    s.pad = d?.meta?.physicalDamage || s.pad; s.name = d?.name || s.name; s.ready = true;
  }).catch(() => {});
  return s;
}
function mobSprite(id, stance) {
  const k = id + "/" + stance;
  if (spriteCache.has(k)) return spriteCache.get(k);
  const im = new Image(); im.crossOrigin = "anonymous";
  im.src = `${MOB_API}/${id}/render/${stance}`;
  spriteCache.set(k, im); return im;
}

export function createMapCombat({ town, footAt, player, profile, onKill }) {
  const mobs = [];
  for (const l of town.life || []) {
    if (l.type !== "m") continue;
    const st = mobStats(l.id);
    mobs.push({
      id: l.id, x0: l.x, y0: l.y, x: l.x, y: l.y, vx: (Math.random() < 0.5 ? -1 : 1) * 42, vy: 0,
      hp: st.maxHp, maxHp: st.maxHp, st, face: 1, dead: false, respawn: 0, hitFlash: 0, onGround: false,
    });
  }
  const floats = []; // {x,y,t,dmg,kind}
  const ATK_RANGE = 100, GRAV = 2000;

  function playerAttack() {
    let hit = false;
    for (const m of mobs) {
      if (m.dead) continue;
      const dx = (m.x - player.x) * player.face; // 面向前方
      if (dx > -20 && dx < ATK_RANGE && Math.abs(m.y - player.y) < 70) {
        const base = profile?.atk || 45;
        const crit = Math.random() < 0.22;
        let val = Math.round(base * (0.85 + Math.random() * 0.4));
        if (crit) val = Math.round(val * 1.6);
        m.hp -= val; m.hitFlash = 0.16; m.vx = Math.abs(m.vx) * player.face; // 擊退方向
        floats.push({ x: m.x + (Math.random() * 20 - 10), y: m.y - 46, t: 0, dmg: val, kind: crit ? "crit" : "hit" });
        hit = true;
        if (m.hp <= 0) { m.dead = true; m.respawn = 5; if (onKill) onKill(m); }
      }
    }
    if (hit) sfx.play("mobHit");
  }

  function update(dt, attackPressed) {
    if (attackPressed) playerAttack();
    for (const m of mobs) {
      if (m.dead) { if ((m.respawn -= dt) <= 0) { m.dead = false; m.hp = m.maxHp; m.x = m.x0; m.y = m.y0; m.vy = 0; } continue; }
      if (m.hitFlash > 0) m.hitFlash -= dt;
      if (m.maxHp !== m.st.maxHp && m.st.ready) { const full = m.hp >= m.maxHp; m.maxHp = m.st.maxHp; if (full) m.hp = m.maxHp; } // 數值到位後校正
      // 巡邏
      m.x += m.vx * dt;
      if (m.x < m.x0 - 130 || m.x > m.x0 + 130) m.vx *= -1;
      m.face = m.vx < 0 ? -1 : 1;
      // 重力 + foothold
      m.vy += GRAV * dt;
      const g = footAt(m.x, m.y);
      let ny = m.y + m.vy * dt;
      if (m.vy >= 0 && g !== null && ny >= g) { ny = g; m.vy = 0; m.onGround = true; } else m.onGround = false;
      m.y = ny;
      // 接觸傷害玩家
      if (player.invuln <= 0 && Math.abs(m.x - player.x) < 36 && Math.abs(m.y - player.y) < 54) {
        player.hp -= m.st.pad; player.invuln = 0.9;
      }
    }
    for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.t += dt; f.y -= 42 * dt; if (f.t > 0.8) floats.splice(i, 1); }
  }

  function aliveMobs() { return mobs.filter((m) => !m.dead); }

  function drawMob(ctx, m, worldToScreen, W) {
    const [sx, sy] = worldToScreen(m.x, m.y);
    if (sx < -100 || sx > W + 100) return;
    const im = mobSprite(m.id, "move");
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (m.hitFlash > 0) ctx.filter = "brightness(2.2)";
    if (im.complete && im.naturalWidth) {
      const sc = Math.min(1.6, 74 / im.height);
      const w = im.width * sc, h = im.height * sc;
      if (m.face < 0) { ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.drawImage(im, -w / 2, sy - h, w, h); }
      else ctx.drawImage(im, sx - w / 2, sy - h, w, h);
    } else { ctx.fillStyle = "rgba(120,60,40,0.5)"; ctx.fillRect(sx - 16, sy - 30, 32, 30); }
    ctx.restore();
    // HP 條(受傷才顯示)
    if (m.hp < m.maxHp) {
      const bw = 40, bh = 5, by = sy - 62;
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(sx - bw / 2 - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = "#3a3a3a"; ctx.fillRect(sx - bw / 2, by, bw, bh);
      ctx.fillStyle = "#ff4d4d"; ctx.fillRect(sx - bw / 2, by, bw * Math.max(0, m.hp / m.maxHp), bh);
    }
  }

  function drawFloats(ctx, worldToScreen) {
    ctx.textAlign = "center";
    for (const f of floats) {
      const [sx, sy] = worldToScreen(f.x, f.y);
      const a = Math.max(0, 1 - f.t / 0.8);
      ctx.globalAlpha = a;
      const crit = f.kind === "crit";
      ctx.font = `900 ${crit ? 26 : 20}px system-ui`;
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.fillStyle = crit ? "#ffd23c" : "#fff";
      ctx.strokeText(f.dmg, sx, sy); ctx.fillText(f.dmg, sx, sy);
    }
    ctx.globalAlpha = 1;
  }

  return { mobs, update, aliveMobs, drawMob, drawFloats };
}
