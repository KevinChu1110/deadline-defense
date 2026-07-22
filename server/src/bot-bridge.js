/**
 * 橋接 artale-lottery-bot 的 CommonJS 模組（星力／潛能／貨幣）
 * server 為 ESM，透過 createRequire 載入同一套公式，避免兩套規則。
 */
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export const BOT_ROOT = path.resolve(
  __dirname,
  "../../../artale-lottery-bot"
);

export const starForce = require(path.join(BOT_ROOT, "star-force.js"));
export const potential = require(path.join(BOT_ROOT, "potential.js"));
export const currency = require(path.join(BOT_ROOT, "currency.js"));
