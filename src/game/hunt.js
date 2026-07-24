/**
 * 掛機探險引擎 — 側捲打怪。可掛機(AI自動打)、也可主動玩(一按鍵接管)。
 * 複用突襲的移動/跳/閃避/觸控手感；怪物用真實 sprite；技能用真實 WZ 特效。
 *
 * 操作：←→移動 · Space跳 · J普攻 · 技能鍵(可配置) · L/Shift閃避 · Esc離開
 *      任意輸入→手動接管；3秒無輸入→回自動掛機。
 */
import { ENEMIES } from "../data/enemies.js";
import { getCachedMob, sampleGifFrame, loadMobGif } from "./assets.js";
import { SKILLS } from "../data/skills-generated.js";
import { spawnSkillFx, updateSkillFx, drawSkillFx, preloadSkillFx } from "./skill-fx.js";

const W = 960, H = 540, GROUND = 452, GRAVITY = 1400;

/** 依玩家 family + 已解出真動畫，挑 4 個技能組技能列（優先有真特效的攻擊/buff） */
function pickLoadout(family) {
  const all = Object.values(SKILLS).filter((s) => s.family === family && s.active && s.maxLv > 1);
  const attacks = all.filter((s) => s.kind === "attack");
  const buffs = all.filter((s) => s.kind === "buff" && s.duration && s.duration.some((d) => d > 0));
  const heals = all.filter((s) => s.kind === "heal");
  const out = [];
  if (attacks[0]) out.push(attacks[0]);
  if (attacks[1]) out.push(attacks[1]);
  if (buffs[0]) out.push(buffs[0]);
  if (family === "mage" && heals[0]) out.push(heals[0]);
  else if (attacks[2]) out.push(attacks[2]);
  return out.slice(0, 4);
}

const DEFAULT_KEYS = ["KeyA", "KeyS", "KeyD", "KeyF"];

