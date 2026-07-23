/**
 * 世界產生器：把 bot 的 maps.json (16大陸/570圖) + monsters.json (644怪)
 * 轉成塔防用的 world-generated.js（大陸 → 關卡 → 敵人定義 + 波次）。
 *
 * 執行：node scripts/gen-world.mjs
 * 產出：src/data/world-generated.js  +  scripts/mob-ids.json（給下載腳本用）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const maps = read("src/data/world/maps.json").regions;
const monsters = read("src/data/world/monsters.json");

// name(小寫) → monster；同時 nameZh 反查（有些 boss 只對得到中文）
const byName = new Map();
for (const m of monsters) byName.set(String(m.name).toLowerCase(), m);

// 大陸 key → 短代碼（給主題/UI）
const CONTINENT_CODE = {
  "MAPLE ISLAND": "maple",
  "VICTORIA ISLAND": "victoria",
  "SLEEPYWOOD": "sleepy",
  "ELLIN FOREST": "ellin",
  "ORBIS": "orbis",
  "EL NATH": "elnath",
  "LUDIBRIUM": "ludi",
  "AQUARIUM": "aqua",
  "LEAFRE": "leafre",
  "MU LUNG": "mulung",
  "NIHAL DESERT": "nihal",
  "MAGATIA": "magatia",
  "TEMPLE OF TIME": "temple",
};

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// 等級 → 顏色階（低→高：藍綠黃橘紅紫）
function colorForLevel(lv) {
  if (lv < 15) return "#93c5fd";
  if (lv < 30) return "#86efac";
  if (lv < 50) return "#fde047";
  if (lv < 70) return "#fbbf24";
  if (lv < 100) return "#fb7185";
  if (lv < 140) return "#f472b6";
  return "#c084fc";
}

// 依怪等級推塔防基礎數值
function statsFor(mon, level) {
  const lv = mon?.level || level || 1;
  // ⚠️ 官方 HP 從 15 到數百萬，直接用會讓塔防怪打不死。改用「等級曲線」重算，
  //    落在 ~20(lv1) ~ ~1400(lv150) 的塔防可玩區間；難度交給 per-stage hpScale。
  const hp = Math.round(16 + Math.pow(lv, 1.3));
  // 物防 → 護甲(0~0.55)
  const pdef = mon?.pdef || 0;
  const armor = Math.min(0.55, pdef / 1400);
  // 速度：等級越高略慢（大怪），加名字雜湊小變化避免整關同速
  const speed = Math.max(42, Math.round(74 - Math.min(28, lv * 0.18)));
  const radius = Math.min(22, 13 + Math.floor(lv / 12));
  const leak = lv < 30 ? 1 : lv < 80 ? 2 : 3;
  // sprite 縮放：高等怪原圖通常較大，縮小一點
  const scale = lv < 30 ? 2.0 : lv < 70 ? 1.7 : lv < 120 ? 1.4 : 1.2;
  return { lv, hp, armor, speed, radius, leak, scale, color: colorForLevel(lv) };
}

const usedIds = new Set();
const enemyDefs = {}; // id(mob) → def
const continents = [];
let stageCount = 0;
const missingNames = new Set();

for (const cont of maps) {
  const code = CONTINENT_CODE[cont.key] || slug(cont.key);
  const contStages = [];
  const list = (cont.maps || []).filter((m) => !m.hidden && (m.monsters || []).length);
  list.forEach((mp, idx) => {
    const mons = [];
    for (const mo of mp.monsters || []) {
      const hit = byName.get(String(mo.name || "").toLowerCase());
      if (!hit) {
        missingNames.add(mo.nameZh || mo.name);
        continue;
      }
      // 過濾髒資料：mob id 須為標準範圍（≥100000），否則沒有 sprite
      if (!(Number(hit.id) >= 100000)) {
        missingNames.add(mo.nameZh || mo.name);
        continue;
      }
      usedIds.add(hit.id);
      const st = statsFor(hit, mo.level);
      if (!enemyDefs[hit.id]) {
        const def = {
          id: String(hit.id),
          nameZh: mo.nameZh || hit.name,
          level: st.lv,
          color: st.color,
          radius: st.radius,
          hp: st.hp,
          speed: st.speed,
          leakDamage: st.leak,
          sprite: `${hit.id}.png`,
          spriteScale: st.scale,
        };
        if (st.armor >= 0.08) {
          def.armor = Number(st.armor.toFixed(3));
          def.tags = ["armored"];
        }
        enemyDefs[hit.id] = def;
      }
      mons.push({ id: String(hit.id), level: mo.level || hit.level || 1 });
    }
    if (!mons.length) return;
    // 關卡整體難度＝該圖最高怪等
    const maxLv = Math.max(...mons.map((m) => m.level));
    contStages.push({
      id: `${code}-${idx}-${slug(mp.name)}`,
      name: mp.nameZh || mp.name,
      nameEn: mp.name,
      level: maxLv,
      monsters: mons, // [{id, level}]
    });
    stageCount++;
  });
  if (!contStages.length) continue;
  // 大陸內關卡依最低怪等排序（由淺入深）
  contStages.sort((a, b) => a.level - b.level);
  continents.push({
    code,
    key: cont.key,
    nameZh: cont.nameZh || cont.key,
    stages: contStages,
  });
}

// 大陸依平均等級排序（世界進程）
continents.sort((a, b) => {
  const avg = (c) => c.stages.reduce((n, s) => n + s.level, 0) / c.stages.length;
  return avg(a) - avg(b);
});

const out = `/* 自動產生 — 請勿手改。來源：src/data/world/maps.json + monsters.json
 * 產生器：scripts/gen-world.mjs
 * ${continents.length} 大陸 · ${stageCount} 關 · ${Object.keys(enemyDefs).length} 種怪
 */
export const WORLD_ENEMIES = ${JSON.stringify(enemyDefs)};

export const WORLD_CONTINENTS = ${JSON.stringify(continents)};
`;

writeFileSync(join(ROOT, "src/data/world-generated.js"), out);
writeFileSync(join(ROOT, "scripts/mob-ids.json"), JSON.stringify([...usedIds]));

console.log(`✓ 大陸 ${continents.length} · 關卡 ${stageCount} · 怪種 ${Object.keys(enemyDefs).length}`);
console.log(`  需下載 mob 圖 ${usedIds.size} 張 → scripts/mob-ids.json`);
console.log(`  名字對不到（略過）${missingNames.size} 種：`, [...missingNames].slice(0, 12).join("、"));
