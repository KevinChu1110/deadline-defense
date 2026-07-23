/**
 * 下載 mob sprite：依 scripts/mob-ids.json，從 maplestory.io 抓 render/stand
 * 存到 public/mobs/{id}.png（loader 會自動辨識 GIF bytes）。
 *
 * 執行：node scripts/download-mobs.mjs
 * 特性：跳過已存在、失敗重試、節流、多版本 fallback。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "public/mobs");
mkdirSync(OUT, { recursive: true });

const ids = JSON.parse(readFileSync(join(__dirname, "mob-ids.json"), "utf8"));

// 依序嘗試的來源（Artale ≈ 舊 GMS；抓不到退 TMS）
const SOURCES = [
  (id) => `https://maplestory.io/api/GMS/62/mob/${id}/render/stand`,
  (id) => `https://maplestory.io/api/GMS/64/mob/${id}/render/stand`,
  (id) => `https://maplestory.io/api/TMS/209/mob/${id}/render/stand`,
  (id) => `https://maplestory.io/api/GMS/83/mob/${id}/render/stand`,
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchImg(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "deadline-defense/1.0" } });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) return null;
    return buf;
  } catch {
    return null;
  }
}

let ok = 0, skip = 0, fail = 0;
const failed = [];

for (let i = 0; i < ids.length; i++) {
  const id = ids[i];
  const dest = join(OUT, `${id}.png`);
  if (existsSync(dest) && statSync(dest).size > 100) {
    skip++;
    continue;
  }
  let buf = null;
  for (const src of SOURCES) {
    buf = await fetchImg(src(id));
    if (buf) break;
    await sleep(120);
  }
  if (buf) {
    writeFileSync(dest, buf);
    ok++;
  } else {
    fail++;
    failed.push(id);
  }
  if ((i + 1) % 25 === 0) {
    console.log(`  ${i + 1}/${ids.length} · 新增 ${ok} 略過 ${skip} 失敗 ${fail}`);
  }
  await sleep(90);
}

writeFileSync(join(__dirname, "mob-download-failed.json"), JSON.stringify(failed));
console.log(`✓ 完成：新增 ${ok} · 略過 ${skip} · 失敗 ${fail}`);
if (failed.length) console.log(`  失敗 id 記於 scripts/mob-download-failed.json：`, failed.slice(0, 20));
