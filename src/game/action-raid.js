/**
 * M3 動作突襲 v1 — 橫向站場
 * 操作：←→/AD 移動 · Space/W 跳 · J/Z 普攻 · K/X 技能 · L/Shift 閃避(i-frame) · Esc 退出
 * 手機：canvas 觸控四鍵（方向/跳/攻/技/閃）
 */

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
    cast: null, // { kind, t, duration, telegraph, hit }
    nextAt: 1.2,
    flash: 0,
    dead: false,
  };

  /** @type {Array<{x:number,y:number,vx:number,vy:number,life:number,dmg:number,r:number,from:string,color:string}>} */
  const projectiles = [];
  /** @type {Array<{x:number,y:number,life:number,text:string,color:string}>} */
  const floats = [];
  /** @type {Array<{x:number,y:number,w:number,h:number,life:number,color:string,alpha:number}>} */
  const zones = [];

  let bossImg = null;
  if (boss.sprite) {
    bossImg = new Image();
    bossImg.src = boss.sprite;
  }

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
    floatText(
      bossState.x + (Math.random() * 40 - 20),
      bossState.y - bossState.h + 20,
      crit ? `${reduced}!` : `${reduced}`,
      crit ? "#fbbf24" : "#fff"
    );
    const ratio = bossState.hp / bossState.maxHp;
    if (ratio <= 0.15) bossState.phase = 3;
    else if (ratio <= 0.45) bossState.phase = 2;
    else bossState.phase = 1;
    if (bossState.hp <= 0) {
      bossState.dead = true;
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
    const final = crit ? Math.round(dmg * 1.5) : dmg;

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
    const final = crit ? Math.round(dmg * 1.6) : dmg;

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
    const phase = bossState.phase;
    const pool = ["smash", "pillar", "swipe"];
    if (phase >= 2) pool.push("barrage");
    if (phase >= 3) pool.push("rage");
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function startCast(kind) {
    const table = {
      smash: { duration: 1.35, telegraph: 0.9 },
      pillar: { duration: 1.2, telegraph: 0.85 },
      swipe: { duration: 1.1, telegraph: 0.75 },
      barrage: { duration: 1.6, telegraph: 0.5 },
      rage: { duration: 1.8, telegraph: 1.0 },
    };
    const t = table[kind] || table.smash;
    bossState.cast = {
      kind,
      t: 0,
      duration: t.duration * (bossState.phase >= 3 ? 0.85 : 1),
      telegraph: t.telegraph * (bossState.phase >= 3 ? 0.85 : 1),
      hit: false,
      aimX: player.x,
    };
  }

  function resolveCast(c) {
    if (c.hit) return;
    c.hit = true;
    const ph = bossState.phase;
    const base = 18 + ph * 8;

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
    if (player.animT > 0) {
      player.animT -= dt;
      if (player.animT <= 0) player.anim = "idle";
    }
    bossState.flash = Math.max(0, bossState.flash - dt);

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
        bossState.nextAt -= dt;
        if (bossState.nextAt <= 0) {
          startCast(pickBossAttack());
          bossState.nextAt = 1.8 + Math.random() * 1.2 - (bossState.phase - 1) * 0.35;
        }
      } else {
        const c = bossState.cast;
        c.t += dt;
        // telegraph zone preview
        if (c.t < c.telegraph) {
          if (c.kind === "pillar") c.aimX = player.x; // track until fire
        }
        if (c.t >= c.telegraph) resolveCast(c);
        if (c.t >= c.duration) bossState.cast = null;
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
    }
    ctx.restore();
  }

  function drawBoss() {
    const bx = bossState.x;
    const by = bossState.y;
    ctx.save();
    if (bossState.flash > 0) ctx.globalAlpha = 0.55;
    if (bossImg && bossImg.complete && bossImg.naturalWidth) {
      const scale = 0.55;
      const iw = bossImg.naturalWidth * scale;
      const ih = bossImg.naturalHeight * scale;
      ctx.drawImage(bossImg, bx - iw / 2, by - ih, iw, ih);
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
    // player HP
    const pBarW = 220;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(16, H - 52, pBarW + 8, 36);
    ctx.fillStyle = "#7f1d1d";
    ctx.fillRect(20, H - 40, pBarW, 12);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(20, H - 40, pBarW * (player.hp / player.maxHp), 12);
    ctx.fillStyle = "#fff8e0";
    ctx.font = "bold 11px system-ui";
    ctx.fillText(`HP ${Math.ceil(player.hp)} / ${player.maxHp}`, 22, H - 44);
    ctx.fillStyle = "rgba(255,248,220,0.75)";
    ctx.font = "10px system-ui";
    ctx.fillText(
      `J/Z 普攻 · K/X ${profile.skillName} · 技能CD ${player.skillCd.toFixed(1)}s`,
      22,
      H - 18
    );

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
