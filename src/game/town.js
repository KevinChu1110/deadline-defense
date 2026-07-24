/**
 * 可探索城鎮場景（網頁版楓之谷 Hub）。
 * 用解包的真實地圖資料(town.json)：多層視差背景 + 真實 foothold 走跳 + 傳送門/NPC。
 * 物理/紙娃娃複用掛機探險的手感（走/跳/重力 + maplestory.io 動作狀態機）。
 */
import { createAvatar, drawAvatar } from "./avatar.js";
import { drawHud as drawOfficialHud } from "./hud.js";
import { sfx } from "../audio/sfx.js";

const W = 960, H = 540;
const GRAVITY = 2000, WALK = 230, JUMP = 620;

export function createTown(opts) {
  const { canvas, town, appearance, charClass, profile, onPortal, onExit } = opts;
  const ctx = canvas.getContext("2d");
  canvas.width = W; canvas.height = H;

  // 背景圖載入
  const backImgs = town.back.map((b) => { const im = new Image(); im.src = `/town/fm/${b.img}`; return { def: b, img: im }; });
  // 紙娃娃
  const avatar = appearance ? createAvatar(appearance) : null;

  // 出生點：portal pn==="sp" 或第一個
  const sp = town.portals.find((p) => p.n === "sp") || town.portals[0] || { x: 0, y: 0 };
  const player = { x: sp.x, y: sp.y, vx: 0, vy: 0, w: 34, h: 54, face: 1, onGround: false, anim: "idle", animT: 0 };
  // camera 世界中心
  let camCX = player.x, camCY = player.y - 80;

  const keys = new Set();
  let running = true, raf = 0, last = performance.now(), lastDt = 0.016;
  let nearPortal = null;

  // ── foothold：取 px 下方最近可站的 y（水平/斜線；跳過垂直牆）──
  function footAt(px, fromY) {
    let best = null;
    for (const f of town.foothold) {
      if (f.x1 === f.x2) continue; // 垂直牆略過
      const lo = Math.min(f.x1, f.x2), hi = Math.max(f.x1, f.x2);
      if (px < lo || px > hi) continue;
      const t = (px - f.x1) / (f.x2 - f.x1);
      const y = f.y1 + (f.y2 - f.y1) * t;
      if (y >= fromY - 2 && (best === null || y < best)) best = y;
    }
    return best;
  }

  function update(dt) {
    // 輸入
    const left = keys.has("ArrowLeft") || keys.has("KeyA");
    const right = keys.has("ArrowRight") || keys.has("KeyD");
    player.vx = (right ? WALK : 0) - (left ? WALK : 0);
    if (right) player.face = 1; if (left) player.face = -1;
    if ((keys.has("ArrowUp") || keys.has("Space") || keys.has("KeyW")) && player.onGround) {
      player.vy = -JUMP; player.onGround = false; sfx.play("mapleJump");
    }

    // 水平移動 + VR 夾限
    player.x = Math.max(town.vr.left + 20, Math.min(town.vr.right - 20, player.x + player.vx * dt));

    // 垂直：重力 + foothold
    const oldY = player.y;
    player.vy += GRAVITY * dt;
    let ny = player.y + player.vy * dt;
    if (player.vy >= 0) {
      const g = footAt(player.x, oldY);
      if (g !== null && oldY <= g + 1 && ny >= g) { ny = g; player.vy = 0; player.onGround = true; }
      else if (g !== null && Math.abs(ny - g) < 6 && player.onGround) { ny = g; player.vy = 0; }
      else player.onGround = false;
    } else player.onGround = false;
    // 掉出地圖底 → 拉回出生點
    if (ny > town.vr.bottom + 200) { player.x = sp.x; ny = sp.y; player.vy = 0; }
    player.y = ny;

    // 動作
    if (player.animT > 0 && (player.animT -= dt) <= 0) player.anim = "idle";

    // camera 平滑跟隨 + 夾限
    const tx = player.x, ty = player.y - 80;
    camCX += (tx - camCX) * Math.min(1, dt * 8);
    camCY += (ty - camCY) * Math.min(1, dt * 8);
    camCX = Math.max(town.vr.left + W / 2, Math.min(town.vr.right - W / 2, camCX));
    camCY = Math.max(town.vr.top + H / 2, Math.min(town.vr.bottom - H / 2, camCY));

    // 傳送門偵測（pt=1 是一般門）
    nearPortal = null;
    for (const p of town.portals) {
      if (p.t !== 1) continue;
      if (Math.abs(p.x - player.x) < 30 && Math.abs(p.y - player.y) < 60) { nearPortal = p; break; }
    }
    if (nearPortal && (keys.has("ArrowUp") || keys.has("KeyW"))) {
      // P0：先只回報，P1 接副本
      if (onPortal) onPortal(nearPortal);
    }
  }

  function worldToScreen(wx, wy) { return [wx - camCX + W / 2, wy - camCY + H / 2]; }

  function drawBack() {
    for (const { def, img } of backImgs) {
      if (!img.complete || !img.naturalWidth) continue;
      // 視差：距離越遠(|rx|小)移動越少。rx=0 固定於螢幕
      const px = camCX * (def.rx / 100), py = camCY * (def.ry / 100);
      let sx = def.x - def.ox - camCX + W / 2 + px + camCX; // rx=0→隨螢幕(不動);rx=-100→隨世界
      let sy = def.y - def.oy - camCY + H / 2 + py + camCY;
      // 上式化簡：sx = def.x-def.ox + W/2 + camCX*(rx/100)；sy 同理
      sx = def.x - def.ox + W / 2 + camCX * (def.rx / 100);
      sy = def.y - def.oy + H / 2 + camCY * (def.ry / 100);
      ctx.globalAlpha = (def.a ?? 255) / 255;
      const tile = def.type; // 1橫鋪 2直鋪 3全鋪
      const stepX = def.ow + (def.cx || 0), stepY = def.oh + (def.cy || 0);
      const tileX = tile === 1 || tile === 3 || tile === 4 || tile === 6;
      const tileY = tile === 2 || tile === 3 || tile === 5 || tile === 6;
      const x0 = tileX ? sx - Math.ceil((sx + def.ow) / stepX) * stepX : sx;
      const y0 = tileY ? sy - Math.ceil((sy + def.oh) / stepY) * stepY : sy;
      const xEnd = tileX ? W + stepX : sx + 1;
      const yEnd = tileY ? H + stepY : sy + 1;
      for (let yy = y0; yy < yEnd; yy += stepY) {
        for (let xx = x0; xx < xEnd; xx += stepX) {
          ctx.drawImage(img, xx, yy, def.ow, def.oh);
          if (!tileX) break;
        }
        if (!tileY) break;
      }
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // 天空漸層
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#5aa8dd"); sky.addColorStop(0.6, "#93cdea"); sky.addColorStop(1, "#c8e8f5");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    if (!window.__townNoBack) drawBack();

    // foothold 平台（P0 可視化，之後換真 tile 美術）
    ctx.strokeStyle = "rgba(90,60,30,0.9)"; ctx.lineWidth = 5; ctx.lineCap = "round";
    for (const f of town.foothold) {
      if (f.x1 === f.x2) continue;
      const [ax, ay] = worldToScreen(f.x1, f.y1), [bx, by] = worldToScreen(f.x2, f.y2);
      if ((ax < -20 && bx < -20) || (ax > W + 20 && bx > W + 20)) continue;
      ctx.strokeStyle = "rgba(70,45,20,0.85)"; ctx.beginPath(); ctx.moveTo(ax, ay + 2); ctx.lineTo(bx, by + 2); ctx.stroke();
      ctx.strokeStyle = "rgba(120,180,70,0.95)"; ctx.beginPath(); ctx.moveTo(ax, ay - 1); ctx.lineTo(bx, by - 1); ctx.stroke();
    }

    // 傳送門（藍光環）
    for (const p of town.portals) {
      if (p.t !== 1) continue;
      const [sx, sy] = worldToScreen(p.x, p.y);
      if (sx < -40 || sx > W + 40) continue;
      const t = (performance.now() / 400) % (Math.PI * 2);
      ctx.save();
      ctx.globalAlpha = 0.6 + Math.sin(t) * 0.2;
      ctx.strokeStyle = "#5cc8ff"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(sx, sy - 24, 18, 30, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.3; ctx.fillStyle = "#a8e6ff";
      ctx.beginPath(); ctx.ellipse(sx, sy - 24, 14, 26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // NPC（P0：位置標記 + 名牌佔位；P2 換真 sprite）
    for (const n of town.life) {
      if (n.type !== "n" || n.hide) continue;
      const [sx, sy] = worldToScreen(n.x, n.y);
      if (sx < -60 || sx > W + 60) continue;
      ctx.save();
      ctx.fillStyle = "rgba(60,40,20,0.6)"; ctx.fillRect(sx - 18, sy - 40, 36, 40);
      ctx.fillStyle = "#ffe9a8"; ctx.font = "9px system-ui"; ctx.textAlign = "center";
      ctx.fillText("NPC", sx, sy - 44);
      ctx.restore();
    }

    // 玩家紙娃娃
    const [psx, psy] = worldToScreen(player.x, player.y);
    const moving = Math.abs(player.vx) > 10 && player.onGround;
    let anim = "stand1";
    if (!player.onGround) anim = "jump"; else if (moving) anim = "walk1";
    const drawn = avatar && drawAvatar(ctx, avatar, psx, psy + 4, { anim, dt: lastDt, flip: player.face, targetH: 74, maxW: 70 });
    if (!drawn) { ctx.fillStyle = "#f87171"; ctx.fillRect(psx - 10, psy - 44, 20, 44); }
    // 名牌
    ctx.fillStyle = "rgba(0,0,0,0.5)"; const nm = profile?.name || "冒險者";
    ctx.font = "700 11px system-ui"; ctx.textAlign = "center";
    const tw = ctx.measureText(nm).width;
    ctx.fillRect(psx - tw / 2 - 4, psy + 4, tw + 8, 14);
    ctx.fillStyle = "#fff"; ctx.fillText(nm, psx, psy + 15);

    // 傳送門提示
    if (nearPortal) {
      ctx.fillStyle = "#fff"; ctx.font = "bold 13px system-ui"; ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 3;
      const [sx, sy] = worldToScreen(nearPortal.x, nearPortal.y);
      ctx.strokeText("↑ 進入", sx, sy - 60); ctx.fillText("↑ 進入", sx, sy - 60);
    }

    // ── DEBUG：foothold 線 + 座標 ──
    if (window.__townDebug) {
      ctx.strokeStyle = "#ff3355"; ctx.lineWidth = 2;
      for (const f of town.foothold) {
        if (f.x1 === f.x2) continue;
        const [ax, ay] = worldToScreen(f.x1, f.y1), [bx, by] = worldToScreen(f.x2, f.y2);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
      ctx.fillStyle = "#0f0"; ctx.font = "12px monospace"; ctx.textAlign = "left";
      ctx.fillText(`P(${player.x | 0},${player.y | 0}) cam(${camCX | 0},${camCY | 0}) ground=${player.onGround}`, 16, 50);
    }

    // 官方底部 HUD
    drawOfficialHud(ctx, W, H, {
      level: profile?.level, hp: profile?.maxHp || 100, hpMax: profile?.maxHp || 100,
      mp: profile?.maxMp || 60, mpMax: profile?.maxMp || 60, expPct: 0, skills: [],
    });
    // 頂部地圖名
    ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.font = "bold 14px system-ui"; ctx.textAlign = "left";
    ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 3;
    ctx.strokeText(town.name, 16, 28); ctx.fillText(town.name, 16, 28);
  }

  function loop(now) {
    if (!running) return;
    lastDt = Math.min(0.05, (now - last) / 1000); last = now;
    update(lastDt); draw();
    raf = requestAnimationFrame(loop);
  }
  function onKey(e, down) {
    if (down && e.code === "Escape") { if (onExit) onExit(); return; }
    if (down) keys.add(e.code); else keys.delete(e.code);
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space", "KeyA", "KeyD", "KeyW"].includes(e.code)) e.preventDefault();
  }
  const kd = (e) => onKey(e, true), ku = (e) => onKey(e, false);

  return {
    start() { window.addEventListener("keydown", kd); window.addEventListener("keyup", ku); last = performance.now(); raf = requestAnimationFrame(loop); },
    stop() { running = false; cancelAnimationFrame(raf); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); },
  };
}
