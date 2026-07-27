/**
 * WZ 紙娃娃伺服器渲染（route B 階段3）：從 Character.wz 自解合成角色動畫 sprite sheet。
 * 依 appearance 按需合成 + 記憶體快取(hash)。合成邏輯與 tools/wz/gen-sheet.mjs 一致(已驗證)。
 *
 * WZ 檔位置由環境變數 WZ_DIR 指定(需含 Character.wz + Base.wz)。
 */
import wz from "@tybys/wz";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import path from "node:path";
import fs from "node:fs";

const { WzFile, WzMapleVersion } = wz;
const WZ_DIR = process.env.WZ_DIR || path.resolve(process.cwd(), "wz");

// 合成的 stance/frame(town.js 需要的動作)
const STANCES = { stand1: [0, 1, 2], walk1: [0, 1, 2, 3], alert: [0, 1, 2], jump: [0], swingO1: [0, 1, 2] };

let _char = null, _base = null, _zorder = null, _ready = false, _initErr = null;
const _imgCache = new Map();   // dir+id → parsed WzImage
const _sheetCache = new Map(); // appearance hash → manifest

async function init() {
  if (_ready || _initErr) return;
  try {
    const cp = path.join(WZ_DIR, "Character.wz");
    const bp = path.join(WZ_DIR, "Base.wz");
    if (!fs.existsSync(cp)) throw new Error(`Character.wz not found in ${WZ_DIR}`);
    _char = new WzFile(cp, WzMapleVersion.EMS); await _char.parseWzFile();
    _base = new WzFile(bp, WzMapleVersion.EMS); await _base.parseWzFile();
    const zm = [..._base.wzDirectory.wzImages].find((i) => i.name === "zmap.img"); await zm.parseImage();
    _zorder = [...zm.wzProperties].map((p) => p.name);
    _ready = true;
  } catch (e) { _initErr = e; }
}
const zIdx = (z) => { const i = _zorder.indexOf(z); return i < 0 ? 9999 : i; };
const pad = (id) => String(id).padStart(8, "0") + ".img";

async function getImg(dir, id) {
  const k = dir + id; if (_imgCache.has(k)) return _imgCache.get(k);
  let im;
  if (dir === "root") im = [..._char.wzDirectory.wzImages].find((i) => i.name === pad(id));
  else { const d = [..._char.wzDirectory.wzDirectories].find((x) => x.name === dir); im = d && [...d.wzImages].find((i) => i.name === pad(id)); }
  if (im) await im.parseImage();
  _imgCache.set(k, im); return im;
}

async function partsOf(img, stance, frame) {
  if (!img) return [];
  const st = [...img.wzProperties].find((p) => p.name === stance); if (!st) return [];
  let fr = [...st.wzProperties].find((p) => p.name === String(frame)); if (!fr) fr = st;
  const out = [];
  for (let p of fr.wzProperties) {
    if (p.constructor.name === "WzUOLProperty") { try { p = p.wzValue; } catch { /* ignore */ } }
    if (!p || !p.at) continue;
    const o = p.at("origin")?.wzValue; if (!o) continue;
    const z = p.at("z")?.wzValue || p.name;
    const mp = p.at("map"); const map = {};
    if (mp?.wzProperties) for (const m of mp.wzProperties) map[m.name] = { x: m.wzValue.x, y: m.wzValue.y };
    let bmp = null; try { const c = await p.getLinkedWzCanvasBitmap(); if (c) bmp = await c.getBufferAsync("image/png"); } catch { /* ignore */ }
    if (!bmp) continue;
    out.push({ z, origin: { x: o.x, y: o.y }, map, bmp });
  }
  return out;
}

// appearance 槽位 → Character.wz 目錄(head 由 skin+10000 自動衍生)
function slotDirs(app) {
  const skin = app.skin || 2000;
  return [
    ["root", skin, "stand1"], ["root", skin + 10000, "stand1"],
    ["Face", app.face, "default"], ["Hair", app.hair, "stand1"],
    ["Cap", app.cap, "stand1"], ["Coat", app.coat, "stand1"],
    ["Longcoat", app.longcoat, "stand1"], ["Pants", app.pants, "stand1"],
    ["Shoes", app.shoes, "stand1"], ["Glove", app.glove, "stand1"],
    ["Cape", app.cape, "stand1"], ["Weapon", app.weapon, "stand1"],
  ];
}

