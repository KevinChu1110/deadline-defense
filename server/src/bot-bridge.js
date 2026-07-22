/**
 * 橋接 artale-lottery-bot 的 CommonJS 模組（星力／潛能／貨幣）
 * server 為 ESM，透過 createRequire 載入同一套公式，避免兩套規則。
 *
 * BOT_ROOT 解析順序：
 *   1. 環境變數 BOT_ROOT
 *   2. 本機 monorepo 旁的 artale-lottery-bot
 *   3. sit-kevin 的 ~/artale-bot
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function resolveBotRoot() {
  if (process.env.BOT_ROOT) {
    return path.resolve(process.env.BOT_ROOT);
  }
  const candidates = [
    path.resolve(__dirname, "../../../artale-lottery-bot"),
    path.resolve(__dirname, "../../../../artale-lottery-bot"),
    path.join(os.homedir(), "artale-bot"),
    path.join(os.homedir(), "artale-lottery-bot"),
    "/home/kevin.chu/artale-bot",
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "star-force.js"))) return c;
  }
  return candidates[0];
}

export const BOT_ROOT = resolveBotRoot();

export const starForce = require(path.join(BOT_ROOT, "star-force.js"));
export const potential = require(path.join(BOT_ROOT, "potential.js"));
export const currency = require(path.join(BOT_ROOT, "currency.js"));
