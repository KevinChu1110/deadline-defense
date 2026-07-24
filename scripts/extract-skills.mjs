/* WZ 來源：MapleStoryUnity/wzData → GMS v62 (Google Drive 1.78GB zip)
 * 解出 62/Skill.wz + 62/String.wz 到 /tmp/wz62/，需 npm i @tybys/wz @napi-rs/canvas
 * v62 只含經典冒險家職業(260技能)；後期職業(皇家/英雄/五轉)需 v83 或 TMS WZ 再跑一次。
 */
/**
 * 從 GMS v62 Skill.wz 解出 625 技能的真實 icon + 特效動畫。
 * 對照：skills.json 內部 id(j200_0) ←名稱/順序→ WZ 官方 id(2001004)。
 * 輸出：public/skills/{internalId}_icon.png · {internalId}_fx.png(直向 spritesheet, 依 origin 對齊)
 *      + skills-anim-manifest.json (internalId → {fw,fh,frames,delays})
 */
import wz from "@tybys/wz";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createCanvas, loadImage } from "@napi-rs/canvas";
const { WzFile, WzMapleVersion } = wz;

const WEB = "/Users/kevin.chu/develop/sideprojects/deadline-defense";
const OUT = `${WEB}/public/skills`;
mkdirSync(OUT, { recursive: true });

const skillsJson = JSON.parse(readFileSync(`${WEB}/src/data/world/skills.json`, "utf8"));

// String.wz: 官方id → 名稱
const strf = new WzFile("/tmp/wz62/String.wz", WzMapleVersion.GMS);
await strf.parseWzFile();
const strImg = [...strf.wzDirectory.wzImages].find((i) => i.name === "Skill.img");
await strImg.parseImage();
const nameById = {};
for (const p of strImg.wzProperties) {
  const n = p.at?.("name")?.value;
  if (n) nameById[p.name] = String(n).trim();
}

// Skill.wz
const skf = new WzFile("/tmp/wz62/Skill.wz", WzMapleVersion.GMS);
await skf.parseWzFile();
const skImgs = new Map([...skf.wzDirectory.wzImages].map((i) => [i.name.replace(".img", ""), i]));

// 動畫節點優先序（要「特效」而非圖示）
const ANIM_PRIORITY = ["ball", "effect", "effect0", "special", "special0", "keydownend", "hit", "hit0", "mob", "affected", "tile"];

async function pngBufOf(canvasProp) {
  const c = await canvasProp.getLinkedWzCanvasBitmap();
  return await c.getBufferAsync("image/png");
}
function frameNodes(animNode) {
  return [...animNode.wzProperties]
    .filter((p) => /^\d+$/.test(p.name) && p.pngProperty)
    .sort((a, b) => +a.name - +b.name);
}
function originOf(frameNode) {
  const o = frameNode.at?.("origin");
  return o && o.value ? { x: o.value.x | 0, y: o.value.y | 0 } : { x: 0, y: 0 };
}
function delayOf(frameNode) {
  const d = frameNode.at?.("delay");
  return d && d.value != null ? Math.max(30, +d.value) : 100;
}

const manifest = {};
let okIcon = 0, okFx = 0, noMatch = 0, total = 0;

for (const [job, data] of Object.entries(skillsJson)) {
  const img = skImgs.get(job);
  if (!img) continue;
  await img.parseImage();
  const skillNode = img.at("skill");
  if (!skillNode) continue;
  const wzIds = [...skillNode.wzProperties].map((p) => p.name);
  // 官方id → 名稱（本 job）
  const byName = {};
  wzIds.forEach((id, idx) => { const nm = nameById[id]; if (nm) byName[nm] = id; });

  const jsonSkills = data.skills || [];
  for (let idx = 0; idx < jsonSkills.length; idx++) {
    const sk = jsonSkills[idx];
    total++;
    // 對照：先名稱，後順序
    let officialId = byName[String(sk.name).trim()] || wzIds[idx];
    if (!officialId) { noMatch++; continue; }
    const node = skillNode.at(officialId);
    if (!node) { noMatch++; continue; }

    const entry = { officialId };

    // icon
    const iconProp = node.at("icon");
    if (iconProp && iconProp.pngProperty) {
      try {
        writeFileSync(`${OUT}/${sk.id}_icon.png`, await pngBufOf(iconProp));
        entry.icon = true; okIcon++;
      } catch {}
    }

    // 特效動畫（挑第一個存在的）
    let animNode = null, animName = null;
    for (const an of ANIM_PRIORITY) {
      const n = node.at(an);
      if (n && frameNodes(n).length) { animNode = n; animName = an; break; }
    }
    if (animNode) {
      const frames = frameNodes(animNode);
      // 先載入所有幀 + origin，算對齊後的 cell 尺寸
      const imgs = [];
      for (const fr of frames) {
        try {
          const buf = await pngBufOf(fr);
          const im = await loadImage(buf);
          imgs.push({ im, org: originOf(fr), delay: delayOf(fr) });
        } catch {}
      }
      if (imgs.length) {
        // 依 origin 對齊：cell 需容納各幀 origin 左右/上下最大延伸
        let l = 0, r = 0, t = 0, b = 0;
        for (const { im, org } of imgs) {
          l = Math.max(l, org.x); r = Math.max(r, im.width - org.x);
          t = Math.max(t, org.y); b = Math.max(b, im.height - org.y);
        }
        const fw = Math.max(1, l + r), fh = Math.max(1, t + b);
        const cx = l, cy = t; // cell 內的 origin 位置
        const sheet = createCanvas(fw, fh * imgs.length);
        const ctx = sheet.getContext("2d");
        imgs.forEach(({ im, org }, i) => {
          ctx.drawImage(im, cx - org.x, i * fh + (cy - org.y));
        });
        writeFileSync(`${OUT}/${sk.id}_fx.png`, sheet.toBuffer("image/png"));
        entry.fx = { anim: animName, fw, fh, n: imgs.length, delays: imgs.map((x) => x.delay) };
        okFx++;
      }
    }
    manifest[sk.id] = entry;
  }
}

writeFileSync(`${WEB}/src/data/skills-anim-manifest.json`, JSON.stringify(manifest));
console.log(`✓ 技能 ${total} · icon ${okIcon} · 特效動畫 ${okFx} · 對不到 ${noMatch}`);
