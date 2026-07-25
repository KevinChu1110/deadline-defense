/**
 * 地圖戰鬥層：野外圖怪物 spawn/AI/攻擊/HP/受擊die動畫/楓幣掉落/EXP升級/接觸傷害/傷害跳字。
 * 由 town.js(通用地圖引擎)在偵測到 life 有 type==="m" 時啟用。
 * 怪物數值/圖來自 maplestory.io：/mob/{id}(maxHP/exp/physicalDamage) + /render/{move|hit1|die1}.gif
 * 註：楓幣/EXP/等級為本世界冒險模式的 session 內數值,不寫回 hub 玩家資料。
 */
import { sfx } from "../audio/sfx.js";

const MOB_API = "https://maplestory.io/api/GMS/214/mob";
const statCache = new Map();   // id -> {maxHp, exp, pad, name}
const spriteCache = new Map(); // id/stance -> Image
const GRAV = 2000;

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
const expToLevel = (lv) => 40 + lv * 12;

export function createMapCombat({ town, footAt, player, profile, onLevelUp }) {
  const mobs = [];
  for (const l of town.life || []) {
    if (l.type !== "m") continue;
    const st = mobStats(l.id);
    mobs.push({
      id: l.id, x0: l.x, y0: l.y, x: l.x, y: l.y, vx: (Math.random() < 0.5 ? -1 : 1) * 42, vy: 0,
      hp: st.maxHp, maxHp: st.maxHp, st, face: 1, dead: false, dying: false, dieT: 0, respawn: 0, hitFlash: 0,
    });
  }
  const floats = []; // {x,y,t,life,text,color,size}
  const coins = [];  // {x,y,vx,vy,landed,t,amt}
  const ATK_RANGE = 100;

  function addFloat(x, y, text, color, size, life = 0.8) { floats.push({ x, y, t: 0, life, text, color, size }); }

  function killMob(m) {
    m.dying = true; m.dieT = 0; m.hp = 0;
    // 楓幣掉落
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) coins.push({ x: m.x + (Math.random() * 16 - 8), y: m.y - 20, vx: (Math.random() * 280 - 140), vy: -(200 + Math.random() * 140), landed: false, t: 0, amt: 1 + Math.floor(Math.random() * 3) });
    // EXP(冒險模式 ×5 好推進)
    player.exp = (player.exp || 0) + (m.st.exp || 1) * 5;
    let need = expToLevel(player.level || 1);
    while (player.exp >= need) {
      player.exp -= need; player.level = (player.level || 1) + 1;
      player.maxHp += 20; player.hp = player.maxHp; player.atk = (player.atk || 45) + 4;
      addFloat(player.x, player.y - 70, "LEVEL UP!", "#5cf0ff", 22, 1.1);
      sfx.play("levelUp");
      if (onLevelUp) onLevelUp(player.level);
      need = expToLevel(player.level);
    }
  }

  function playerAttack() {
    let hit = false;
    for (const m of mobs) {
      if (m.dead || m.dying) continue;
      const dx = (m.x - player.x) * player.face; // 面向前方
      if (dx > -20 && dx < ATK_RANGE && Math.abs(m.y - player.y) < 70) {
        const base = player.atk || profile?.atk || 45;
        const crit = Math.random() < 0.22;
        let val = Math.round(base * (0.85 + Math.random() * 0.4));
        if (crit) val = Math.round(val * 1.6);
        m.hp -= val; m.hitFlash = 0.2; m.vx = Math.abs(m.vx) * player.face; // 擊退方向
        addFloat(m.x + (Math.random() * 20 - 10), m.y - 46, String(val), crit ? "#ffd23c" : "#fff", crit ? 26 : 20);
        hit = true;
        if (m.hp <= 0) killMob(m);
      }
    }
    if (hit) sfx.play("mobHit");
  }

  function update(dt, attackPressed) {
    if (attackPressed) playerAttack();
    for (const m of mobs) {
      if (m.dead) { if ((m.respawn -= dt) <= 0) { m.dead = false; m.dying = false; m.hp = m.maxHp; m.x = m.x0; m.y = m.y0; m.vy = 0; } continue; }
      if (m.dying) { m.dieT += dt; if (m.dieT > 0.55) { m.dead = true; m.respawn = 5; } continue; }
      if (m.hitFlash > 0) m.hitFlash -= dt;
      if (m.maxHp !== m.st.maxHp && m.st.ready) { const full = m.hp >= m.maxHp; m.maxHp = m.st.maxHp; if (full) m.hp = m.maxHp; }
      // 巡邏
      m.x += m.vx * dt;
      if (m.x < m.x0 - 130 || m.x > m.x0 + 130) m.vx *= -1;
      m.face = m.vx < 0 ? -1 : 1;
      // 重力 + foothold
      m.vy += GRAV * dt;
      const g = footAt(m.x, m.y);
      let ny = m.y + m.vy * dt;
      if (m.vy >= 0 && g !== null && ny >= g) { ny = g; m.vy = 0; }
      m.y = ny;
      // 接觸傷害玩家
      if (player.invuln <= 0 && Math.abs(m.x - player.x) < 36 && Math.abs(m.y - player.y) < 54) {
        player.hp -= m.st.pad; player.invuln = 0.9;
        addFloat(player.x, player.y - 60, String(m.st.pad), "#ff6b6b", 16, 0.6);
      }
    }
    // 楓幣：彈跳→落地→吸附→撿取
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i]; c.t += dt;
      if (!c.landed) {
        c.vy += 900 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
        const g = footAt(c.x, c.y);
        if (g !== null && c.y >= g) { c.y = g; c.landed = true; c.t = 0; c.vx = 0; }
      } else if (c.t > 0.3) {
        const dx = player.x - c.x, dy = (player.y - 24) - c.y, d = Math.hypot(dx, dy) || 1;
        c.x += (dx / d) * 560 * dt; c.y += (dy / d) * 560 * dt;
        if (d < 24) { player.coins = (player.coins || 0) + c.amt; addFloat(player.x, player.y - 72, `+${c.amt}`, "#ffe14d", 15, 0.7); sfx.play("mesoPick"); coins.splice(i, 1); continue; }
      }
      if (c.t > 10) coins.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.t += dt; f.y -= 42 * dt; if (f.t > f.life) floats.splice(i, 1); }
  }

  function aliveMobs() { return mobs.filter((m) => !m.dead); } // 含 dying(要播死亡動畫)

  function drawMob(ctx, m, worldToScreen, W) {
    const [sx, sy] = worldToScreen(m.x, m.y);
    if (sx < -100 || sx > W + 100) return;
    const stance = m.dying ? "die1" : (m.hitFlash > 0 ? "hit1" : "move");
    const im = mobSprite(m.id, stance);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (m.dying) ctx.globalAlpha = Math.max(0, 1 - m.dieT / 0.55); // 死亡淡出
    if (im.complete && im.naturalWidth) {
      const sc = Math.min(1.6, 74 / im.height);
      const w = im.width * sc, h = im.height * sc;
      if (m.face < 0) { ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.drawImage(im, -w / 2, sy - h, w, h); }
      else ctx.drawImage(im, sx - w / 2, sy - h, w, h);
    } else { ctx.fillStyle = "rgba(120,60,40,0.5)"; ctx.fillRect(sx - 16, sy - 30, 32, 30); }
    ctx.restore();
    // HP 條(受傷且未死才顯示)
    if (!m.dying && m.hp < m.maxHp) {
      const bw = 40, bh = 5, by = sy - 62;
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(sx - bw / 2 - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = "#3a3a3a"; ctx.fillRect(sx - bw / 2, by, bw, bh);
      ctx.fillStyle = "#ff4d4d"; ctx.fillRect(sx - bw / 2, by, bw * Math.max(0, m.hp / m.maxHp), bh);
    }
  }

  function drawCoins(ctx, worldToScreen) {
    for (const c of coins) {
      const [sx, sy] = worldToScreen(c.x, c.y);
      const bob = c.landed ? Math.sin(c.t * 8) * 1.5 : 0;
      const cy = sy - 6 + bob, r = 5;
      const g = ctx.createRadialGradient(sx - 1.5, cy - 1.5, 0.5, sx, cy, r);
      g.addColorStop(0, "#fff3b0"); g.addColorStop(0.5, "#ffd23c"); g.addColorStop(1, "#c8890f");
      ctx.beginPath(); ctx.arc(sx, cy, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = "#8a5a00"; ctx.stroke();
    }
  }

  function drawFloats(ctx, worldToScreen) {
    ctx.textAlign = "center";
    for (const f of floats) {
      const [sx, sy] = worldToScreen(f.x, f.y);
      ctx.globalAlpha = Math.max(0, 1 - f.t / f.life);
      ctx.font = `900 ${f.size}px system-ui`;
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.fillStyle = f.color;
      ctx.strokeText(f.text, sx, sy); ctx.fillText(f.text, sx, sy);
    }
    ctx.globalAlpha = 1;
  }

  // EXP 進度(0~1)給 HUD
  function expPct() { return Math.max(0, Math.min(1, (player.exp || 0) / expToLevel(player.level || 1))); }

  return { mobs, update, aliveMobs, drawMob, drawCoins, drawFloats, expPct };
}
