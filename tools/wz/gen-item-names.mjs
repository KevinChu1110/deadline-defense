// 從 String.wz/Eqp.img 抽「中文名→item id」表 → server/wz-item-names.json
// 供 combat-profile.js 把 bot 裝備中文名對回真實 Character.wz item id(顯示真原圖)
import wz from "@tybys/wz";
import { writeFileSync } from "node:fs";
import path from "node:path";
const { WzFile, WzMapleVersion } = wz;
const WZ_DIR = process.env.WZ_DIR || path.resolve(process.cwd(), "../../wz-data/wztms113");
const OUT = process.env.OUT || path.resolve(process.cwd(), "../../server/wz-item-names.json");
const F = new WzFile(path.join(WZ_DIR, "String.wz"), WzMapleVersion.EMS); await F.parseWzFile();
const eqp = [...F.wzDirectory.wzImages].find((i) => i.name === "Eqp.img"); await eqp.parseImage();
const root = [...eqp.wzProperties].find((p) => p.name === "Eqp");
const byName = {};
for (const cat of [...root.wzProperties]) {
  for (const it of cat.wzProperties) {
    const nm = it.at?.("name")?.wzValue; if (!nm) continue;
    const id = parseInt(it.name, 10);
    if (!(nm in byName)) byName[nm] = id; // 同名取第一個
  }
}
writeFileSync(OUT, JSON.stringify({ byName }));
console.log("wrote", OUT, "names:", Object.keys(byName).length);
