/**
 * 掛機探險引擎 — 側捲打怪。可掛機(AI自動打)、也可主動玩(一按鍵接管)。
 * 複用突襲的移動/跳/閃避/觸控手感；怪物用真實 sprite；技能用真實 WZ 特效。
 *
 * 操作：←→移動 · Space跳 · J普攻 · 技能鍵(可配置) · L/Shift閃避 · Esc離開
 *      任意輸入→手動接管；3秒無輸入→回自動掛機。
 */
import { ENEMIES } from "../data/enemies.js";
import { getCachedMob, sampleGifFrame, loadMobGif } from "./assets.js";
import { SKILLS, JOB_SKILLS } from "../data/skills-generated.js";
import { spawnSkillFx, updateSkillFx, drawSkillFx, preloadSkillFx, hasSkillFx } from "./skill-fx.js";
import { createAvatar, drawAvatar } from "./avatar.js";
import { drawHud as drawOfficialHud } from "./hud.js";
import { drawDmgNumber } from "./damage-num.js";
import { sfx } from "../audio/sfx.js";
import { drawLevelUp, LEVELUP_DURATION } from "./levelup-fx.js";

const W = 960, H = 540, GROUND = 452, GRAVITY = 1400;

// Discord 職業 slug → skills.json 4轉職業碼（英雄團/皇家取最高階）
const CLASS_JOBCODE = {
  beginner: "0", noblesse: "0",
  hero: "130", paladin: "131", dark_knight: "132",
  mage: "230", fire_mage: "231", ice_mage: "232",
  bowmaster: "330", marksman: "331",
  night_envoy: "430", shadow_bandit: "431",
  buccaneer: "530", gunslinger: "531",
  soul_swordsman: "612", flame_wizard: "622", wind_breaker: "632", night_walker: "642", thunder_breaker: "652",
  aran: "713", evan: "723", mercedes: "733", luminous: "743", phantom: "753",
};

/** 該職業「整條進化線」的職業碼（冒險家 100→11b→12b→13b；皇家/英雄同前兩碼各階） */
function jobChain(code) {
  if (!code) return [];
  if (code[0] === "6" || code[0] === "7") {
    const pre = code.slice(0, 2);
    return Object.keys(JOB_SKILLS).filter((k) => k.startsWith(pre));
  }
  const fam = code[0], b = code.slice(-1);
  return [`${fam}00`, `${fam}1${b}`, `${fam}2${b}`, `${fam}3${b}`].filter((k) => JOB_SKILLS[k]);
}

/**
 * 依角色「真實職業」挑技能列；沒 slug 才退回 family。優先有 WZ 真動畫的技能。
 */
function pickLoadout(family, classSlug) {
  let pool = [];
  const code = classSlug && CLASS_JOBCODE[classSlug];
  if (code) {
    const ids = jobChain(code).flatMap((k) => JOB_SKILLS[k] || []);
    pool = ids.map((id) => SKILLS[id]).filter(Boolean);
  }
  if (pool.length < 4) pool = pool.concat(Object.values(SKILLS).filter((s) => s.family === family));
  const active = pool.filter((s) => s.active && s.maxLv > 1);
  const byFx = (a, b) => (hasSkillFx(b.id) ? 1 : 0) - (hasSkillFx(a.id) ? 1 : 0);
  const attacks = active.filter((s) => s.kind === "attack").sort(byFx);
  const buffs = active.filter((s) => s.kind === "buff" && s.duration && s.duration.some((d) => d > 0)).sort(byFx);
  const heals = active.filter((s) => s.kind === "heal").sort(byFx);
  const out = [];
  const seen = new Set();
  const add = (s) => { if (s && !seen.has(s.id)) { seen.add(s.id); out.push(s); } };
  add(attacks[0]); add(attacks[1]);
  add(buffs[0]);
  if (family === "mage" && heals[0]) add(heals[0]); else add(attacks[2]);
  return out.slice(0, 4);
}