async function frameCompose(app, stance, frame) {
  const all = [];
  for (const [dir, id, fb] of slotDirs(app)) {
    if (!id) continue;
    const img = await getImg(dir, id);
    let ps = await partsOf(img, stance, frame);
    if (!ps.length && fb !== stance) ps = await partsOf(img, fb === "default" ? "default" : "stand1", 0);
    all.push(...ps);
  }
  const world = { navel: { x: 0, y: 0 } }; const todo = [...all]; const placed = []; let g = 0;
  while (todo.length && g++ < 40) {
    for (let i = 0; i < todo.length; i++) {
      const p = todo[i]; const k = Object.keys(p.map).find((k) => world[k]); if (!k) continue;
      const b = world[k]; p.pos = { x: b.x - (p.origin.x + p.map[k].x), y: b.y - (p.origin.y + p.map[k].y) };
      for (const [an, av] of Object.entries(p.map)) if (!world[an]) world[an] = { x: p.pos.x + p.origin.x + av.x, y: p.pos.y + p.origin.y + av.y };
      placed.push(p); todo.splice(i, 1); i--;
    }
  }
  const imgs = await Promise.all(placed.map((p) => loadImage(p.bmp)));
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  placed.forEach((p, i) => { minX = Math.min(minX, p.pos.x); minY = Math.min(minY, p.pos.y); maxX = Math.max(maxX, p.pos.x + imgs[i].width); maxY = Math.max(maxY, p.pos.y + imgs[i].height); });
  const W = Math.ceil(maxX - minX), H = Math.ceil(maxY - minY);
  const cv = createCanvas(W, H); const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
  placed.map((p, i) => ({ p, img: imgs[i] })).sort((a, b) => zIdx(b.p.z) - zIdx(a.p.z)).forEach(({ p, img }) => ctx.drawImage(img, p.pos.x - minX, p.pos.y - minY));
  return { cv, W, H, nx: -minX, ny: -minY, bottom: maxY };
}

function hashApp(app) {
  return ["skin", "head", "face", "hair", "cap", "coat", "longcoat", "pants", "shoes", "glove", "cape", "weapon"]
    .map((k) => `${k}:${app[k] || 0}`).join(",");
}

/** 依 appearance 合成動畫 sheet → manifest(含內嵌 sheet data URL)。有快取。 */
export async function renderAvatarSheet(app) {
  await init();
  if (_initErr) throw _initErr;
  const key = hashApp(app);
  if (_sheetCache.has(key)) return _sheetCache.get(key);

  const body = await getImg("root", app.skin || 2000);
  const manifest = { anims: {}, groundY: 0, nominalH: 64 };
  const cells = []; let sheetW = 0, sheetH = 0;
  for (const [stance, frs] of Object.entries(STANCES)) {
    manifest.anims[stance] = [];
    for (const fr of frs) {
      const r = await frameCompose(app, stance, fr);
      const st = [...body.wzProperties].find((p) => p.name === stance);
      const frNode = st && [...st.wzProperties].find((p) => p.name === String(fr));
      const delay = frNode?.at?.("delay")?.wzValue || 180;
      cells.push({ r, x: sheetW });
      manifest.anims[stance].push({ x: sheetW, y: 0, w: r.W, h: r.H, nx: r.nx, ny: r.ny, delay });
      sheetW += r.W + 2; sheetH = Math.max(sheetH, r.H);
      if (stance === "stand1" && fr === 0) { manifest.groundY = r.bottom; manifest.nominalH = r.H; }
    }
  }
  const sheet = createCanvas(sheetW, sheetH); const sg = sheet.getContext("2d"); sg.imageSmoothingEnabled = false;
  for (const c of cells) sg.drawImage(c.r.cv, c.x, 0);
  manifest.sheet = "data:image/png;base64," + sheet.toBuffer("image/png").toString("base64");
  _sheetCache.set(key, manifest);
  return manifest;
}

export function avatarRenderReady() { return { ready: _ready, err: _initErr?.message || null, wzDir: WZ_DIR, cached: _sheetCache.size }; }
