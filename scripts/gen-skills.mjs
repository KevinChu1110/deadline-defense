/**
 * 技能分類產生器：把 bot 的 skills.json（90職/625技能）轉成引擎可用的
 * src/data/skills-generated.js —— 每技能標好 element/shape/傷害/buff持續時間。
 *
 * ⚠️ 這是「效果/數值」層，與 WZ 動畫無關；WZ 真實特效之後接在 shape 上替換視覺。
 * 執行：node scripts/gen-skills.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const raw = JSON.parse(readFileSync(join(ROOT, "src/data/world/skills.json"), "utf8"));

// 職業代碼首碼 → 家族（0初/1戰/2法/3弓/4盜/5海）
function familyOf(jobCode) {
  const d = String(jobCode)[0];
  return { "0": "beginner", "1": "warrior", "2": "mage", "3": "archer", "4": "thief", "5": "pirate" }[d] || "beginner";
}

// 元素關鍵字（查 name + desc）
const ELEMENTS = [
  ["fire", /火|炎|焰|燄|燃|隕石|流星|爆裂|地獄|熔/],
  ["ice", /冰|霜|寒|凍|雪|暴風雪|絕對零度/],
  ["thunder", /雷|電|閃電|天雷|放電/],
  ["poison", /毒|中毒|瘴/],
  ["holy", /聖|神聖|天使|治癒|祝福|驅魔|光/],
  ["dark", /暗|闇|黑暗|詛咒|亡靈|吸取|死亡/],
];
function elementOf(name, desc) {
  const t = `${name} ${desc}`;
  for (const [el, re] of ELEMENTS) if (re.test(t)) return el;
  return "physical";
}

// 形狀推斷（依 kind + family + desc 關鍵字）
function shapeOf(sk, family) {
  const desc = sk.desc || "";
  const name = sk.name || "";
  const t = `${name} ${desc}`;
  if (sk.kind === "buff") return "buff";
  if (sk.kind === "heal") return "heal";
  // attack
  if (/貫穿|穿透|貫通/.test(t)) return "beam";
  if (/從天|天而降|落下|隕石|流星|召喚.*落|龍捲|暴風雪|箭雨|落雷/.test(t)) return "rain";
  if (/全體|全部|周圍|範圍|波及|附近的?所有|地面/.test(t)) return "aoe";
  if (/連續|連擊|連斬|亂舞|多段|連射|[三四五六七八九兩]段|次攻擊|連環/.test(t)) return "multi";
  if (/衝|突進|踏|瞬間移動|位移|飛身|突襲/.test(t)) return "dash";
  if (/爆發|爆氣|周身|自身周圍/.test(t)) return "nova";
  // 依家族預設
  if (family === "mage") return "aoe";
  if (family === "archer") return "bolt";
  if (family === "pirate") return "bolt";
  return "arc"; // 戰士/盜賊近戰
}

// 從 effectTable 抽某欄逐等數值
function colValues(sk, matcher) {
  const et = sk.effectTable;
  if (!et || !Array.isArray(et.cols) || !Array.isArray(et.rows)) return null;
  const ci = et.cols.findIndex((c) => matcher.test(c));
  if (ci < 0) return null;
  return et.rows.map((r) => r[ci]);
}
function parseNum(s) {
  if (s == null) return 0;
  const m = String(s).match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}
// 持續時間 "N秒"/"N分" → 秒
function parseDuration(s) {
  if (s == null) return 0;
  const str = String(s);
  const min = str.match(/(\d+)\s*分/);
  const sec = str.match(/(\d+)\s*秒/);
  return (min ? Number(min[1]) * 60 : 0) + (sec ? Number(sec[1]) : 0);
}

const SKILLS = {};
const JOB_SKILLS = {};
let count = 0;
const shapeHist = {}, elemHist = {};

for (const jobCode of Object.keys(raw)) {
  const family = familyOf(jobCode);
  const list = [];
  for (const sk of raw[jobCode].skills || []) {
    const id = sk.id;
    if (!id) continue;
    const element = elementOf(sk.name, sk.desc);
    const shape = shapeOf(sk, family);
    // 逐等數值
    const dmgCol = colValues(sk, /攻擊力|傷害|威力/);
    const mpCol = colValues(sk, /消耗\s*MP|MP消耗/);
    const durCol = colValues(sk, /持續時間|時間/);
    const dmg = dmgCol ? dmgCol.map(parseNum) : (sk.lv || []).map((l) => l.dmg || 0);
    const mp = mpCol ? mpCol.map(parseNum) : (sk.lv || []).map((l) => l.mp || 0);
    const duration = durCol ? durCol.map(parseDuration) : null;
    // buff 種類（依 cols）
    let buffKind = null, buffMag = null;
    if (sk.kind === "buff") {
      const cols = (sk.effectTable && sk.effectTable.cols) || sk.cols || [];
      const bmap = [
        ["atk", /攻擊力|傷害/], ["def", /防禦力/], ["aspd", /攻擊速度/],
        ["speed", /移動速度/], ["jump", /跳躍/], ["acc", /命中/], ["eva", /迴避/],
        ["crit", /爆擊|致命/], ["hp", /HP|血/], ["mp", /MP|魔/], ["mastery", /熟練度/],
      ];
      for (const [bk, re] of bmap) {
        if (cols.some((c) => re.test(c))) { buffKind = bk; const v = colValues(sk, re); buffMag = v ? v.map(parseNum) : null; break; }
      }
      if (!buffKind) buffKind = "misc";
    }

    SKILLS[id] = {
      id,
      name: sk.name,
      job: jobCode,
      family,
      kind: sk.kind,        // attack/buff/heal/passive
      active: sk.type === "active",
      element,
      shape,                // bolt/arc/aoe/beam/multi/nova/rain/dash/buff/heal
      maxLv: sk.maxLv || (sk.lv ? sk.lv.length : 1),
      mp,
      dmg,                  // 逐等攻擊力(%或值)
      duration,             // 逐等持續秒數(buff/DoT) 或 null
      buffKind,             // buff 專用
      buffMag,
      desc: sk.desc || "",
    };
    list.push(id);
    count++;
    shapeHist[shape] = (shapeHist[shape] || 0) + 1;
    elemHist[element] = (elemHist[element] || 0) + 1;
  }
  JOB_SKILLS[jobCode] = list;
}

const out = `/* 自動產生 — 請勿手改。來源：src/data/world/skills.json
 * 產生器：scripts/gen-skills.mjs
 * ${Object.keys(JOB_SKILLS).length} 職 · ${count} 技能
 * shape/element 供程序化特效與(未來)WZ 動畫掛載。
 */
export const SKILLS = ${JSON.stringify(SKILLS)};
export const JOB_SKILLS = ${JSON.stringify(JOB_SKILLS)};
`;
writeFileSync(join(ROOT, "src/data/skills-generated.js"), out);

console.log(`✓ ${Object.keys(JOB_SKILLS).length} 職 · ${count} 技能`);
console.log("  shape 分布:", JSON.stringify(shapeHist));
console.log("  element 分布:", JSON.stringify(elemHist));