// 技能預設鍵：用數字列(不與 WASD 移動衝突)
const DEFAULT_SKILL_KEYS = ["Digit1", "Digit2", "Digit3", "Digit4"];
export const DEFAULT_KEYBINDS = { attack: "KeyJ", jump: "Space", dash: "KeyL", skills: [...DEFAULT_SKILL_KEYS] };

export function createHunt(opts) {
  const { canvas, profile, enemies, theme, keybinds, charClass, bgCode, appearance, onExit } = opts;
  const ctx = canvas.getContext("2d");
  canvas.width = W; canvas.height = H;

  // 真實地圖背景（Map.wz 擷取）
  let bgImg = null;
  if (bgCode) { const im = new Image(); im.src = `/hunt-bg/${bgCode}.png`; im.onload = () => (bgImg = im); }
  // 玩家紙娃娃：動畫版(appearance) + 靜態墊底
  const avatar = appearance ? createAvatar(appearance) : null;
  let avatarImg = null;
  if (charClass) { const a = new Image(); a.src = `/avatars/${charClass}.png`; a.onload = () => (avatarImg = a); }

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

  // 按鍵配置（物件；相容舊陣列格式）
  const kb = Array.isArray(keybinds)
    ? { ...DEFAULT_KEYBINDS, skills: keybinds }
    : { ...DEFAULT_KEYBINDS, ...(keybinds || {}), skills: (keybinds && keybinds.skills) || DEFAULT_SKILL_KEYS };

  // 技能列（依真實職業）
  const loadout = pickLoadout(profile.family || "warrior", charClass);
  preloadSkillFx(loadout.map((s) => s.id));
  const skills = loadout.map((def, i) => ({
    def, key: kb.skills[i] || DEFAULT_SKILL_KEYS[i], cd: 0,
    cdMax: def.kind === "buff" ? 12 : def.kind === "heal" ? 8 : 2.4 + i * 0.3,
    mp: (def.mp && def.mp[Math.min(def.mp.length - 1, 9)]) || 15,
    lv: Math.min(def.maxLv, 10),
  }));

  const monsters = [];
  const projectiles = [];
  const floats = [];
  const coins = []; // 楓幣掉落 {x,y,vx,vy,landed,t,amt}
  let levelupT = -1; // >=0 表示升級光效播放中
  const fx = [];
  const buffs = []; // {kind, mag, until, name}
  let spawnT = 0;

  // 敵人池（該圖真實怪）
  const pool = (enemies || []).map((e) => ENEMIES[e.id]).filter(Boolean);
  const spriteFiles = [...new Set(pool.map((d) => d.sprite).filter(Boolean))];
  spriteFiles.forEach((f) => loadMobGif(f).catch(() => {}));

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function floatText(x, y, text, color) { floats.push({ x, y, t: 0, life: 0.8, text, color }); }
  // 官方傷害跳字：kind = normal|crit|miss
  function floatDamage(x, y, value, kind) { floats.push({ x, y, t: 0, life: kind === "crit" ? 0.95 : 0.75, dmg: value, kind }); }

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

  const killLog = {}; // monster id → count（給 bot 結算經驗掉落）
  function hurtMonster(m, dmg, crit) {
    if (!m.alive) return;
    m.hp -= dmg; m.hitFlash = 0.1;
    floatDamage(m.x, m.y - m.def.radius * 2 - 6, dmg, crit ? "crit" : "normal");
    sfx.play("mobHit"); // 官方受擊音(內部節流)
    if (m.hp <= 0) {
      m.alive = false; player.kills++;
      killLog[m.def.id] = (killLog[m.def.id] || 0) + 1;
      floatText(m.x, m.y - 30, "+經驗", "#fde68a");
      // 每 25 殺 = 升級慶祝(官方光效 + 升級音)
      if (player.kills % 25 === 0) { levelupT = 0; sfx.play("levelUp"); }
      // 楓幣掉落：弧線噴出
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) coins.push({ x: m.x + rnd(-6, 6), y: m.y - m.def.radius, vx: rnd(-140, 140), vy: rnd(-320, -200), landed: false, t: 0, amt: 1 + Math.floor((m.def.level || 1) * rnd(0.5, 1.5)) });
    }
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
    sfx.play(profile.family === "pirate" ? "atkPunch" : "atkSword"); // 官方揮擊音
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
  const boundKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "KeyA", "KeyD", "ShiftLeft", kb.attack, kb.jump, kb.dash, ...kb.skills]);
  const onKey = (e, down) => {
    const c = e.code;
    if (boundKeys.has(c)) e.preventDefault();
    if (down) { keys.add(c); if (c === "Escape") { stop(); onExit?.(); return; } idleT = 0; if (mode === "ai" && c !== "Escape") mode = "human"; }
    else keys.delete(c);
  };
  const kd = (e) => onKey(e, true), ku = (e) => onKey(e, false);
  window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);

  function humanInput(dt) {
    let move = 0;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) move -= 1;
    if (keys.has("ArrowRight") || keys.has("KeyD")) move += 1;
    if ((keys.has("ArrowUp") || keys.has(kb.jump)) && player.onGround) { player.vy = -(profile.jump || 560); player.onGround = false; sfx.play("mapleJump"); }
    if (keys.has(kb.attack)) doBasic();
    if (keys.has(kb.dash) || keys.has("ShiftLeft")) doDash(move);
    skills.forEach((s) => { if (keys.has(s.key)) useSkill(s); });
    return move;
  }

  let lastDt = 0.016;
  function update(dt) {
    lastDt = dt;
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
    // 楓幣：弧線落地 → 短暫停 → 吸向玩家 → 拾取
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i]; c.t += dt;
      if (!c.landed) {
        c.vy += 900 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
        if (c.y >= GROUND) { c.y = GROUND; c.landed = true; c.t = 0; c.vx = 0; }
      } else if (c.t > 0.35) {
        const dx = player.x - c.x, dy = (player.y - 24) - c.y, d = Math.hypot(dx, dy) || 1;
        c.x += (dx / d) * 520 * dt; c.y += (dy / d) * 520 * dt;
        if (d < 22) { player.meso = (player.meso || 0) + c.amt; floatText(player.x, player.y - player.h - 20, `+${c.amt}`, "#ffe14d"); sfx.play("mesoPick"); coins.splice(i, 1); continue; }
      }
      if (c.t > 8) coins.splice(i, 1); // 未撿超時消失
    }
    for (let i = buffs.length - 1; i >= 0; i--) if (buffs[i].until <= performance.now()) buffs.splice(i, 1);
    if (levelupT >= 0) { levelupT += dt; if (levelupT > LEVELUP_DURATION) levelupT = -1; }
    updateSkillFx(fx, dt);
  }

  // ── 繪製 ──
  function draw() {
    // 天空漸層（背景底）
    const sky = theme?.sky || ["#1a2744", "#2d1f3d"];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 真實地圖背景（貼近地面，橫向平鋪填滿）。平滑取樣把 WZ 抖動色偏averaging掉
    if (bgImg) {
      const targetH = Math.min(H * 0.78, GROUND);
      const sc = targetH / bgImg.height;
      const dw = bgImg.width * sc, dh = targetH;
      const yTop = GROUND - dh + 30;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.globalAlpha = 0.96;
      for (let x = 0; x < W; x += dw) ctx.drawImage(bgImg, x, yTop, dw, dh);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = theme?.ground?.[1] || "#3d2a18"; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = "rgba(255,248,220,0.25)"; ctx.fillRect(0, GROUND, W, 3);

    // 怪物
    for (const m of monsters) {
      const gif = m.def.sprite ? getCachedMob(m.def.sprite) : null;
      const fr = gif ? sampleGifFrame(gif, m.animTime) : null;
      let spriteTop = m.y - m.def.radius * 2;
      if (fr) {
        const sc = Math.min(1.4, (m.def.radius * 3.2) / fr.height);
        const w = fr.width * sc, h = fr.height * sc;
        spriteTop = m.y - h;
        ctx.save(); if (m.hitFlash > 0) ctx.filter = "brightness(2)";
        if (m.face > 0) { ctx.translate(m.x, 0); ctx.scale(-1, 1); ctx.drawImage(fr, -w / 2, m.y - h, w, h); }
        else ctx.drawImage(fr, m.x - w / 2, m.y - h, w, h);
        ctx.restore();
      } else { ctx.fillStyle = m.def.color; ctx.beginPath(); ctx.arc(m.x, m.y - m.def.radius, m.def.radius, 0, Math.PI * 2); ctx.fill(); }
      // 頭頂 HP + 腳下名條（楓之谷風），畫在 sprite 之上
      drawMobBar(m, spriteTop);
    }

    // 玩家（紙娃娃動畫；載入中用靜態圖或色塊墊）
    ctx.save();
    if (player.invuln > 0 && Math.floor(player.invuln * 20) % 2 === 0) ctx.globalAlpha = 0.4;
    const moving = Math.abs(player.vx) > 24 && player.onGround;
    const anim = (player.anim === "atk" || player.anim === "skill") ? "swingO1" : (moving ? "walk1" : "stand1");
    const targetH = player.h + 44;
    const drawn = avatar && drawAvatar(ctx, avatar, player.x, player.y + 6, {
      anim, dt: lastDt, flip: player.face, targetH,
    });
    if (!drawn) {
      if (avatarImg) {
        ctx.imageSmoothingEnabled = false;
        const sc = targetH / avatarImg.height;
        const w = avatarImg.width * sc, h = avatarImg.height * sc;
        if (player.face < 0) { ctx.translate(player.x, 0); ctx.scale(-1, 1); ctx.drawImage(avatarImg, -w / 2, player.y - h + 6, w, h); }
        else ctx.drawImage(avatarImg, player.x - w / 2, player.y - h + 6, w, h);
      } else {
        const body = { mage: "#60a5fa", thief: "#a78bfa", archer: "#4ade80", pirate: "#fbbf24" }[profile.family] || "#f87171";
        ctx.fillStyle = "#2a1f14"; ctx.fillRect(player.x - player.w / 2 - 1, player.y - player.h - 1, player.w + 2, player.h + 2);
        ctx.fillStyle = body; ctx.fillRect(player.x - player.w / 2, player.y - player.h, player.w, player.h);
        ctx.fillStyle = "#f0c8a0"; ctx.fillRect(player.x - 9, player.y - player.h - 15, 18, 15);
      }
    }
    ctx.restore();

    // 升級光效（官方 LevelUp，覆蓋玩家）
    if (levelupT >= 0) drawLevelUp(ctx, player.x, player.y + 4, levelupT);

    // 楓幣（金幣：金漸層+高光）
    for (const c of coins) {
      const bob = c.landed ? Math.sin(c.t * 8) * 1.5 : 0;
      const cy = c.y - 6 + bob, r = 5;
      const g = ctx.createRadialGradient(c.x - 1.5, cy - 1.5, 0.5, c.x, cy, r);
      g.addColorStop(0, "#fff3b0"); g.addColorStop(0.5, "#ffd23c"); g.addColorStop(1, "#c8890f");
      ctx.beginPath(); ctx.arc(c.x, cy, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = "#8a5a00"; ctx.stroke();
    }

    for (const p of projectiles) { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
    drawSkillFx(ctx, fx);
    for (const f of floats) {
      const prog = f.t / f.life, alpha = Math.max(0, 1 - prog);
      if (f.kind) {
        // 官方傷害數字：暴擊較大 + 起始彈跳放大
        const base = f.kind === "crit" ? 0.82 : 0.62;
        const pop = f.t < 0.12 ? 1 + (0.12 - f.t) * 2.2 : 1;
        const drawn = drawDmgNumber(ctx, f.x, f.y, f.dmg, f.kind, alpha, base * pop);
        if (!drawn) { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = f.kind === "crit" ? "#ff5aa5" : "#ffcc33"; ctx.font = "bold 16px system-ui"; ctx.textAlign = "center"; ctx.fillText(String(Math.round(f.dmg)), f.x, f.y); ctx.restore(); }
      } else {
        ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = f.color; ctx.font = "bold 14px system-ui"; ctx.textAlign = "center"; ctx.fillText(f.text, f.x, f.y); ctx.restore();
      }
    }

    drawHud();
  }

  // 怪物頭頂 HP 條 + 腳下名條（楓之谷風）
  function drawMobBar(m, spriteTop) {
    const hpPct = Math.max(0, m.hp / m.maxHp);
    const bw = Math.max(30, m.def.radius * 2.4);
    const by = (spriteTop ?? m.y - m.def.radius * 2) - 8;
    // HP 條：深框 + 綠漸層(低血轉紅)
    ctx.save();
    ctx.fillStyle = "#000"; ctx.fillRect(m.x - bw / 2 - 1, by - 1, bw + 2, 6);
    ctx.fillStyle = "#3a2418"; ctx.fillRect(m.x - bw / 2, by, bw, 4);
    if (hpPct > 0) {
      const gd = ctx.createLinearGradient(0, by, 0, by + 4);
      if (hpPct > 0.3) { gd.addColorStop(0, "#a8f06a"); gd.addColorStop(1, "#48b024"); }
      else { gd.addColorStop(0, "#ff9a6a"); gd.addColorStop(1, "#d43a1a"); }
      ctx.fillStyle = gd; ctx.fillRect(m.x - bw / 2, by, bw * hpPct, 4);
    }
    // 名條：怪物中文名，腳下(灰底白字)
    const name = m.def.nameZh || m.def.name || "";
    if (name) {
      ctx.font = "700 11px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      const tw = ctx.measureText(name).width;
      const ny = m.y + 12;
      ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(m.x - tw / 2 - 4, ny - 11, tw + 8, 14);
      ctx.lineWidth = 2.5; ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.strokeText(name, m.x, ny);
      ctx.fillStyle = "#fff"; ctx.fillText(name, m.x, ny);
    }
    ctx.restore();
  }

  function drawHud() {
    // 官方底部狀態列(HP/MP/EXP/LV + 快捷技能格)
    drawOfficialHud(ctx, W, H, {
      level: profile.level,
      hp: player.hp, hpMax: player.maxHp,
      mp: player.mp, mpMax: player.maxMp,
      expPct: (player.kills % 25) / 25,
      skills: skills.map((s) => ({
        key: keyLabel(s.key), cd: s.cd, cdMax: s.cdMax,
        icon: iconCache(s.def.id)?.img,
      })),
    });

    // 模式 + 擊殺(右上)
    ctx.textAlign = "right"; ctx.fillStyle = mode === "ai" ? "#a3e635" : "#fbbf24"; ctx.font = "bold 13px system-ui";
    ctx.fillText(mode === "ai" ? "🤖 掛機中（按任意鍵接管）" : "🎮 手動（3秒不動回掛機）", W - 16, 28);
    ctx.fillStyle = "#fde68a"; ctx.fillText(`擊殺 ${player.kills}`, W - 16, 46);

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

  return {
    start, stop, canvas,
    getState: () => ({ kills: player.kills, killLog: { ...killLog } }),
  };
}

/** KeyboardEvent.code → 顯示標籤 */
export function keyLabel(code) {
  if (!code) return "—";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code === "Space") return "空白";
  if (code.startsWith("Arrow")) return { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" }[code];
  if (code === "ShiftLeft" || code === "ShiftRight") return "Shift";
  return code;
}
