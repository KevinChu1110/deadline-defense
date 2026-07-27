/**
 * 從 UI.wz 解包城鎮用 UI 素材 → public/ui/
 * 目標：StatusBar / 聊天列 / 快捷鍵小圖示 / 基礎按鈕，讓自由市場更像原版。
 *
 * 用法（在 deadline-defense 根目錄）：
 *   node tools/wz/extract-ui-town.mjs
 */
import wz from "@tybys/wz";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { WzFile, WzMapleVersion } = wz;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const UI_WZ = process.env.UI_WZ || path.join(ROOT, "wz-data/wztms113/UI.wz");
const OUT = path.join(ROOT, "public/ui");

function ensure(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function canvasPng(prop) {
  if (!prop) return null;
  let p = prop;
  if (p.constructor?.name === "WzUOLProperty") {
    try { p = p.wzValue; } catch { return null; }
  }
  try {
    const c = await p.getLinkedWzCanvasBitmap?.() || await p.getBitmap?.();
    if (!c) return null;
    const buf = await c.getBufferAsync("image/png");
    return buf;
  } catch {
    return null;
  }
}

async function saveCanvas(prop, file) {
  const buf = await canvasPng(prop);
  if (!buf) return false;
  ensure(path.dirname(file));
  fs.writeFileSync(file, buf);
  return true;
}

function findImg(dir, name) {
  return [...dir.wzImages].find((i) => i.name === name)
    || [...(dir.wzDirectories || [])].flatMap((d) => [...(d.wzImages || [])]).find((i) => i.name === name);
}

function at(node, name) {
  if (!node?.wzProperties) return null;
  return [...node.wzProperties].find((p) => p.name === name) || null;
}

function walk(node, prefix = "") {
  const out = [];
  if (!node?.wzProperties) return out;
  for (const p of node.wzProperties) {
    const n = prefix ? `${prefix}/${p.name}` : p.name;
    out.push({ path: n, prop: p, ctor: p.constructor?.name });
    if (p.wzProperties) out.push(...walk(p, n));
  }
  return out;
}

async function extractStatusBar(uiRoot) {
  const img = findImg(uiRoot, "StatusBar.img")
    || [...uiRoot.wzDirectories].flatMap((d) => [...d.wzImages]).find((i) => i.name === "StatusBar.img");
  if (!img) {
    // 有些版本放在 UIWindow 下
    for (const d of uiRoot.wzDirectories || []) {
      const hit = [...(d.wzImages || [])].find((i) => i.name === "StatusBar.img");
      if (hit) { await hit.parseImage(); return extractStatusBarFrom(hit); }
    }
    console.warn("StatusBar.img not found");
    return;
  }
  await img.parseImage();
  return extractStatusBarFrom(img);
}

async function extractStatusBarFrom(img) {
  const dest = path.join(OUT, "hud");
  ensure(dest);
  const all = walk(img);
  console.log("StatusBar nodes sample:", all.slice(0, 40).map((x) => x.path).join("\n "));

  // 常見路徑：base/backgrnd, base/backgrnd2, gauge/hp/*, gauge/mp/*, gauge/exp/*
  const wanted = [
    ["base/backgrnd", "backgrnd.png"],
    ["base/backgrnd2", "backgrnd2.png"],
    ["base/backgrnd3", "backgrnd3.png"],
    ["base/quickSlot", "quickSlot.png"],
    ["base/quickSlot/backgrnd", "quickSlot.png"],
    ["gauge/hp/layer:0", "hp0.png"],
    ["gauge/hp/layer:1", "hp1.png"],
    ["gauge/hp/layer:2", "hp2.png"],
    ["gauge/mp/layer:0", "mp0.png"],
    ["gauge/mp/layer:1", "mp1.png"],
    ["gauge/mp/layer:2", "mp2.png"],
    ["gauge/exp/layer:0", "exp0.png"],
    ["gauge/exp/layer:1", "exp1.png"],
    ["gauge/exp/layer:2", "exp2.png"],
    // 聊天列相關
    ["base/chatTarget", "chatTarget.png"],
    ["base/chatSpace", "chatSpace.png"],
    ["base/chatClose", "chatClose.png"],
    ["base/chatOpen", "chatOpen.png"],
  ];

  const byPath = Object.fromEntries(all.map((x) => [x.path, x.prop]));
  let n = 0;
  for (const [p, file] of wanted) {
    // 允許模糊：路徑結尾匹配
    let prop = byPath[p];
    if (!prop) {
      const hit = all.find((x) => x.path === p || x.path.endsWith("/" + p.split("/").pop()) && x.path.includes(p.split("/")[0]));
      prop = hit?.prop;
    }
    if (!prop) {
      // 再模糊：path includes key segments
      const segs = p.split("/");
      const hit = all.find((x) => segs.every((s) => x.path.includes(s.replace("layer:", ""))));
      prop = hit?.prop;
    }
    if (await saveCanvas(prop, path.join(dest, file))) {
      console.log("  ✓", file, "←", p);
      n++;
    }
  }

  // dump 所有 canvas 到 hud/_dump 方便手挑
  const dumpDir = path.join(dest, "_dump");
  ensure(dumpDir);
  let di = 0;
  for (const x of all) {
    const buf = await canvasPng(x.prop);
    if (!buf) continue;
    const safe = x.path.replace(/[^\w.-]+/g, "_").slice(0, 80);
    fs.writeFileSync(path.join(dumpDir, `${String(di).padStart(3, "0")}_${safe}.png`), buf);
    di++;
  }
  console.log(`StatusBar dump ${di} canvases → ${dumpDir}`);

  // 若有 backgrnd2，重建 panel.png（裁掉上方聊天白框的版本若已有就保留；另存 full）
  const bg2 = path.join(dest, "backgrnd2.png");
  if (fs.existsSync(bg2)) {
    const im = await loadImage(bg2);
    // 完整底板
    fs.copyFileSync(bg2, path.join(dest, "panel-full.png"));
    // 若高度 > 50，取下半 38px 當 bar（沿用舊裁法）
    if (im.height > 50) {
      const cv = createCanvas(im.width, 38);
      const ctx = cv.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(im, 0, im.height - 38, im.width, 38, 0, 0, im.width, 38);
      fs.writeFileSync(path.join(dest, "panel.png"), cv.toBuffer("image/png"));
      console.log("  ✓ panel.png rebuilt from backgrnd2 bottom 38px");
    } else {
      fs.copyFileSync(bg2, path.join(dest, "panel.png"));
      console.log("  ✓ panel.png = backgrnd2");
    }
  }
  const qs = path.join(dest, "quickSlot.png");
  if (fs.existsSync(qs)) {
    fs.copyFileSync(qs, path.join(dest, "quickslot.png"));
    console.log("  ✓ quickslot.png");
  }
  return n;
}

async function extractBasic(uiRoot) {
  const img = [...uiRoot.wzImages].find((i) => i.name === "Basic.img");
  if (!img) {
    console.warn("Basic.img not found at root");
    // 嘗試子目錄
    for (const d of uiRoot.wzDirectories || []) {
      const hit = [...(d.wzImages || [])].find((i) => i.name === "Basic.img");
      if (hit) {
        await hit.parseImage();
        return extractBasicFrom(hit);
      }
    }
    return 0;
  }
  await img.parseImage();
  return extractBasicFrom(img);
}

async function extractBasicFrom(img) {
  const dest = path.join(OUT, "basic");
  ensure(dest);
  const all = walk(img);
  console.log("Basic.img top:", all.filter((x) => !x.path.includes("/")).map((x) => x.path).slice(0, 30));

  // Bt* 按鈕
  let n = 0;
  const btnNames = new Set();
  for (const x of all) {
    const m = x.path.match(/^(Bt\w+)\/(normal|mouseOver|pressed|disabled|keyFocused)$/);
    if (!m) continue;
    btnNames.add(m[1]);
    const file = path.join(dest, `${m[1]}_${m[2]}.png`);
    if (await saveCanvas(x.prop, file)) n++;
  }
  console.log(`  ✓ Basic buttons: ${[...btnNames].join(", ")} (${n} frames)`);

  // 游標 / 其他
  for (const key of ["Cursor", "BtClose", "BtMax", "BtMin"]) {
    const hits = all.filter((x) => x.path.startsWith(key));
    for (const h of hits) {
      const safe = h.path.replace(/[^\w.-]+/g, "_");
      if (await saveCanvas(h.prop, path.join(dest, safe + ".png"))) n++;
    }
  }
  return n;
}

async function extractNotice(uiRoot) {
  // UIWindow.img 內的 notice / 小提示框
  const dest = path.join(OUT, "notice");
  ensure(dest);
  let img = [...uiRoot.wzImages].find((i) => i.name === "UIWindow.img" || i.name === "UIWindow2.img");
  if (!img) {
    for (const d of uiRoot.wzDirectories || []) {
      img = [...(d.wzImages || [])].find((i) => /UIWindow/.test(i.name));
      if (img) break;
    }
  }
  if (!img) {
    console.warn("UIWindow.img not found");
    return 0;
  }
  await img.parseImage();
  const all = walk(img);
  // 找 notice / util / Toolbox 之類
  const keys = ["notice", "Notice", "UtilDlg", "ToolTip", "Title", "Quest", "MiniMap"];
  let n = 0;
  const dump = path.join(dest, "_paths.txt");
  fs.writeFileSync(dump, all.map((x) => x.path).join("\n"));
  console.log("UIWindow paths →", dump, "count", all.length);

  // MiniMap 背景
  for (const x of all) {
    if (!/MiniMap|minimap/i.test(x.path)) continue;
    if (!/backgrnd|maxMap|minMap|c|nw|ne|sw|se|n|s|w|e/i.test(x.path.split("/").pop())) continue;
    const safe = x.path.replace(/[^\w.-]+/g, "_").slice(0, 90);
    if (await saveCanvas(x.prop, path.join(dest, "minimap_" + safe + ".png"))) n++;
  }
  // BtClose 等
  for (const x of all) {
    if (/BtClose|btClose/.test(x.path) && /normal|mouseOver|pressed/.test(x.path)) {
      const safe = x.path.replace(/[^\w.-]+/g, "_").slice(0, 90);
      if (await saveCanvas(x.prop, path.join(dest, safe + ".png"))) n++;
    }
  }
  console.log("  ✓ notice/minimap pieces", n);
  return n;
}

async function main() {
  if (!fs.existsSync(UI_WZ)) {
    console.error("UI.wz not found:", UI_WZ);
    process.exit(1);
  }
  console.log("Opening", UI_WZ);
  const F = new WzFile(UI_WZ, WzMapleVersion.EMS);
  await F.parseWzFile();
  const root = F.wzDirectory;
  console.log("UI root images:", [...root.wzImages].map((i) => i.name).join(", "));
  console.log("UI root dirs:", [...root.wzDirectories].map((d) => d.name).join(", "));

  await extractStatusBar(root);
  await extractBasic(root);
  await extractNotice(root);
  console.log("done →", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
