# Artale Web — 產品定案（2026-07-22）

## 決策鎖定

| 項目 | 選擇 |
|------|------|
| 突襲戰鬥形態 | **C — 完整動作向**（站位／技能／可讀 Boss 戰，非純文字模擬） |
| v1 養成系統 | **完整**：多角色、換裝、星力、潛能（及既有 Bot 裝備規則） |
| Discord 突襲 | **關閉**：改導流網頁，避免兩套結果 |

## 產品定位

- **網頁** = 真正玩的地方（養成 + 無止境 + Boss 突襲即時戰）
- **Discord Bot** = 帳號綁定、通知、社群、導流（不再模擬打 Boss）

防衛戰（塔防／推線）可保留為活動小遊戲，**不是**突襲主線。

## 系統架構

```
apps/web (Vite)
  Hub UI · 裝備 · 星力 · 潛能 · 動作戰鬥
       │
       ▼  /api/*
server (Node)
  讀寫玩家資料（先接 player-data.json，後遷 DB）
       │
       ▼
shared 戰力／星力／潛能規則（自 Bot 抽出）
       │
Discord Bot（瘦身）
  OAuth 綁定 · 導流 · 關文字突襲
```

## 里程碑

| ID | 內容 | 狀態 |
|----|------|------|
| M0 | 規格鎖定 + 本機 API 讀角色 | ✅ |
| M1 | Discord OAuth + session 登入 | ✅ |
| M2 | 換裝（楓之谷風）可操作；星力台／潛能台 | ✅ 換裝 · 星力 · 潛能（結合/閃炫仍 Discord） |
| M3 | 動作戰鬥 v1（炎魔／龍王橫向站場） | ✅ v1 可玩（移動/跳/普攻/技能/telegraph） |
| M4 | 無止境 + 排行 | |
| M5 | Bot 關閉突襲模擬 | 與 M3 上線同步 |

## 動作戰鬥 v1（C）範圍（避免無限膨脹）

- 橫向或 2.5D 站場，角色可左右移動 + 跳躍（簡化）
- 普攻／1～2 技能（吃 class-formula 輸出）
- Boss 有血條、階段、可讀 telegraph（沿用 raid 招式表）
- 單人先做，組隊二期

## 資料對應

| Bot | Web |
|-----|-----|
| `discordId` | 帳號 |
| `characters` + `activeCharId` | 角色欄 |
| `items` / `equipped` | 背包／裝備欄 |
| `char.starSlots` | 星力 UI |
| `char.potentialSlots` | 潛能 UI |

## 本機開發

```bash
# 終端 1 — API（讀 artale-lottery-bot/player-data.json）
cd server && npm run dev

# 終端 2 — 網頁
npm run dev
```

開啟後主選單 → **進入主城**。

## SIT 部署

| 層 | 位置 | URL |
|----|------|-----|
| **前端** | Netlify `maplestory-defense` | https://maplestory-defense.netlify.app |
| **API** | sit-kevin + ngrok（只暴露 API） | https://primary-marmoset-publicly.ngrok-free.app/defense/api/… |

```
瀏覽器 (Netlify)
   │  fetch VITE_API_BASE + /api/*
   ▼
ngrok → :2567 /defense/* → :8787 artale-web-api → player-data.json
```

- 建置：`netlify.toml` 設 `VITE_API_BASE`（跨站 API）
- Cookie：`SameSite=None; Secure` + CORS 允許 `*.netlify.app`
- 登入：OAuth 未設時用「開發用 ID」；OAuth Redirect 仍指 ngrok API callback
- API 更新：`./deploy.sh`（PM2 `artale-web-api`）
- 前端更新：`git push`（Netlify 自動 build）或 `netlify deploy --prod`
