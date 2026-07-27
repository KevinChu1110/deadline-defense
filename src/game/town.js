/**
 * 可探索城鎮場景（網頁版楓之谷 Hub）。
 * 用解包的真實地圖資料(town.json)：多層視差背景 + 真實 foothold 走跳 + 傳送門/NPC。
 * 物理/紙娃娃複用掛機探險的手感（走/跳/重力 + maplestory.io 動作狀態機）。
 */
import { createAvatar, drawAvatar } from "./avatar.js";
import { createWzAvatar, drawWzAvatar } from "./avatar-wz.js";
import { drawHud as drawOfficialHud } from "./hud.js";
import { createMapCombat } from "./map-combat.js";
import { sfx } from "../audio/sfx.js";

const W = 960, H = 540;
const GRAVITY = 2000, WALK = 230, JUMP = 620;

export function createTown(opts) {
  const { canvas, town, appearance, charClass, profile, onAct, onNpc, onExit, onPortal } = opts;
  const acts = opts.acts || []; // [{label, act, x, y, color}] 活動傳送門
  const base = opts.assetBase || "/town/fm"; // 資產根目錄(城鎮=/town/fm;世界地圖=/world/<id>)
  const ctx = canvas.getContext("2d");
  canvas.width = W; canvas.height = H;

  // 背景圖載入
  const backImgs = town.back.map((b) => { const im = new Image(); im.src = `${base}/${b.img}`; return { def: b, img: im }; });
  // 地圖物件(tile 平台 + obj 裝飾)圖快取（key 對應檔）
  const objImgCache = new Map();
  function objImgKey(kind, key) {
    if (objImgCache.has(key)) return objImgCache.get(key);
    const im = new Image(); im.src = `${base}/${kind}/${key}.png`; objImgCache.set(key, im); return im;
  }
  // NPC 真 sprite（已在地化到 /town/fm/npc/*.gif，避免每次進城打外部 maplestory.io）
  const npcImgCache = new Map();
  function npcImg(id) {
    if (npcImgCache.has(id)) return npcImgCache.get(id);
    const im = new Image();
    im.src = `/town/fm/npc/${id}.gif`;
    // 本地缺圖 → 退回官方 API（極少數 NPC）
    im.onerror = () => { im.onerror = null; im.crossOrigin = "anonymous"; im.src = `https://maplestory.io/api/GMS/214/npc/${id}/render/stand`; };
    npcImgCache.set(id, im); return im;
  }
  // 紙娃娃
  // WZ 紙娃娃(route B):wzBase 有值就載;maplestory 一律建當「WZ 未就緒/載入失敗」的後備
  const wzAvatar = opts.wzBase ? createWzAvatar(opts.wzBase) : null;
  const avatar = appearance ? createAvatar(appearance) : null;

  // 出生點：指定入口 portal(跨圖 warp 用) > "sp" > 第一個
  const entry = opts.entryPortal ? town.portals.find((p) => p.n === opts.entryPortal) : null;
  const sp = entry || town.portals.find((p) => p.n === "sp") || town.portals[0] || { x: 0, y: 0 };
  // 可 warp 的真實地圖門(pt=2 且有目標圖)
  const warpPortals = (town.portals || []).filter((p) => p.t === 2 && p.tm && p.tm !== 999999999);
  const player = { x: sp.x, y: sp.y, vx: 0, vy: 0, w: 34, h: 54, face: 1, onGround: false, anim: "idle", animT: 0 };
  // camera 世界中心
  let camCX = player.x, camCY = player.y - 80;

  // ── 戰鬥層：野外圖(life 有怪)才啟用 ──
  const hasMobs = (town.life || []).some((l) => l.type === "m");
  if (hasMobs) {
    player.hp = profile?.maxHp || 300; player.maxHp = profile?.maxHp || 300; player.invuln = 0;
    player.exp = 0; player.level = profile?.level || 1; player.atk = profile?.atk || 45; player.coins = 0;
    player.atkCd = 0; player.attackT = 0;
  }
  const combat = hasMobs ? createMapCombat({ town, footAt, player, profile }) : null;
  let attackHeld = false, bagOpen = false;

  const keys = new Set();
  // ── 按鍵配置（設定→localStorage 傳入 opts.keys；MapleStory 預設 Ctrl 攻擊 / 空白跳）──
  // 移動固定用方向鍵(楓之谷慣例)；跳/攻擊可自訂；Left/Right 修飾鍵成對觸發
  const KB = opts.keys || {};
  const pairCode = (c) => !c ? [] : c.endsWith("Left") ? [c, c.slice(0, -4) + "Right"]
    : c.endsWith("Right") ? [c, c.slice(0, -5) + "Left"] : [c];
  const jumpCodes = new Set(pairCode(KB.jump || "Space"));
  const attackCodes = new Set(pairCode(KB.attack || "ControlLeft"));
  const anyKey = (set) => { for (const c of set) if (keys.has(c)) return true; return false; };
  // 手機虛擬按鍵
  const isTouch = (typeof window !== "undefined") && (("ontouchstart" in window) || (navigator.maxTouchPoints > 0) || window.matchMedia?.("(pointer: coarse)").matches);
  const touch = new Set();
  const touchBtns = [
    { id: "left", x: 24, y: H - 118, w: 74, h: 74, label: "◀" },
    { id: "right", x: 108, y: H - 118, w: 74, h: 74, label: "▶" },
    { id: "up", x: W - 190, y: H - 118, w: 74, h: 74, label: "↑" },
    { id: "jump", x: W - 100, y: H - 118, w: 74, h: 74, label: "⤴" },
    ...(hasMobs ? [{ id: "attack", x: W - 100, y: H - 200, w: 74, h: 74, label: "⚔" }, { id: "bag", x: W - 184, y: H - 200, w: 62, h: 62, label: "🎒" }] : []),
  ];
  let running = true, paused = false, raf = 0, last = performance.now(), lastDt = 0.016;
  let nearInteract = null, nearType = null, upHeld = false;

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
    if (paused) { player.vx = 0; return; } // 對話中暫停操作
    // 輸入（鍵盤 + 手機虛擬鍵）
    const left = keys.has("ArrowLeft") || keys.has("KeyA") || touch.has("left");
    const right = keys.has("ArrowRight") || keys.has("KeyD") || touch.has("right");
    player.vx = (right ? WALK : 0) - (left ? WALK : 0);
    if (right) player.face = 1; if (left) player.face = -1;
    if ((anyKey(jumpCodes) || touch.has("jump")) && player.onGround) {
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

    // ── 戰鬥：攻擊 / 怪 AI / 受傷死亡 ──
    if (combat) {
      if (player.atkCd > 0) player.atkCd -= dt;
      if (player.attackT > 0) player.attackT -= dt;
      const atkDown = anyKey(attackCodes) || touch.has("attack");
      let attackPressed = false;
      if (atkDown && !attackHeld && player.atkCd <= 0) { attackPressed = true; player.atkCd = 0.42; player.attackT = 0.3; }
      attackHeld = atkDown;
      if (player.invuln > 0) player.invuln -= dt;
      combat.update(dt, attackPressed);
      if (player.hp <= 0) { player.hp = player.maxHp; player.x = sp.x; player.y = sp.y; player.vy = 0; player.invuln = 1.5; } // 死亡→回出生點
    }

    // camera 平滑跟隨 + 夾限
    const tx = player.x, ty = player.y - 80;
    camCX += (tx - camCX) * Math.min(1, dt * 8);
    camCY += (ty - camCY) * Math.min(1, dt * 8);
    camCX = Math.max(town.vr.left + W / 2, Math.min(town.vr.right - W / 2, camCX));
    camCY = Math.max(town.vr.top + H / 2, Math.min(town.vr.bottom - H / 2, camCY));

    // 最近可互動：NPC 對話 / 活動傳送門
    nearInteract = null; nearType = null; let bestD = 1e9;
    for (const n of town.life) {
      if (n.type !== "n" || n.hide) continue;
      const d = Math.abs(n.x - player.x);
      if (d < 45 && Math.abs(n.y - player.y) < 80 && d < bestD) { bestD = d; nearInteract = n; nearType = "npc"; }
    }
    for (const a of acts) {
      const d = Math.abs(a.x - player.x);
      if (d < 55 && Math.abs(a.y - player.y) < 80 && d < bestD) { bestD = d; nearInteract = a; nearType = "act"; }
    }
    for (const p of warpPortals) {
      const d = Math.abs(p.x - player.x);
      if (d < 45 && Math.abs(p.y - player.y) < 70 && d < bestD) { bestD = d; nearInteract = p; nearType = "portal"; }
    }
    // 邊緣觸發：按下↑瞬間才互動
    const up = keys.has("ArrowUp") || touch.has("up");
    if (nearInteract && up && !upHeld) {
      if (nearType === "npc" && onNpc) onNpc(nearInteract);
      else if (nearType === "act" && onAct) onAct(nearInteract);
      else if (nearType === "portal" && onPortal) onPortal(nearInteract);
    }
    upHeld = up;
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

    // 地圖真物件（tile 平台 + obj 蘑菇屋/招牌/梯子/自然/動畫大魚旗子），世界座標 + z 排序。
    // 最前 obj 層(FRONT_LAYER)延後到實體之後畫,做出「走到草叢/裝飾後方」的景深；
    // tile 一律在實體之前(下方),絕不會蓋到站在地板上的玩家腳。
    ctx.imageSmoothingEnabled = false;
    const tms = performance.now();
    const FRONT_LAYER = 5;
    const frontObjs = [];
    const drawObject = (o) => {
      let key = o.key, ow = o.ow, oh = o.oh;
      if (o.frames) {
        const tot = o._tot || (o._tot = o.frames.reduce((s, f) => s + f.delay, 0)) || 1;
        let t = tms % tot, idx = 0;
        for (let i = 0; i < o.frames.length; i++) { if (t < o.frames[i].delay) { idx = i; break; } t -= o.frames[i].delay; }
        const fr = o.frames[idx]; key = fr.key; ow = fr.w; oh = fr.h;
      }
      const im = objImgKey(o.kind, key);
      if (!im.complete || !im.naturalWidth) return;
      const [sx, sy] = worldToScreen(o.x, o.y);
      if (sx - o.ox > W + 60 || sx - o.ox + ow < -60) return; // 水平裁切
      if (o.f) { ctx.save(); ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.drawImage(im, -(ow - o.ox), sy - o.oy, ow, oh); ctx.restore(); }
      else ctx.drawImage(im, sx - o.ox, sy - o.oy, ow, oh);
    };
    for (const o of town.objects || []) {
      if (o.kind === "obj" && Math.floor(o.z / 100000) >= FRONT_LAYER) { frontObjs.push(o); continue; }
      drawObject(o);
    }

    // 活動傳送門（藍光環 + 招牌標籤）
    const tt = performance.now() / 400;
    for (const a of acts) {
      const [sx, sy] = worldToScreen(a.x, a.y);
      if (sx < -60 || sx > W + 60) continue;
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(tt + a.x) * 0.2;
      ctx.strokeStyle = a.color || "#5cc8ff"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(sx, sy - 26, 20, 34, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.28; ctx.fillStyle = a.color || "#a8e6ff";
      ctx.beginPath(); ctx.ellipse(sx, sy - 26, 16, 30, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // 招牌
      ctx.font = "700 12px system-ui"; ctx.textAlign = "center";
      const tw = ctx.measureText(a.label).width;
      ctx.fillStyle = "rgba(50,32,16,0.85)"; ctx.fillRect(sx - tw / 2 - 8, sy - 82, tw + 16, 20);
      ctx.fillStyle = a.color || "#ffe9a8"; ctx.fillRect(sx - tw / 2 - 8, sy - 82, tw + 16, 3);
      ctx.fillStyle = "#fff4d8"; ctx.fillText(a.label, sx, sy - 68);
    }

    // 真實地圖傳送門（經典藍色光柱）
    for (const p of warpPortals) {
      const [sx, sy] = worldToScreen(p.x, p.y);
      if (sx < -50 || sx > W + 50) continue;
      const puls = 0.5 + Math.sin(tt * 1.6 + p.x) * 0.25;
      ctx.save();
      const grad = ctx.createLinearGradient(sx, sy - 60, sx, sy);
      grad.addColorStop(0, `rgba(150,220,255,0)`); grad.addColorStop(1, `rgba(120,200,255,${0.45 * puls})`);
      ctx.fillStyle = grad; ctx.fillRect(sx - 16, sy - 60, 32, 60);
      ctx.globalAlpha = puls; ctx.strokeStyle = "#bfe8ff"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(sx, sy - 8, 16, 7, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // ── 實體(NPC + 玩家)：依「腳底螢幕 y」景深排序,越靠下(近鏡頭)越後畫→蓋住較遠的 ──
    const drawNpc = (n) => {
      const [sx, sy] = worldToScreen(n.x, n.y);
      if (sx < -80 || sx > W + 80) return;
      const im = npcImg(n.id);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (im.complete && im.naturalWidth) {
        const sc = Math.min(1.4, 72 / im.height);
        const w = im.width * sc, h = im.height * sc;
        if (n.f) { ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.drawImage(im, -w / 2, sy - h, w, h); }
        else ctx.drawImage(im, sx - w / 2, sy - h, w, h);
      } else { ctx.fillStyle = "rgba(60,40,20,0.4)"; ctx.fillRect(sx - 14, sy - 40, 28, 40); }
      ctx.restore();
      // 名牌（P1.5 換真名）
      const nm = n.name || "NPC";
      ctx.font = "700 10px system-ui"; ctx.textAlign = "center";
      const tw = ctx.measureText(nm).width;
      ctx.fillStyle = "rgba(255,235,150,0.9)"; ctx.fillRect(sx - tw / 2 - 4, sy + 2, tw + 8, 13);
      ctx.fillStyle = "#5a3d10"; ctx.fillText(nm, sx, sy + 12);
    };
    const drawPlayerDoll = () => {
      const [psx, psy] = worldToScreen(player.x, player.y);
      const moving = Math.abs(player.vx) > 10 && player.onGround;
      let anim = "stand1";
      if (player.attackT > 0) anim = "swingO1"; else if (!player.onGround) anim = "jump"; else if (moving) anim = "walk1";
      if (player.invuln > 0 && Math.floor(player.invuln * 20) % 2) ctx.globalAlpha = 0.5; // 受傷閃爍
      const dollOpts = { anim, dt: lastDt, flip: player.face, targetH: 74, maxW: 70 };
      // WZ 就緒→用 WZ;否則(載入中/失敗)退回 maplestory,永不變紅方塊
      const drawn = (wzAvatar && wzAvatar.ready)
        ? drawWzAvatar(ctx, wzAvatar, psx, psy + 4, dollOpts)
        : (avatar && drawAvatar(ctx, avatar, psx, psy + 4, dollOpts));
      ctx.globalAlpha = 1;
      if (!drawn) { ctx.fillStyle = "#f87171"; ctx.fillRect(psx - 10, psy - 44, 20, 44); }
      // 名牌
      ctx.fillStyle = "rgba(0,0,0,0.5)"; const nm = profile?.name || "冒險者";
      ctx.font = "700 11px system-ui"; ctx.textAlign = "center";
      const tw = ctx.measureText(nm).width;
      ctx.fillRect(psx - tw / 2 - 4, psy + 4, tw + 8, 14);
      ctx.fillStyle = "#fff"; ctx.fillText(nm, psx, psy + 15);
    };
    const entities = [];
    for (const n of town.life) {
      if (n.type !== "n" || n.hide) continue;
      entities.push({ y: worldToScreen(n.x, n.y)[1], draw: () => drawNpc(n) });
    }
    if (combat) for (const m of combat.aliveMobs()) entities.push({ y: worldToScreen(m.x, m.y)[1], draw: () => combat.drawMob(ctx, m, worldToScreen, W) });
    entities.push({ y: worldToScreen(player.x, player.y)[1], draw: drawPlayerDoll });
    entities.sort((a, b) => a.y - b.y); // 腳底越高(遠)越先畫
    for (const e of entities) e.draw();

    // 前景層 obj(最上層草叢/裝飾)：畫在實體之後 → 玩家可走到其後方
    for (const o of frontObjs) drawObject(o);
    // 楓幣/道具掉落 + 傷害/EXP 跳字(疊最上)
    if (combat) { combat.drawItems(ctx, worldToScreen); combat.drawCoins(ctx, worldToScreen); combat.drawFloats(ctx, worldToScreen); }

    // 互動提示
    if (nearInteract) {
      const txt = nearType === "npc" ? "↑/點 對話" : nearType === "portal" ? "↑/點 前往" : "↑/點 進入";
      const [sx, sy] = worldToScreen(nearInteract.x, nearInteract.y);
      ctx.fillStyle = "#fff"; ctx.font = "bold 13px system-ui"; ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 3;
      const yy = nearType === "npc" ? sy - 78 : sy - 60;
      ctx.strokeText(txt, sx, yy); ctx.fillText(txt, sx, yy);
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
      level: combat ? player.level : profile?.level,
      hp: combat ? Math.max(0, Math.round(player.hp)) : (profile?.maxHp || 100), hpMax: player.maxHp || profile?.maxHp || 100,
      mp: profile?.maxMp || 60, mpMax: profile?.maxMp || 60, expPct: combat ? combat.expPct() : 0, skills: [],
    });
    // 楓幣 + 擊殺 + 戰利品計數(戰鬥圖,右上)
    if (combat) {
      ctx.textAlign = "right"; ctx.font = "700 14px system-ui";
      const txt = `⚔️ ${combat.totalKills()}   🪙 ${player.coins}   🎒 ${combat.lootCount()}`;
      const tw = ctx.measureText(txt).width;
      ctx.fillStyle = "rgba(20,16,8,0.6)"; ctx.fillRect(W - tw - 22, 12, tw + 14, 24);
      ctx.fillStyle = "#ffe14d"; ctx.fillText(txt, W - 12, 29);
      ctx.textAlign = "left";
    }
    // 戰利品袋面板(B 開)
    if (combat && bagOpen) drawBag();
    // 手機虛擬按鍵
    if (isTouch) {
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (const b of touchBtns) {
        const on = touch.has(b.id);
        ctx.globalAlpha = on ? 0.55 : 0.3;
        ctx.fillStyle = "#1a1208"; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 14); ctx.fill();
        ctx.globalAlpha = on ? 1 : 0.75;
        ctx.strokeStyle = "#ffe9a8"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "#ffe9a8"; ctx.font = "26px system-ui"; ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 2);
      }
      ctx.globalAlpha = 1;
    }

    drawMinimap();
  }

  // ── 戰利品袋面板（B 開）：本回合撿到的道具圖示+名稱+數量 ──
  function drawBag() {
    const loot = combat.getLoot();
    const pw = 300, rowH = 34, headH = 40, ph = Math.min(H - 80, headH + Math.max(1, loot.length) * rowH + 14);
    const px = (W - pw) / 2, py = (H - ph) / 2;
    ctx.save();
    ctx.fillStyle = "rgba(30,22,12,0.94)"; ctx.strokeStyle = "#ffe9a8"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffe9a8"; ctx.font = "700 16px system-ui"; ctx.textAlign = "left";
    ctx.fillText("🎒 本回合戰利品", px + 16, py + 26);
    ctx.font = "11px system-ui"; ctx.fillStyle = "rgba(255,233,168,0.7)"; ctx.textAlign = "right";
    ctx.fillText("B 關閉", px + pw - 14, py + 24);
    ctx.textAlign = "left";
    if (!loot.length) {
      ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "13px system-ui";
      ctx.fillText("還沒撿到東西，去打怪吧！", px + 20, py + headH + 20);
    } else {
      loot.forEach((l, i) => {
        const ry = py + headH + i * rowH;
        ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)";
        ctx.fillRect(px + 8, ry, pw - 16, rowH - 4);
        const im = combat.itemImg(l.itemId);
        if (im.complete && im.naturalWidth) { const s = 26, h = im.height * (s / im.width); ctx.drawImage(im, px + 16, ry + (rowH - 4 - h) / 2, s, h); }
        ctx.fillStyle = "#fff"; ctx.font = "13px system-ui"; ctx.textAlign = "left";
        ctx.fillText(l.name, px + 52, ry + 20);
        ctx.fillStyle = "#ffe14d"; ctx.textAlign = "right"; ctx.font = "700 13px system-ui";
        ctx.fillText("×" + l.count, px + pw - 18, ry + 20);
        ctx.textAlign = "left";
      });
    }
    ctx.restore();
  }

  // ── 小地圖（左上，foothold 折線 + 玩家/NPC/傳送門點）──
  function drawMinimap() {
    const mw = 168, mh = 108, mx = 12, my = 12, pad = 8;
    const wx0 = town.vr.left, wy0 = town.vr.top;
    const ww = town.vr.right - town.vr.left, wh = town.vr.bottom - town.vr.top;
    const sc = Math.min((mw - pad * 2) / ww, (mh - pad * 2) / wh);
    const ox = mx + pad + ((mw - pad * 2) - ww * sc) / 2, oy = my + pad;
    const mp = (wx, wy) => [ox + (wx - wx0) * sc, oy + (wy - wy0) * sc];
    ctx.save();
    // 框
    ctx.fillStyle = "rgba(20,30,50,0.72)"; ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1;
    ctx.fillRect(mx, my, mw, mh); ctx.strokeRect(mx, my, mw, mh);
    ctx.fillStyle = "#fff"; ctx.font = "9px system-ui"; ctx.textAlign = "left";
    ctx.fillText("小地圖 · " + town.name, mx + 5, my + 11);
    // foothold
    ctx.strokeStyle = "rgba(160,220,120,0.8)"; ctx.lineWidth = 1;
    for (const f of town.foothold) {
      if (f.x1 === f.x2) continue;
      const [ax, ay] = mp(f.x1, f.y1), [bx, by] = mp(f.x2, f.y2);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    // 活動傳送門(彩點) / NPC(橘點)
    for (const a of acts) { const [x, y] = mp(a.x, a.y); ctx.fillStyle = a.color || "#5cf"; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill(); }
    for (const n of town.life) { if (n.type !== "n" || n.hide) continue; const [x, y] = mp(n.x, n.y); ctx.fillStyle = "#ffb84d"; ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill(); }
    // 玩家(黃點閃)
    const [px, py] = mp(player.x, player.y);
    ctx.fillStyle = (performance.now() % 700 < 400) ? "#ffe14d" : "#fff";
    ctx.beginPath(); ctx.arc(px, py, 3, 0, 7); ctx.fill();
    ctx.strokeStyle = "#000"; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.restore();
  }

  function loop(now) {
    if (!running) return;
    lastDt = Math.min(0.05, (now - last) / 1000); last = now;
    update(lastDt); draw();
    raf = requestAnimationFrame(loop);
  }
  function onKey(e, down) {
    if (paused) { keys.clear(); return; } // 對話中不吃操作(Esc 也不離開)
    if (down && e.code === "Escape") { if (combat && bagOpen) { bagOpen = false; return; } if (onExit) onExit(); return; }
    if (down && e.code === "KeyB" && combat) { bagOpen = !bagOpen; e.preventDefault(); return; }
    if (down) keys.add(e.code); else keys.delete(e.code);
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyB"].includes(e.code)
      || jumpCodes.has(e.code) || attackCodes.has(e.code)) e.preventDefault();
  }
  const kd = (e) => onKey(e, true), ku = (e) => onKey(e, false);

  // 手機觸控：canvas 座標對應
  const activePointers = new Map(); // pointerId → btnId
  function canvasXY(e) {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)];
  }
  function btnAt(cx, cy) {
    for (const b of touchBtns) if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) return b.id;
    return null;
  }
  function refreshTouch() { touch.clear(); for (const id of activePointers.values()) if (id) touch.add(id); }
  function pDown(e) {
    if (paused || !isTouch) return;
    const [cx, cy] = canvasXY(e); const id = btnAt(cx, cy);
    if (id === "bag") { e.preventDefault(); bagOpen = !bagOpen; return; } // 切換,非長按
    if (id) { e.preventDefault(); activePointers.set(e.pointerId, id); refreshTouch(); }
  }
  function pMove(e) { if (!activePointers.has(e.pointerId)) return; const [cx, cy] = canvasXY(e); activePointers.set(e.pointerId, btnAt(cx, cy)); refreshTouch(); }
  function pUp(e) { if (activePointers.delete(e.pointerId)) refreshTouch(); }
  // 點擊互動：點到 NPC / 活動門 / 傳送門就觸發(桌機滑鼠 + 手機點按,不用一定按↑)
  function onClick(e) {
    if (paused) return;
    const [cx, cy] = canvasXY(e);
    if (isTouch && btnAt(cx, cy)) return; // 別把搖桿點按當互動
    const wx = cx - W / 2 + camCX, wy = cy - H / 2 + camCY;
    const near = (ox, oy, rx, ry) => Math.abs(wx - ox) < rx && (wy - oy) < 20 && (oy - wy) < ry;
    for (const n of town.life) { if (n.type !== "n" || n.hide) continue; if (near(n.x, n.y, 42, 90) && onNpc) return onNpc(n); }
    for (const a of acts) { if (near(a.x, a.y, 48, 100) && onAct) return onAct(a); }
    for (const p of warpPortals) { if (near(p.x, p.y, 42, 80) && onPortal) return onPortal(p); }
  }

  // ── 資產預載入：進場前把 tile/obj/背景/NPC 圖 decode 完，消除逐張 pop-in ──
  // 用 Set 去重（多物件共用同張圖），每張圖只算一次；4 秒硬上限保證絕不卡住進場。
  function preload(onProgress) {
    const imgs = new Set();
    for (const { img } of backImgs) imgs.add(img);
    for (const o of town.objects || []) {
      if (o.frames) for (const fr of o.frames) imgs.add(objImgKey(o.kind, fr.key));
      else imgs.add(objImgKey(o.kind, o.key));
    }
    for (const n of town.life || []) if (n.type === "n" && !n.hide) imgs.add(npcImg(n.id));
    const list = [...imgs]; const total = list.length; let done = 0;
    if (!total) { onProgress?.(1); return Promise.resolve(); }
    return new Promise((resolve) => {
      let finished = false;
      const finish = () => { if (finished) return; finished = true; onProgress?.(1); resolve(); };
      const tick = () => { done++; onProgress?.(done / total); if (done >= total) finish(); };
      for (const im of list) {
        if (im.complete) { tick(); continue; }
        let settled = false;
        const one = () => { if (settled) return; settled = true; tick(); };
        im.addEventListener("load", one, { once: true });
        im.addEventListener("error", one, { once: true });
      }
      setTimeout(finish, 4000); // 保險：任何 edge case 逾時直接進場
    });
  }

  return {
    preload,
    // 戰鬥圖的擊殺記錄(給 main.js 回報 bot 權威結算)
    getCombatKills: () => (combat ? combat.getKills() : null),
    start() {
      window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
      canvas.addEventListener("pointerdown", pDown); canvas.addEventListener("pointermove", pMove);
      window.addEventListener("pointerup", pUp); window.addEventListener("pointercancel", pUp);
      canvas.addEventListener("click", onClick);
      last = performance.now(); raf = requestAnimationFrame(loop);
    },
    stop() {
      running = false; cancelAnimationFrame(raf);
      window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku);
      canvas.removeEventListener("pointerdown", pDown); canvas.removeEventListener("pointermove", pMove);
      window.removeEventListener("pointerup", pUp); window.removeEventListener("pointercancel", pUp);
      canvas.removeEventListener("click", onClick);
    },
    pause() { paused = true; keys.clear(); touch.clear(); activePointers.clear(); upHeld = true; },
    resume() { paused = false; upHeld = true; },
  };
}
