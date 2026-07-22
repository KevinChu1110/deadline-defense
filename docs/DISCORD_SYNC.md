# Discord 玩家資料 ↔ 楓之谷防衛戰 同步說明

## 為什麼不能「自動即時同步」？

| 端 | 資料在哪 | 問題 |
|----|----------|------|
| Discord Bot | 伺服器上的 `player-data.json` | 只有 Bot 程序能讀寫 |
| 網頁遊戲 | 瀏覽器 `localStorage`（Netlify 靜態站） | 沒有你的 Bot 檔案權限 |

兩邊不在同一台機器、也沒有共用資料庫時，**必須透過「匯出 → 貼上匯入」或「之後做 API」**。

---

## 目前採用：進度碼（MVP）

```
Discord 帳號
  └─ characters（多角色）
        ├─ 角色 A  ──→  網頁存檔 1
        ├─ 角色 B  ──→  網頁存檔 2
        └─ 角色 C  ──→  網頁存檔 3（最多 3 個，等級高優先）
```

### 1. 從 Bot 匯出

在 Bot 專案目錄：

```bash
# 用 Discord 數字 ID
node defense-bridge.js export 698024447151702046

# 或用暱稱片段
node defense-bridge.js export-name 炸彈猴

# 只要短碼
node defense-bridge.js code 698024447151702046
```

會得到 `MDEF1.…` 短碼（或完整 JSON）。

### 2. 網頁匯入

1. 打開防衛戰 → **開始遊戲**
2. 存檔頁 → **匯入 Discord 進度**
3. 貼上短碼 → **預覽** → **確認匯入**
4. 三個角色會寫入三個存檔槽（覆蓋）

### 匯入會帶什麼？

| Discord | 防衛戰 |
|---------|--------|
| 角色名稱 | 存檔暱稱 |
| class（職業） | 解鎖並強化該職業卡 |
| level | 卡片星等 1–5、關卡解鎖進度 |
| mapleLeaves | 楓葉（至少 120） |

**不會**整包搬裝備／卷軸／星力（網頁沒有同一套裝備系統）。之後可擴充。

---

## 之後怎麼升級到「帳號自動同步」？

```
[玩家] Discord OAuth 登入網頁
         ↓
[小後端 API] 讀寫與 Bot 同一份 DB / player-data
         ↓
[Bot] 改成也讀這份 DB（或 API）
```

需要：一台 24h 小服務（Fly.io / Railway / 你家 NAS）+ Discord Application OAuth。

**建議順序：**

1. ✅ 進度碼互通（已完成）
2. Bot 指令 `/防衛戰匯出`（把 CLI 包成 slash）
3. 可選：網頁匯出 → Bot `/防衛戰匯入`（反向）
4. OAuth + 雲端存檔

---

## 檔案位置

| 檔案 | 用途 |
|------|------|
| `artale-lottery-bot/defense-bridge.js` | Bot 端匯出 |
| `deadline-defense/src/data/discord-bridge.js` | 網頁端解析／寫入存檔 |
| 網頁 UI | 開始遊戲 → 存檔 → 匯入 Discord |

schema `v: 1`，兩邊都認。