export function createHunt(opts) {
  const { canvas, profile, enemies, theme, keybinds, onExit } = opts;
  const ctx = canvas.getContext("2d");
  canvas.width = W; canvas.height = H;

  const keys = new Set();
  let running = true, raf = 0, last = performance.now();
  let idleT = 0, mode = "ai"; // ai | human

  const maxMp = profile.maxMp || Math.round((profile.maxHp || 400) * 0.6);
  const player = {
    x: 480, y: GROUND, vx: 0, vy: 0, w: 34, h: 50, face: 1, onGround: true,
    hp: profile.maxHp, maxHp: profile.maxHp, mp: maxMp, maxMp,
    invuln: 0, attackCd: 0, dashCd: 0, dashT: 0, dashDir: 1, anim: "idle", animT: 0, kills: 0,
  };
  const dashType = profile.style === "ranged" ? "backstep" : profile.family === "thief" ? "blink" : "lunge";

  // 技能列
  const loadout = pickLoadout(profile.family || "warrior");
  preloadSkillFx(loadout.map((s) => s.id));
  const keyMap = (keybinds && keybinds.length ? keybinds : DEFAULT_KEYS);
  const skills = loadout.map((def, i) => ({
    def, key: keyMap[i] || DEFAULT_KEYS[i], cd: 0,
    cdMax: def.kind === "buff" ? 12 : def.kind === "heal" ? 8 : 2.4 + i * 0.3,
    mp: (def.mp && def.mp[Math.min(def.mp.length - 1, 9)]) || 15,
    lv: Math.min(def.maxLv, 10),
  }));

  const monsters = [];
  const projectiles = [];
  const floats = [];
  const fx = [];
  const buffs = []; // {kind, mag, until, name}
  let spawnT = 0;

  // 敵人池（該圖真實怪）
  const pool = (enemies || []).map((e) => ENEMIES[e.id]).filter(Boolean);
  const spriteFiles = [...new Set(pool.map((d) => d.sprite).filter(Boolean))];
  spriteFiles.forEach((f) => loadMobGif(f).catch(() => {}));

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function floatText(x, y, text, color) { floats.push({ x, y, t: 0, life: 0.8, text, color }); }

  // ── buff 套用 ──
  function buffMul(kind) {
    let m = 1; const now = performance.now();
    for (const b of buffs) if (b.kind === kind && b.until > now) m *= 1 + b.mag / 100;
    return m;
  }
  function applyBuff(def, lv) {
    const idx = Math.min((def.duration?.length || 1) - 1, lv - 1);
    const dur = (def.duration && def.duration[idx]) || 30;
    const mag = (def.buffMag && def.buffMag[idx]) || 10;
    const now = performance.now();
    const ex = buffs.find((b) => b.name === def.name);
    if (ex) ex.until = now + dur * 1000;
    else buffs.push({ kind: def.buffKind || "misc", mag, until: now + dur * 1000, name: def.name, id: def.id });
    floatText(player.x, player.y - player.h - 16, def.name, "#a3e635");
  }

  // ── 怪物 ──
  function spawnMonster() {
    if (!pool.length || monsters.length >= 9) return;
    const def = pool[Math.floor(Math.random() * pool.length)];
    const side = Math.random() < 0.5 ? -1 : 1;
    monsters.push({
      def, x: player.x + side * rnd(360, 480), y: GROUND,
      hp: def.hp, maxHp: def.hp, face: -side, animTime: Math.random() * 2,
      atkCd: rnd(1, 2.5), hitFlash: 0, alive: true,
    });
  }

  function hurtMonster(m, dmg, crit) {
    m.hp -= dmg; m.hitFlash = 0.1;
    floatText(m.x, m.y - m.def.radius * 2 - 6, `${Math.round(dmg)}${crit ? "!" : ""}`, crit ? "#fbbf24" : "#fff");
    if (m.hp <= 0) { m.alive = false; player.kills++; floatText(m.x, m.y - 30, "+經驗", "#fde68a"); }
  }
  function hurtPlayer(dmg) {
    if (player.invuln > 0) return;
    player.hp = Math.max(0, player.hp - Math.round(dmg));
    player.invuln = 0.7;
    floatText(player.x, player.y - player.h - 8, `-${Math.round(dmg)}`, "#f87171");
    if (player.hp <= 0) finish();
  }

  function playerAtkDmg() {
    return Math.round(rnd(profile.basicMin, profile.basicMax) * buffMul("atk"));
  }

  function doBasic() {
    if (player.attackCd > 0) return;
    player.attackCd = (profile.attackCd || 0.5) / (buffMul("aspd") || 1);
    player.anim = "atk"; player.animT = 0.2;
    const crit = Math.random() < 0.15;
    const dmg = playerAtkDmg() * (crit ? 1.5 : 1);
    if (profile.style === "ranged") {
      projectiles.push({ x: player.x + player.face * 18, y: player.y - player.h * 0.55, vx: player.face * 560, dmg, crit, from: "p", r: 6, color: profile.family === "mage" ? "#60a5fa" : "#fbbf24", life: 1 });
    } else {
      for (const m of monsters) if (m.alive && Math.abs(m.x - player.x) < 70 && (m.x - player.x) * player.face > -20) hurtMonster(m, dmg, crit);
    }
  }

  function useSkill(s) {
    if (s.cd > 0 || player.mp < s.mp) return;
    s.cd = s.cdMax; player.mp -= s.mp;
    const d = s.def;
    if (d.kind === "buff") { applyBuff(d, s.lv); spawnSkillFx(fx, d.id, player.x, player.y - player.h * 0.5, { scale: 1 }); return; }
    if (d.kind === "heal") { const h = (d.dmg && d.dmg[s.lv - 1]) || 50; player.hp = Math.min(player.maxHp, player.hp + h * 4); spawnSkillFx(fx, d.id, player.x, player.y - player.h * 0.5, {}); floatText(player.x, player.y - player.h - 8, `+${h * 4}`, "#4ade80"); return; }
    // 攻擊技能：依 shape 命中
    const base = (d.dmg && d.dmg[Math.min(d.dmg.length - 1, s.lv - 1)]) || 100;
    const dmg = Math.round(base * (buffMul("atk")) * rnd(0.9, 1.1) * (profile.skillMin ? profile.skillMin / 40 : 1));
    const range = d.shape === "aoe" || d.shape === "nova" ? 200 : d.shape === "beam" ? 300 : d.shape === "rain" ? 260 : 120;
    let hit = 0;
    for (const m of monsters) {
      if (!m.alive) continue;
      const dx = m.x - player.x;
      const inFront = d.shape === "aoe" || d.shape === "nova" ? Math.abs(dx) < range : dx * player.face > -30 && Math.abs(dx) < range;
      if (inFront) { hurtMonster(m, dmg, Math.random() < 0.2); if (++hit >= (d.shape === "aoe" ? 99 : d.shape === "multi" ? 6 : 3)) break; }
    }
    // 特效放在玩家前方 or 目標群中心
    const fxX = d.shape === "aoe" || d.shape === "nova" ? player.x : player.x + player.face * 60;
    spawnSkillFx(fx, d.id, fxX, player.y - player.h * 0.5, { flip: player.face < 0 });
    player.anim = "skill"; player.animT = 0.3;
  }

  // ── 閃避 ──
  function doDash(dir) {
    if (player.dashCd > 0 || player.dashT > 0) return;
    player.dashCd = profile.family === "thief" ? 1.3 : 1.6;
    player.dashT = 0.18; player.invuln = Math.max(player.invuln, 0.32);
    let d = dir || player.face;
    if (dashType === "backstep") { const near = nearestMonster(); d = near ? (near.x < player.x ? 1 : -1) : player.face; }
    player.dashDir = d; player.face = dashType === "backstep" ? -d : d;
    player.vx = d * (dashType === "blink" ? 820 : 620);
  }
  function nearestMonster() {
    let best = null, bd = 1e9;
    for (const m of monsters) if (m.alive) { const dd = Math.abs(m.x - player.x); if (dd < bd) { bd = dd; best = m; } }
    return best;
  }

  // ── AI 控制器（掛機自動打）──
  function aiControl(dt) {
    const near = nearestMonster();
    let move = 0;
    if (near) {
      const dx = near.x - player.x;
      player.face = dx >= 0 ? 1 : -1;
      const want = profile.style === "ranged" ? 220 : 60;
      if (Math.abs(dx) > want) move = Math.sign(dx);
      // 攻擊
      if (Math.abs(dx) <= (profile.style === "ranged" ? 400 : 80)) doBasic();
      // 技能輪流放
      for (const s of skills) if (s.cd <= 0 && player.mp >= s.mp) { useSkill(s); break; }
      // 危險時閃避
      for (const m of monsters) if (m.alive && m.atkCd < 0.15 && Math.abs(m.x - player.x) < 70) { doDash(-Math.sign(near.x - player.x)); break; }
    }
    return move;
  }

  // ── 輸入 ──
  const onKey = (e, down) => {
    const c = e.code;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space", "KeyJ", "KeyL", ...DEFAULT_KEYS].includes(c) || keyMap.includes(c)) e.preventDefault();
    if (down) { keys.add(c); if (c === "Escape") { stop(); onExit?.(); return; } idleT = 0; if (mode === "ai" && c !== "Escape") mode = "human"; }
    else keys.delete(c);
  };
  const kd = (e) => onKey(e, true), ku = (e) => onKey(e, false);
  window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);

  function humanInput(dt) {
    let move = 0;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) move -= 1;
    if (keys.has("ArrowRight") || keys.has("KeyD")) move += 1;
    if ((keys.has("ArrowUp") || keys.has("Space")) && player.onGround) { player.vy = -(profile.jump || 560); player.onGround = false; }
    if (keys.has("KeyJ")) doBasic();
    if (keys.has("KeyL") || keys.has("ShiftLeft")) doDash(move);
    skills.forEach((s) => { if (keys.has(s.key)) useSkill(s); });
    return move;
  }

  function update(dt) {
    player.attackCd = Math.max(0, player.attackCd - dt);
    player.dashCd = Math.max(0, player.dashCd - dt);
    player.invuln = Math.max(0, player.invuln - dt);
    player.mp = Math.min(player.maxMp, player.mp + dt * 8); // MP 回復
    skills.forEach((s) => s.cd = Math.max(0, s.cd - dt));
    if (player.animT > 0 && (player.animT -= dt) <= 0) player.anim = "idle";
    idleT += dt;
    if (mode === "human" && idleT > 3) mode = "ai";

    let move = mode === "human" ? humanInput(dt) : aiControl(dt);

    if (player.dashT > 0) {
      player.dashT -= dt; player.vx = player.dashDir * (dashType === "blink" ? 820 : 620);
    } else if (move !== 0) { player.face = move; player.vx = move * (profile.moveSpeed || 200); }
    else player.vx *= Math.pow(0.001, dt);

    player.vy += GRAVITY * dt;
    player.x = Math.max(30, Math.min(W - 30, player.x + player.vx * dt));
    player.y += player.vy * dt;
    if (player.y >= GROUND) { player.y = GROUND; player.vy = 0; player.onGround = true; }

    // 刷怪
    spawnT -= dt; if (spawnT <= 0) { spawnMonster(); spawnT = rnd(1.2, 2.4); }

    // 怪物 AI
    for (const m of monsters) {
      if (!m.alive) continue;
      m.animTime += dt; m.hitFlash = Math.max(0, m.hitFlash - dt);
      const dx = player.x - m.x; m.face = dx >= 0 ? 1 : -1;
      const spd = (m.def.speed || 50) * 0.7;
      if (Math.abs(dx) > 42) m.x += Math.sign(dx) * spd * dt;
      else { m.atkCd -= dt; if (m.atkCd <= 0) { m.atkCd = rnd(1.4, 2.6); hurtPlayer((m.def.leakDamage || 3) * 3 + m.def.level * 0.4); } }
    }
    for (let i = monsters.length - 1; i >= 0; i--) if (!monsters[i].alive) monsters.splice(i, 1);

    // 投射物
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i]; p.x += p.vx * dt; p.life -= dt;
      if (p.life <= 0 || p.x < -40 || p.x > W + 40) { projectiles.splice(i, 1); continue; }
      for (const m of monsters) if (m.alive && Math.abs(m.x - p.x) < m.def.radius + 8 && Math.abs((m.y - m.def.radius) - p.y) < 40) { hurtMonster(m, p.dmg, p.crit); projectiles.splice(i, 1); break; }
    }
    for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.t += dt; f.y -= 34 * dt; if (f.t >= f.life) floats.splice(i, 1); }
    for (let i = buffs.length - 1; i >= 0; i--) if (buffs[i].until <= performance.now()) buffs.splice(i, 1);
    updateSkillFx(fx, dt);
  }

  // ── 繪製 ──
  function draw() {
    // 背景（依主題）
    const sky = theme?.sky || ["#1a2744", "#2d1f3d"];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = theme?.ground?.[1] || "#3d2a18"; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = "rgba(255,248,220,0.25)"; ctx.fillRect(0, GROUND, W, 3);

    // 怪物
    for (const m of monsters) {
      const gif = m.def.sprite ? getCachedMob(m.def.sprite) : null;
      const fr = gif ? sampleGifFrame(gif, m.animTime) : null;
      // 血條
      ctx.fillStyle = "#1a1208"; ctx.fillRect(m.x - 16, m.y - m.def.radius * 2 - 16, 32, 4);
      ctx.fillStyle = "#f87171"; ctx.fillRect(m.x - 15, m.y - m.def.radius * 2 - 15, 30 * Math.max(0, m.hp / m.maxHp), 2);
      if (fr) {
        const sc = Math.min(1.4, (m.def.radius * 3.2) / fr.height);
        const w = fr.width * sc, h = fr.height * sc;
        ctx.save(); if (m.hitFlash > 0) ctx.filter = "brightness(2)";
        if (m.face > 0) { ctx.translate(m.x, 0); ctx.scale(-1, 1); ctx.drawImage(fr, -w / 2, m.y - h, w, h); }
        else ctx.drawImage(fr, m.x - w / 2, m.y - h, w, h);
        ctx.restore();
      } else { ctx.fillStyle = m.def.color; ctx.beginPath(); ctx.arc(m.x, m.y - m.def.radius, m.def.radius, 0, Math.PI * 2); ctx.fill(); }
    }

    // 玩家
    ctx.save();
    if (player.invuln > 0 && Math.floor(player.invuln * 20) % 2 === 0) ctx.globalAlpha = 0.4;
    const body = { mage: "#60a5fa", thief: "#a78bfa", archer: "#4ade80", pirate: "#fbbf24" }[profile.family] || "#f87171";
    ctx.fillStyle = "#2a1f14"; ctx.fillRect(player.x - player.w / 2 - 1, player.y - player.h - 1, player.w + 2, player.h + 2);
    ctx.fillStyle = body; ctx.fillRect(player.x - player.w / 2, player.y - player.h, player.w, player.h);
    ctx.fillStyle = "#f0c8a0"; ctx.fillRect(player.x - 9, player.y - player.h - 15, 18, 15);
    ctx.fillStyle = "#1a1a1a"; ctx.fillRect(player.x + player.face * 4 - 2, player.y - player.h - 9, 4, 4);
    ctx.restore();

    for (const p of projectiles) { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
    drawSkillFx(ctx, fx);
    for (const f of floats) { ctx.save(); ctx.globalAlpha = Math.max(0, 1 - f.t / f.life); ctx.fillStyle = f.color; ctx.font = "bold 14px system-ui"; ctx.textAlign = "center"; ctx.fillText(f.text, f.x, f.y); ctx.restore(); }

    drawHud();
  }

  function drawHud() {
    // HP/MP
    ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(14, 14, 232, 44);
    ctx.fillStyle = "#7f1d1d"; ctx.fillRect(18, 20, 220, 12); ctx.fillStyle = "#22c55e"; ctx.fillRect(18, 20, 220 * (player.hp / player.maxHp), 12);
    ctx.fillStyle = "#1e3a8a"; ctx.fillRect(18, 36, 220, 10); ctx.fillStyle = "#3b82f6"; ctx.fillRect(18, 36, 220 * (player.mp / player.maxMp), 10);
    ctx.fillStyle = "#fff8e0"; ctx.font = "bold 10px system-ui"; ctx.textAlign = "left";
    ctx.fillText(`HP ${Math.ceil(player.hp)}/${player.maxHp}  MP ${Math.ceil(player.mp)}`, 22, 30);

    // 模式 + 擊殺
    ctx.textAlign = "right"; ctx.fillStyle = mode === "ai" ? "#a3e635" : "#fbbf24"; ctx.font = "bold 13px system-ui";
    ctx.fillText(mode === "ai" ? "🤖 掛機中（按任意鍵接管）" : "🎮 手動（3秒不動回掛機）", W - 16, 28);
    ctx.fillStyle = "#fde68a"; ctx.fillText(`擊殺 ${player.kills}`, W - 16, 46);

    // 技能列
    const bx = W / 2 - (skills.length * 52) / 2;
    skills.forEach((s, i) => {
      const x = bx + i * 52, y = H - 60;
      ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(x, y, 46, 46);
      const rec = s.def.id;
      // icon
      const iconImg = iconCache(s.def.id);
      if (iconImg?.ready) ctx.drawImage(iconImg.img, x + 5, y + 3, 32, 32);
      else { ctx.fillStyle = "#333"; ctx.fillRect(x + 5, y + 3, 32, 32); }
      // 冷卻遮罩
      if (s.cd > 0) { ctx.fillStyle = "rgba(0,0,0,0.6)"; const ch = 46 * (s.cd / s.cdMax); ctx.fillRect(x, y + 46 - ch, 46, ch); }
      // 鍵位
      ctx.fillStyle = "#fff8e0"; ctx.font = "bold 10px system-ui"; ctx.textAlign = "center";
      ctx.fillText(s.key.replace("Key", ""), x + 23, y + 44);
    });

    // buff 列（真 icon + 倒數）
    const now = performance.now();
    buffs.forEach((b, i) => {
      const x = 18 + i * 40, y = 64;
      const iconImg = iconCache(b.id);
      if (iconImg?.ready) ctx.drawImage(iconImg.img, x, y, 26, 26);
      else { ctx.fillStyle = "#4b5563"; ctx.fillRect(x, y, 26, 26); }
      const remain = Math.max(0, (b.until - now) / 1000);
      ctx.fillStyle = "#a3e635"; ctx.font = "bold 9px system-ui"; ctx.textAlign = "center";
      ctx.fillText(remain.toFixed(0) + "s", x + 13, y + 36);
    });
  }

  // icon 快取
  const _icons = new Map();
  function iconCache(id) {
    if (_icons.has(id)) return _icons.get(id);
    const rec = { img: new Image(), ready: false };
    rec.img.src = `/skills/${id}_icon.png`;
    rec.img.onload = () => (rec.ready = true);
    rec.img.onerror = () => (rec.ready = false);
    _icons.set(id, rec);
    return rec;
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    update(dt); draw();
    raf = requestAnimationFrame(frame);
  }
  function start() { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); }
  function finish() { /* 倒下：補血續戰(掛機不死機制) */ player.hp = player.maxHp; player.invuln = 1.5; floatText(player.x, player.y - 40, "復活", "#fde68a"); }

  return { start, stop, canvas, getState: () => ({ kills: player.kills }) };
}
