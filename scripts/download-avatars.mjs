/**
 * 各職業紙娃娃立繪 → public/avatars/{class}.png
 * 用 maplestory.io 角色 API 合成(body+head+face+hair+衣+武器)。
 * 執行：node scripts/download-avatars.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "avatars");
mkdirSync(OUT, { recursive: true });

const V = "214", R = "GMS";
const BODY = 2000, HEAD = 12000, FACE = 20000;
// 家族 → 髮型
const HAIR = { warrior: 30030, mage: 30020, archer: 34070, thief: 34070, pirate: 30030, beginner: 30030 };
// 職業 → { weapon, family, robe? }
const W = { sword: 1302000, spear: 1432000, axe: 1312000, staff: 1382000, wand: 1372000, bow: 1452000, crossbow: 1462000, dagger: 1332000, claw: 1472000, knuckle: 1482000, gun: 1492000 };
const TOP = 1040036, PANTS = 1060026, ROBE = 1050131;

const CLASS_AVATAR = {
  beginner: { fam: "beginner" }, noblesse: { fam: "beginner" },
  hero: { fam: "warrior", w: W.sword }, paladin: { fam: "warrior", w: W.sword }, dark_knight: { fam: "warrior", w: W.spear },
  soul_swordsman: { fam: "warrior", w: W.sword }, aran: { fam: "warrior", w: W.spear },
  mage: { fam: "mage", w: W.staff, robe: 1 }, fire_mage: { fam: "mage", w: W.staff, robe: 1 }, ice_mage: { fam: "mage", w: W.staff, robe: 1 },
  flame_wizard: { fam: "mage", w: W.staff, robe: 1 }, evan: { fam: "mage", w: W.wand, robe: 1 }, luminous: { fam: "mage", w: W.staff, robe: 1 },
  bowmaster: { fam: "archer", w: W.bow }, marksman: { fam: "archer", w: W.crossbow }, mercedes: { fam: "archer", w: W.bow }, wind_breaker: { fam: "archer", w: W.bow },
  night_envoy: { fam: "thief", w: W.claw }, night_walker: { fam: "thief", w: W.claw }, shadow_bandit: { fam: "thief", w: W.dagger }, phantom: { fam: "thief", w: W.dagger },
  buccaneer: { fam: "pirate", w: W.knuckle }, thunder_breaker: { fam: "pirate", w: W.knuckle }, gunslinger: { fam: "pirate", w: W.gun },
};

function url(cfg) {
  const items = [{ itemId: BODY }, { itemId: HEAD }, { itemId: FACE }, { itemId: HAIR[cfg.fam] || 30030 }];
  if (cfg.robe) items.push({ itemId: ROBE });
  else { items.push({ itemId: TOP }, { itemId: PANTS }); }
  if (cfg.w) items.push({ itemId: cfg.w });
  const enc = encodeURIComponent(items.map((o) => JSON.stringify({ ...o, version: V, region: R })).join(","));
  return `https://maplestory.io/api/character/${enc}/stand1/0?resize=2`;
}

let ok = 0, fail = 0;
for (const [cls, cfg] of Object.entries(CLASS_AVATAR)) {
  const dest = join(OUT, `${cls}.png`);
  if (existsSync(dest)) { ok++; continue; }
  try {
    const res = await fetch(url(cfg), { headers: { "User-Agent": "deadline-defense/1.0" } });
    if (!res.ok) throw new Error(res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) throw new Error("tiny");
    writeFileSync(dest, buf);
    ok++;
    console.log(`✓ ${cls} (${buf.length}b)`);
  } catch (e) {
    fail++;
    console.log(`✗ ${cls}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 150));
}
console.log(`\n完成 ${ok} · 失敗 ${fail}`);
