/**
 * M3 動作突襲 v1 — 橫向站場
 * 操作：←→/AD 移動 · Space/W 跳 · J/Z 普攻 · K/X 技能 · L/Shift 閃避(i-frame) · Esc 退出
 * 手機：canvas 觸控四鍵（方向/跳/攻/技/閃）
 * Boss：真實 MapleStory 動畫(boss-anims.js) + 各王真實招式組(BOSS_KITS)
 */
import { loadMobGif, sampleGifFrame } from "./assets.js";
import { getBossKit, bossAnimFile, BOSS_ANIMS, resolveBossKey } from "../data/boss-anims.js";
import { drawHud as drawOfficialHud } from "./hud.js";

const W = 960;
const H = 540;
const GROUND = 448;
const GRAVITY = 1400;

/** @typedef {{ id:string, nameZh:string, sprite:string, maxHp:number, armor:number, color:string, tier:string }} BossDef */
/** @typedef {object} CombatProfile */

/**
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.canvas
 * @param {CombatProfile} opts.profile
 * @param {BossDef} opts.boss
 * @param {(result: object) => void} opts.onEnd
 * @param {() => void} [opts.onExit]
 */
export function createActionRaid(opts) {
  const { canvas, profile, boss, onEnd, onExit } = opts;
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;

  const keys = new Set();
  let running = true;
  let ended = false;
  let last = performance.now();
  let raf = 0;

  const player = {
    x: 160,
    y: GROUND,
    vx: 0,
    vy: 0,
    w: 36,
    h: 52,
    face: 1,
    onGround: true,
    hp: profile.maxHp,
    maxHp: profile.maxHp,
    invuln: 0,
    attackCd: 0,
    skillCd: 0,
    dashCd: 0,
    dashT: 0, // 閃避位移中的剩餘時間
    dashDir: 1,
    dashHitDone: false,
    anim: "idle",
    animT: 0,
  };

  // 閃避類型依職業：遠程後撤 / 盜賊瞬移穿透 / 近戰衝撞帶判定
  const dashType =
    profile.style === "ranged"
      ? "backstep"
      : profile.family === "thief"
        ? "blink"
        : "lunge";
  const dashCdMax = profile.family === "thief" ? 1.3 : 1.6; // 盜賊被動:閃避CD-20%
  const DASH_TIME = 0.18;
  const DASH_IFRAME = 0.32;

  const bossState = {
    x: 720,
    y: GROUND,
    w: 140,
    h: 160,
    hp: boss.maxHp,
    maxHp: boss.maxHp,
    face: -1,
    phase: 1,
    cast: null, // { kind, anim, t, duration, telegraph, hit }
    nextAt: 1.2,
    flash: 0,
    dead: false,
    animName: "stand",
    animClock: 0,
    hitAnimT: 0,
  };

  // 各王真實招式組 + 真實動畫（正規化 id：短id/botKey/中文名皆可）
  const bossKey = resolveBossKey(boss);
  const bossKit = getBossKit(bossKey);
  const bossGifs = {}; // animName → gif frames
  const bossAnimList = (BOSS_ANIMS[bossKey] || {}).anims || ["stand"];
  for (const a of bossAnimList) {
    const file = bossAnimFile(bossKey, a);
    if (file) loadMobGif(file).then((g) => { if (g) bossGifs[a] = g; }).catch(() => {});
  }
  function setBossAnim(name) {
    if (bossState.animName !== name) {
      bossState.animName = name;
      bossState.animClock = 0;
    }
  }

  /** @type {Array<{x:number,y:number,vx:number,vy:number,life:number,dmg:number,r:number,from:string,color:string}>} */
  const projectiles = [];
  /** @type {Array<{x:number,y:number,life:number,text:string,color:string}>} */
  const floats = [];
  /** @type {Array<{x:number,y:number,w:number,h:number,life:number,color:string,alpha:number}>} */
  const zones = [];


  const onKeyDown = (e) => {
    const k = e.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", " ", "a", "d", "w", "j", "k", "z", "x", "l"].includes(k) || e.code === "Space") {
      e.preventDefault();
    }
    keys.add(e.code);
    keys.add(k);
    if (e.code === "Escape") {
      stop(true);
      onExit?.();
    }
  };
  const onKeyUp = (e) => {
    keys.delete(e.code);
    keys.delete(e.key.toLowerCase());
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // ── 手機觸控層 ──
  // 觸控按鈕（canvas 座標）。左側方向、右側 跳/普攻/技能/閃避。
  const TOUCH_BTNS = [
    { key: "left", x: 70, y: H - 78, r: 40, label: "◀" },
    { key: "right", x: 170, y: H - 78, r: 40, label: "▶" },
    { key: "dash", x: W - 250, y: H - 60, r: 34, label: "閃" },
    { key: "jump", x: W - 170, y: H - 96, r: 38, label: "跳" },
    { key: "atk", x: W - 90, y: H - 118, r: 42, label: "攻" },
    { key: "skill", x: W - 64, y: H - 42, r: 36, label: "技" },
  ];
  const touch = { move: 0, jump: false, atk: false, skill: false, dashEdge: false };
  const pointerBtn = new Map(); // pointerId → key
  let touchMode = window.matchMedia?.("(pointer: coarse)")?.matches || false;

  function canvasXY(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }
  function hitBtn(x, y) {
    for (const b of TOUCH_BTNS) {
      if (Math.hypot(x - b.x, y - b.y) <= b.r + 6) return b.key;
    }
    return null;
  }
  function recomputeTouch() {
    const held = new Set(pointerBtn.values());
    touch.move = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
    touch.jump = held.has("jump");
    touch.atk = held.has("atk");
    touch.skill = held.has("skill");
  }
  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && !touchMode) return;
    touchMode = true;
    const { x, y } = canvasXY(e);
    const key = hitBtn(x, y);
    if (!key) return;
    e.preventDefault();
    pointerBtn.set(e.pointerId, key);
    if (key === "dash") touch.dashEdge = true; // 邊緣觸發，update 消費
    recomputeTouch();
  };
  const onPointerUp = (e) => {
    if (!pointerBtn.has(e.pointerId)) return;
    pointerBtn.delete(e.pointerId);
    recomputeTouch();
  };
  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerUp);

  function pressed(code, alt) {
    return keys.has(code) || (alt && keys.has(alt));
  }

  function roll(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  function floatText(x, y, text, color) {
    floats.push({ x, y, life: 0.9, text, color });
  }

  function hurtPlayer(dmg, srcX) {
    if (player.invuln > 0 || ended) return;
    const final = Math.max(1, Math.round(dmg));
    player.hp = Math.max(0, player.hp - final);
    player.invuln = 0.85;
    player.vx = srcX < player.x ? 220 : -220;
    player.vy = -280;
    player.onGround = false;
    floatText(player.x, player.y - player.h - 10, `-${final}`, "#f87171");
    if (player.hp <= 0) finish(false);
  }

  function hurtBoss(dmg, crit) {
    if (bossState.dead || ended) return;
    const reduced = Math.max(1, Math.round(dmg * (1 - (boss.armor || 0))));
    bossState.hp = Math.max(0, bossState.hp - reduced);
    bossState.flash = 0.12;
    if (!bossState.cast) bossState.hitAnimT = 0.12; // 沒在施放時才播受擊動畫
    floatText(
      bossState.x + (Math.random() * 40 - 20),
      bossState.y - bossState.h + 20,
      crit ? `${reduced}!` : `${reduced}`,
      crit ? "#fbbf24" : "#fff"
    );
    const ratio = bossState.hp / bossState.maxHp;
    const newPhase = ratio <= 0.15 ? 3 : ratio <= 0.45 ? 2 : 1;
    if (newPhase > bossState.phase) {
      bossState.phase = newPhase;
      bossState.bannerT = 1.6;
      bossState.bannerText = newPhase === 3 ? `${boss.nameZh} · 狂暴！` : `${boss.nameZh} · 第 ${newPhase} 階段`;
      bossState.cast = null; // 打斷當前施放，進入新階段
    }
    if (bossState.hp <= 0) {
      bossState.dead = true;
      setBossAnim("die1");
      finish(true);
    }
  }

  function doBasic() {
    if (player.attackCd > 0 || ended) return;
    player.attackCd = profile.attackCd;
    player.anim = "atk";
    player.animT = 0.25;
    const dmg = roll(profile.basicMin, profile.basicMax);
    const crit = Math.random() < 0.12;
    const curse = player.cursedT > 0 ? 0.7 : 1; // 詛咒霧：輸出降 30%
    const final = Math.round((crit ? dmg * 1.5 : dmg) * curse);

    if (profile.style === "ranged") {
      projectiles.push({
        x: player.x + player.face * 20,
        y: player.y - player.h * 0.55,
        vx: player.face * 520,
        vy: 0,
        life: 0.9,
        dmg: final,
        r: 7,
        from: "player",
        color: profile.family === "mage" ? "#60a5fa" : "#fbbf24",
      });
    } else {
      // melee hitbox
      const hx = player.x + player.face * (profile.attackRange * 0.55);
      const hy = player.y - player.h * 0.5;
      const reach = profile.attackRange;
      if (
        Math.abs(hx - bossState.x) < reach + bossState.w * 0.25 &&
        Math.abs(hy - (bossState.y - bossState.h * 0.4)) < 80
      ) {
        hurtBoss(final, crit);
      }
    }
  }

  function doSkill() {
    if (player.skillCd > 0 || ended) return;
    player.skillCd = profile.skillCd;
    player.anim = "skill";
    player.animT = 0.4;
    const dmg = roll(profile.skillMin, profile.skillMax);
    const crit = Math.random() < 0.2;
    const curse = player.cursedT > 0 ? 0.7 : 1;
    const final = Math.round((crit ? dmg * 1.6 : dmg) * curse);

    if (profile.style === "ranged") {
      for (let i = 0; i < 5; i++) {
        projectiles.push({
          x: player.x + player.face * 16,
          y: player.y - player.h * 0.5 + (i - 2) * 10,
          vx: player.face * (440 + i * 20),
          vy: (i - 2) * 40,
          life: 1.0,
          dmg: Math.round(final * 0.35),
          r: 8,
          from: "player",
          color: "#c084fc",
        });
      }
    } else {
      // 旋風：短暫大範圍
      zones.push({
        x: player.x - 70,
        y: player.y - 90,
        w: 140,
        h: 100,
        life: 0.35,
        color: "rgba(250,204,21,0.35)",
        alpha: 0.5,
      });
      if (Math.abs(player.x - bossState.x) < 160) {
        hurtBoss(final, crit);
      }
    }
  }

  function doDash(inputDir) {
    if (player.dashCd > 0 || player.dashT > 0 || ended) return;
    player.dashCd = dashCdMax;
    player.dashT = DASH_TIME;
    player.invuln = Math.max(player.invuln, DASH_IFRAME); // 無敵幀：閃避核心
    player.anim = "dash";
    player.animT = 0.24;
    player.dashHitDone = false;
    let dir;
    if (dashType === "backstep") {
      dir = player.x < bossState.x ? -1 : 1; // 遠離 Boss
    } else {
      dir = inputDir || player.face; // 近戰/瞬移：往輸入方向，否則面向
    }
    player.dashDir = dir;
    player.face = dashType === "backstep" ? -dir : dir;
    const spd = dashType === "blink" ? 860 : dashType === "backstep" ? 560 : 660;
    player.vx = dir * spd;
    zones.push({
      x: player.x - 30,
      y: player.y - player.h,
      w: 60,
      h: player.h,
      life: 0.2,
      color: dashType === "blink" ? "rgba(167,139,250,0.4)" : "rgba(226,232,240,0.35)",
      alpha: 0.5,
    });
  }

  function pickBossAttack() {
    const avail = bossKit.filter((m) => (m.phase || 1) <= bossState.phase);
    return avail[Math.floor(Math.random() * avail.length)] || bossKit[0];
  }

  function startCast(move) {
    const rush = bossState.phase >= 3 ? 0.85 : 1;
    setBossAnim(move.anim || "attack1");
    bossState.cast = {
      kind: move.kind,
      anim: move.anim,
      t: 0,
      duration: (move.dur || 1.3) * rush,
      telegraph: (move.tel || 0.8) * rush,
      hit: false,
      hit2: false,
      hit3: false,
      aimX: player.x,
      fakeX: [],
    };
    // 安全座椅：在預警期就生成平台，讓玩家有時間跑上去
    if (move.kind === "safeseat") {
      const seatX = roll(200, W - 200);
      bossState.cast.seatX = seatX;
      zones.push({ x: seatX - 45, y: GROUND - 54, w: 90, h: 14, life: bossState.cast.duration, color: "rgba(94,234,212,0.55)", alpha: 0.75 });
    }
  }

  // 地面條狀 AOE 命中判定
  function groundZone(zx, w, dmg, color) {
    zones.push({ x: zx, y: GROUND - 20, w, h: 30, life: 0.45, color, alpha: 0.6 });
    if (player.x > zx && player.x < zx + w && player.onGround) hurtPlayer(dmg, zx + w / 2);
  }
  function pillarAt(px, dmg, color = "rgba(249,115,22,0.5)") {
    zones.push({ x: px - 28, y: GROUND - 200, w: 56, h: 200, life: 0.5, color, alpha: 0.7 });
    if (player.x > px - 28 && player.x < px + 28) hurtPlayer(dmg, px);
  }

  function resolveCast(c) {
    const ph = bossState.phase;
    const base = 18 + ph * 8;

    // ── 簽名機制：多段/延續型（自行管理命中，不受單次 c.hit 限制）──
    if (c.kind === "multismash") {
      // 炎魔八臂：3 段連砸，各段短預警落在隨機 x，強迫連續閃避
      const seg = [0.0, 0.33, 0.66].map((f) => c.telegraph + f * (c.duration - c.telegraph));
      if (!c.hit && c.t >= seg[0]) { c.hit = true; groundZone(roll(120, W - 320), 180, base + 10, "rgba(239,68,68,0.5)"); }
      if (!c.hit2 && c.t >= seg[1]) { c.hit2 = true; groundZone(roll(120, W - 320), 180, base + 10, "rgba(239,68,68,0.5)"); }
      if (!c.hit3 && c.t >= seg[2]) { c.hit3 = true; groundZone(roll(120, W - 320), 180, base + 12, "rgba(239,68,68,0.55)"); }
      return;
    }
    if (c.kind === "fakepillar") {
      // 拉圖斯：3 柱只 1 真，讀假落點
      if (!c.hit) {
        c.hit = true;
        const realX = c.aimX;
        const fakes = [realX - 180, realX + 180].map((x) => Math.max(80, Math.min(W - 80, x)));
        pillarAt(realX, base + 18, "rgba(192,132,252,0.6)");
        for (const fx of fakes) zones.push({ x: fx - 28, y: GROUND - 200, w: 56, h: 200, life: 0.25, color: "rgba(120,120,180,0.25)", alpha: 0.4 });
      }
      return;
    }
    if (c.kind === "tide") {
      // 海怒斯潮汐：吸向 Boss + 彈幕
      if (!c.hit) { c.hit = true; for (let i = 0; i < 5; i++) projectiles.push({ x: bossState.x - 20, y: GROUND - 60 - i * 20, vx: -180 - i * 25, vy: 0, life: 1.6, dmg: base, r: 12, from: "boss", color: "#38bdf8" }); }
      // 持續吸引（預警後到結束）
      if (c.t >= c.telegraph && player.onGround) player.x += (bossState.x < player.x ? -1 : 1) * 60 * (1 / 60);
      return;
    }
    if (c.kind === "safeseat") {
      // 皮卡啾：先生成安全座椅平台，再全屏；站座椅上免傷
      if (!c.seatX) { c.seatX = roll(200, W - 200); zones.push({ x: c.seatX - 45, y: GROUND - 54, w: 90, h: 14, life: c.duration, color: "rgba(94,234,212,0.55)", alpha: 0.7 }); }
      if (!c.hit && c.t >= c.telegraph) {
        c.hit = true;
        zones.push({ x: 40, y: GROUND - 40, w: W - 80, h: 50, life: 0.5, color: "rgba(236,72,153,0.45)", alpha: 0.6 });
        const onSeat = player.onGround && Math.abs(player.x - c.seatX) < 50;
        if (!onSeat && !(player.invuln > 0)) hurtPlayer(base + 26, player.x);
      }
      return;
    }
    if (c.kind === "beam") {
      // 龍息：Boss 半側全寬橫掃（跳+閃可躲，站地必中）
      if (!c.hit) {
        c.hit = true;
        const from = bossState.face < 0 ? 0 : bossState.x;
        const w = bossState.face < 0 ? bossState.x + 60 : W - bossState.x;
        zones.push({ x: from, y: GROUND - 70, w, h: 70, life: 0.5, color: "rgba(74,222,128,0.4)", alpha: 0.6 });
        if (player.onGround && player.x > from && player.x < from + w) hurtPlayer(base + 20, bossState.x);
      }
      return;
    }
    if (c.kind === "diagbarrage") {
      if (!c.hit) { c.hit = true; for (let i = 0; i < 6; i++) { const up = i % 2 === 0; projectiles.push({ x: bossState.x, y: GROUND - 40, vx: -260, vy: (up ? -1 : 1) * (80 + i * 20), life: 1.6, dmg: base, r: 11, from: "boss", color: "#818cf8" }); } }
      return;
    }
    if (c.kind === "darkcurse") {
      // 詛咒霧：命中降玩家攻擊 3s
      if (!c.hit) { c.hit = true; zones.push({ x: player.x - 70, y: GROUND - 120, w: 140, h: 120, life: 0.5, color: "rgba(88,28,135,0.4)", alpha: 0.6 }); if (Math.abs(player.x - c.aimX) < 90 && !(player.invuln > 0)) { hurtPlayer(base + 8, c.aimX); player.cursedT = 3.0; floatText(player.x, player.y - player.h - 20, "詛咒!", "#c084fc"); } }
      return;
    }

    // ── 基本招（單次命中）──
    if (c.hit) return;
    c.hit = true;

    if (c.kind === "smash") {
      const zx = bossState.x - 110;
      zones.push({
        x: zx,
        y: GROUND - 20,
        w: 220,
        h: 30,
        life: 0.45,
        color: "rgba(239,68,68,0.45)",
        alpha: 0.6,
      });
      if (player.x > zx && player.x < zx + 220 && player.onGround) {
        hurtPlayer(base + 12, bossState.x);
      }
    } else if (c.kind === "pillar") {
      const px = c.aimX - 28;
      zones.push({
        x: px,
        y: GROUND - 200,
        w: 56,
        h: 200,
        life: 0.5,
        color: "rgba(249,115,22,0.5)",
        alpha: 0.7,
      });
      if (player.x > px && player.x < px + 56) {
        hurtPlayer(base + 16, px);
      }
    } else if (c.kind === "swipe") {
      const dir = player.x < bossState.x ? -1 : 1;
      projectiles.push({
        x: bossState.x,
        y: GROUND - 40,
        vx: dir * 380,
        vy: 0,
        life: 1.4,
        dmg: base + 10,
        r: 22,
        from: "boss",
        color: "#f97316",
      });
    } else if (c.kind === "barrage") {
      for (let i = 0; i < 4; i++) {
        projectiles.push({
          x: bossState.x - 20,
          y: GROUND - 80 - i * 18,
          vx: -220 - i * 30,
          vy: Math.sin(i) * 40,
          life: 1.5,
          dmg: base,
          r: 12,
          from: "boss",
          color: "#ef4444",
        });
      }
    } else if (c.kind === "rage") {
      zones.push({
        x: 40,
        y: GROUND - 40,
        w: W - 80,
        h: 50,
        life: 0.55,
        color: "rgba(185,28,28,0.4)",
        alpha: 0.55,
      });
      // 跳起來可躲
      if (player.onGround) hurtPlayer(base + 22, bossState.x);
    }
  }

  function finish(win) {
    if (ended) return;
    ended = true;
    running = false;
    onEnd?.({
      win,
      bossId: boss.id,
      bossName: boss.nameZh,
      hpLeft: player.hp,
      maxHp: player.maxHp,
      bossHpLeft: bossState.hp,
      profileName: profile.name,
      level: profile.level,
    });
  }

  function update(dt) {
    if (ended) return;

    // timers
    player.attackCd = Math.max(0, player.attackCd - dt);
    player.skillCd = Math.max(0, player.skillCd - dt);
    player.dashCd = Math.max(0, player.dashCd - dt);
    player.invuln = Math.max(0, player.invuln - dt);
    player.cursedT = Math.max(0, (player.cursedT || 0) - dt);
    if (player.animT > 0) {
      player.animT -= dt;
      if (player.animT <= 0) player.anim = "idle";
    }
    bossState.flash = Math.max(0, bossState.flash - dt);
    bossState.hitAnimT = Math.max(0, bossState.hitAnimT - dt);
    bossState.bannerT = Math.max(0, (bossState.bannerT || 0) - dt);
    bossState.animClock += dt;

    // 輸入方向（鍵盤 + 觸控）
    let move = 0;
    if (pressed("ArrowLeft", "a") || keys.has("KeyA")) move -= 1;
    if (pressed("ArrowRight", "d") || keys.has("KeyD")) move += 1;
    move += touch.move;
    move = Math.max(-1, Math.min(1, move));

    // 閃避觸發（鍵盤 L/Shift/K閃 或 觸控閃避鈕）
    const dashKey =
      keys.has("KeyL") || keys.has("l") || keys.has("ShiftLeft") || keys.has("ShiftRight");
    if ((dashKey || touch.dashEdge) && player.dashCd <= 0 && player.dashT <= 0) {
      doDash(move);
    }
    touch.dashEdge = false;

    if (player.dashT > 0) {
      // 閃避位移中：鎖定衝刺速度、忽略一般移動；lunge 帶一次判定
      player.dashT -= dt;
      player.vx = player.dashDir * (dashType === "blink" ? 860 : dashType === "backstep" ? 560 : 660);
      if (dashType === "lunge" && !player.dashHitDone) {
        if (Math.abs(player.x - bossState.x) < 90 + bossState.w * 0.25) {
          hurtBoss(Math.round(profile.basicMin * 0.6), false);
          player.dashHitDone = true;
        }
      }
    } else if (move !== 0) {
      player.face = move;
      player.vx = move * profile.moveSpeed;
      if (player.anim === "idle") player.anim = "run";
    } else {
      player.vx *= Math.pow(0.001, dt);
      if (Math.abs(player.vx) < 8) player.vx = 0;
      if (player.anim === "run") player.anim = "idle";
    }

    const jumpPressed =
      pressed("ArrowUp", "w") ||
      keys.has("KeyW") ||
      keys.has("Space") ||
      keys.has(" ") ||
      touch.jump;
    if (jumpPressed && player.onGround) {
      player.vy = -profile.jump;
      player.onGround = false;
    }

    if (pressed("KeyJ", "j") || keys.has("KeyZ") || keys.has("z") || touch.atk) doBasic();
    if (pressed("KeyK", "k") || keys.has("KeyX") || keys.has("x") || touch.skill) doSkill();

    // physics player
    player.vy += GRAVITY * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.x = Math.max(40, Math.min(W - 40, player.x));
    if (player.y >= GROUND) {
      player.y = GROUND;
      player.vy = 0;
      player.onGround = true;
    }

    // boss AI
    if (!bossState.dead) {
      bossState.face = player.x < bossState.x ? -1 : 1;
      if (!bossState.cast) {
        if (bossState.hitAnimT <= 0) setBossAnim("stand");
        bossState.nextAt -= dt;
        if (bossState.nextAt <= 0) {
          startCast(pickBossAttack());
          bossState.nextAt = 1.8 + Math.random() * 1.2 - (bossState.phase - 1) * 0.35;
        }
      } else {
        const c = bossState.cast;
        c.t += dt;
        // telegraph 追瞄（單柱/砸擊）
        if (c.t < c.telegraph && (c.kind === "pillar" || c.kind === "smash")) c.aimX = player.x;
        if (c.t >= c.telegraph) resolveCast(c);
        if (c.t >= c.duration) {
          bossState.cast = null;
          setBossAnim("stand");
        }
      }
    }

    // projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0 || p.x < -40 || p.x > W + 40) {
        projectiles.splice(i, 1);
        continue;
      }
      if (p.from === "player") {
        const dx = p.x - bossState.x;
        const dy = p.y - (bossState.y - bossState.h * 0.45);
        if (Math.hypot(dx, dy) < p.r + 50) {
          hurtBoss(p.dmg, false);
          projectiles.splice(i, 1);
        }
      } else {
        const dx = p.x - player.x;
        const dy = p.y - (player.y - player.h * 0.5);
        if (Math.hypot(dx, dy) < p.r + 18) {
          hurtPlayer(p.dmg, p.x);
          projectiles.splice(i, 1);
        }
      }
    }

    for (let i = zones.length - 1; i >= 0; i--) {
      zones[i].life -= dt;
      if (zones[i].life <= 0) zones.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      floats[i].life -= dt;
      floats[i].y -= 40 * dt;
      if (floats[i].life <= 0) floats.splice(i, 1);
    }
  }

  function drawBackground() {
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1a2744");
    g.addColorStop(0.55, "#2d1f3d");
    g.addColorStop(1, "#3a2818");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // distant pillars
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    for (let i = 0; i < 8; i++) {
      const x = 60 + i * 120;
      ctx.fillRect(x, GROUND - 180 - (i % 3) * 40, 40, 180 + (i % 3) * 40);
    }

    // ground
    ctx.fillStyle = "#3d2a18";
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = "#5a3d22";
    ctx.fillRect(0, GROUND, W, 8);
    ctx.fillStyle = "rgba(196,160,90,0.35)";
    ctx.fillRect(0, GROUND, W, 3);

    // arena name
    ctx.fillStyle = "rgba(255,248,220,0.35)";
    ctx.font = "bold 12px system-ui";
    ctx.fillText(`${boss.regionZh || ""} · ${boss.nameZh}`, 16, 28);
  }

  function drawTelegraph() {
    const c = bossState.cast;
    if (!c || c.t >= c.telegraph) return;
    const warn = 0.35 + 0.35 * Math.sin(c.t * 18);
    ctx.save();
    ctx.globalAlpha = warn;
    ctx.fillStyle = boss.color || "#ef4444";
    if (c.kind === "smash") {
      ctx.fillRect(bossState.x - 110, GROUND - 12, 220, 14);
      ctx.font = "bold 14px system-ui";
      ctx.fillText("▼ 砸擊", bossState.x - 24, GROUND - 20);
    } else if (c.kind === "pillar") {
      ctx.fillRect(c.aimX - 28, GROUND - 200, 56, 200);
      ctx.fillText("炎柱", c.aimX - 14, GROUND - 210);
    } else if (c.kind === "swipe") {
      ctx.fillRect(40, GROUND - 50, W - 80, 20);
      ctx.fillText("▶ 橫掃", W / 2 - 20, GROUND - 58);
    } else if (c.kind === "barrage") {
      ctx.fillText("彈幕！", bossState.x - 30, bossState.y - bossState.h - 10);
    } else if (c.kind === "rage") {
      ctx.fillRect(40, GROUND - 40, W - 80, 40);
      ctx.font = "bold 16px system-ui";
      ctx.fillText("⚠ 全場震地 — 跳！", W / 2 - 70, GROUND - 50);
    } else if (c.kind === "multismash") {
      ctx.font = "bold 15px system-ui";
      ctx.fillText("⚠ 八臂連砸 — 連續閃避！", bossState.x - 80, GROUND - 60);
    } else if (c.kind === "fakepillar") {
      ctx.font = "bold 14px system-ui";
      ctx.fillText("時空落柱 — 找空隙！", c.aimX - 40, GROUND - 210);
      ctx.fillRect(c.aimX - 28, GROUND - 200, 56, 200);
    } else if (c.kind === "beam") {
      const from = bossState.face < 0 ? 0 : bossState.x;
      const w = bossState.face < 0 ? bossState.x + 60 : W - bossState.x;
      ctx.fillRect(from, GROUND - 70, w, 70);
      ctx.font = "bold 16px system-ui";
      ctx.fillText("🐉 龍息 — 跳＋閃！", W / 2 - 60, GROUND - 90);
    } else if (c.kind === "diagbarrage") {
      ctx.fillText("對角彈幕！", bossState.x - 30, bossState.y - bossState.h - 10);
    } else if (c.kind === "tide") {
      ctx.font = "bold 15px system-ui";
      ctx.fillText("🌊 潮汐吸引 — 逆向衝！", bossState.x - 70, GROUND - 90);
    } else if (c.kind === "darkcurse") {
      ctx.fillRect(player.x - 70, GROUND - 120, 140, 120);
      ctx.fillText("詛咒霧 — 閃開！", player.x - 40, GROUND - 130);
    } else if (c.kind === "safeseat") {
      ctx.font = "bold 16px system-ui";
      ctx.fillStyle = "#5eead4";
      ctx.fillText("⚠ 全屏！站上綠色平台！", W / 2 - 90, 110);
    }
    ctx.restore();
  }

  function drawBoss() {
    const bx = bossState.x;
    const by = bossState.y;
    // 選當前動畫：死亡>受擊>施放>待機
    let animName = "stand";
    if (bossState.dead) animName = "die1";
    else if (bossState.hitAnimT > 0 && bossGifs.hit1) animName = "hit1";
    else if (bossState.cast) animName = bossState.animName;
    const gif = bossGifs[animName] || bossGifs.stand;
    ctx.save();
    if (bossState.flash > 0) ctx.globalAlpha = 0.55;
    const frame = gif ? sampleGifFrame(gif, bossState.animClock) : null;
    if (frame) {
      // 依 radius 目標高度縮放（各王原圖尺寸差很多）
      const targetH = 210;
      const sc = Math.min(1.1, targetH / frame.height);
      const iw = frame.width * sc;
      const ih = frame.height * sc;
      ctx.imageSmoothingEnabled = false;
      // 面向玩家：Boss 慣例面左(-1)，玩家在右側就翻轉
      if (bossState.face > 0) {
        ctx.translate(bx, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(frame, -iw / 2, by - ih, iw, ih);
      } else {
        ctx.drawImage(frame, bx - iw / 2, by - ih, iw, ih);
      }
    } else {
      ctx.fillStyle = boss.color || "#ef4444";
      ctx.beginPath();
      ctx.ellipse(bx, by - 70, 70, 90, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // name
    ctx.fillStyle = "#fff8e0";
    ctx.font = "bold 13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(boss.nameZh, bx, by - bossState.h - 28);
    ctx.textAlign = "left";
  }

  function drawPlayer() {
    const px = player.x;
    const py = player.y;
    ctx.save();
    if (player.invuln > 0 && Math.floor(player.invuln * 20) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }
    // body
    const body = profile.family === "mage" ? "#60a5fa" : profile.family === "thief" ? "#a78bfa" : profile.family === "archer" ? "#4ade80" : profile.family === "pirate" ? "#fbbf24" : "#f87171";
    ctx.fillStyle = "#2a1f14";
    ctx.fillRect(px - player.w / 2 - 1, py - player.h - 1, player.w + 2, player.h + 2);
    ctx.fillStyle = body;
    ctx.fillRect(px - player.w / 2, py - player.h, player.w, player.h);
    // head
    ctx.fillStyle = "#f0c8a0";
    ctx.fillRect(px - 10, py - player.h - 16, 20, 16);
    // face dir
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(px + player.face * 4 - 2, py - player.h - 10, 4, 4);
    // weapon slash
    if (player.anim === "atk" || player.anim === "skill") {
      ctx.strokeStyle = player.anim === "skill" ? "#c084fc" : "#fde68a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py - player.h * 0.45, profile.style === "melee" ? 40 : 18, -0.8 * player.face, 0.8 * player.face);
      ctx.stroke();
    }
    ctx.restore();

    // name
    ctx.fillStyle = "#fff8e0";
    ctx.font = "bold 11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(profile.name, px, py - player.h - 22);
    ctx.textAlign = "left";
  }

  function drawHud() {
    // 官方底部狀態列(HP=真實血量 / MP=技能就緒 / EXP=Boss擊破進度 / 技能格)
    const skCdMax = profile.skillCd || 3, atkCdMax = profile.attackCd || 0.5;
    drawOfficialHud(ctx, W, H, {
      level: profile.level,
      hp: player.hp, hpMax: player.maxHp,
      mp: Math.max(0, 1 - player.skillCd / skCdMax) * 100, mpMax: 100,
      expPct: 1 - bossState.hp / bossState.maxHp,
      skills: [
        { key: "J", cd: player.attackCd, cdMax: atkCdMax },
        { key: "K", cd: player.skillCd, cdMax: skCdMax },
      ],
    });

    // boss HP top
    const bW = 520;
    const bx = (W - bW) / 2;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(bx - 4, 36, bW + 8, 34);
    ctx.fillStyle = "#450a0a";
    ctx.fillRect(bx, 48, bW, 14);
    const col = boss.color || "#ef4444";
    ctx.fillStyle = col;
    ctx.fillRect(bx, 48, bW * (bossState.hp / bossState.maxHp), 14);
    ctx.fillStyle = "#fff8e0";
    ctx.font = "bold 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(
      `${boss.nameZh} · ${boss.tier || ""} · P${bossState.phase} · ${Math.ceil(bossState.hp)}/${bossState.maxHp}`,
      W / 2,
      44
    );
    ctx.textAlign = "left";

    // 閃避 CD 指示（左下 HP 條右側小圖示）
    const dashReady = player.dashCd <= 0;
    ctx.fillStyle = dashReady ? "rgba(94,234,212,0.9)" : "rgba(120,120,120,0.55)";
    ctx.font = "bold 11px system-ui";
    ctx.fillText(
      dashReady ? "⚡ 閃避 就緒 (L/Shift)" : `閃避 ${player.dashCd.toFixed(1)}s`,
      250,
      H - 30
    );

    // 操作提示（無觸控時顯示鍵位）
    if (!touchMode) {
      ctx.fillStyle = "rgba(255,248,220,0.6)";
      ctx.font = "10px system-ui";
      ctx.fillText("←→移動 · Space跳 · J普攻 · K技能 · L/Shift閃避", 250, H - 44);
    }
  }

  function drawTouchControls() {
    if (!touchMode) return;
    const held = new Set(pointerBtn.values());
    for (const b of TOUCH_BTNS) {
      const on = held.has(b.key);
      const dashLocked = b.key === "dash" && player.dashCd > 0;
      ctx.save();
      ctx.globalAlpha = 0.32;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = on ? "#fde68a" : dashLocked ? "#555" : "#e2e8f0";
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.stroke();
      ctx.fillStyle = on ? "#1a1a1a" : "#2a2a2a";
      ctx.font = `bold ${Math.round(b.r * 0.7)}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.label, b.x, b.y + 1);
      ctx.restore();
    }
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
  }

  function draw() {
    drawBackground();
    drawTelegraph();
    for (const z of zones) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, z.life * 2) * (z.alpha || 0.5);
      ctx.fillStyle = z.color;
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.restore();
    }
    drawBoss();
    drawPlayer();
    for (const p of projectiles) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const f of floats) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.fillStyle = f.color;
      ctx.font = "bold 16px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
    drawHud();
    drawTouchControls();

    // 階段轉換橫幅
    if (bossState.bannerT > 0) {
      const a = Math.min(1, bossState.bannerT * 1.4);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(20,10,10,0.8)";
      ctx.fillRect(W / 2 - 200, 120, 400, 46);
      ctx.strokeStyle = boss.color || "#ef4444";
      ctx.lineWidth = 2;
      ctx.strokeRect(W / 2 - 200, 120, 400, 46);
      ctx.fillStyle = "#fecdd3";
      ctx.font = "bold 20px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(bossState.bannerText || "", W / 2, 150);
      ctx.textAlign = "left";
      ctx.restore();
    }

    if (ended) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    running = true;
    ended = false;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop(silent) {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("pointerleave", onPointerUp);
    if (!silent && !ended) {
      // force cleanup without result
    }
  }

  return { start, stop, canvas };
}
