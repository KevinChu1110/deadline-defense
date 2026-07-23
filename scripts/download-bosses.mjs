/**
 * 下載五大 Boss 的真實動畫（attack/skill/hit/die/stand/move）到 public/mobs/。
 * 來源：maplestory.io /mob/{id}/render/{anim}（回傳該動畫的 GIF）。
 * 執行：node scripts/download-bosses.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "public/mobs");
mkdirSync(OUT, { recursive: true });

// 從 boss-anims.js 讀清單（純資料，直接 import）
const { BOSS_ANIMS } = await import(join(ROOT, "src/data/boss-anims.js"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchImg(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "deadline-defense/1.0" } });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 100 ? buf : null;
  } catch {
    return null;
  }
}

let ok = 0, skip = 0, fail = 0;
const failed = [];
const seen = new Set();
for (const [bossId, cfg] of Object.entries(BOSS_ANIMS)) {
  if (seen.has(cfg.mob)) continue; // 別名(horntail)共用同一 mob，不重抓
  seen.add(cfg.mob);
  for (const anim of cfg.anims) {
    const dest = join(OUT, `b${cfg.mob}_${anim}.png`);
    if (existsSync(dest) && statSync(dest).size > 100) {
      skip++;
      continue;
    }
    const url = `https://maplestory.io/api/GMS/${cfg.ver}/mob/${cfg.mob}/render/${anim}`;
    const buf = await fetchImg(url);
    if (buf) {
      writeFileSync(dest, buf);
      ok++;
      console.log(`  ✓ ${bossId} ${anim} (${buf.length}b)`);
    } else {
      fail++;
      failed.push(`${cfg.mob}/${anim}`);
      console.log(`  ✗ ${bossId} ${anim}`);
    }
    await sleep(120);
  }
}
console.log(`\n完成：新增 ${ok} · 略過 ${skip} · 失敗 ${fail}`);
if (failed.length) console.log("失敗：", failed.join(", "));
