# 楓之島（Maple Island）線上版定案

> 目標：讓新玩家從零走完楓之島 —— 出生 → 打蝸牛練等 → 主線任務 → 一轉 → 搭船到弓箭手村（已做好）。
> 三方會議（Claude + Gemini + Grok）2026-07-25 定案。

## 鐵則（貫穿所有新功能）
- **伺服器唯一裁判**：客戶端只回報「做了什麼事件」，**不帶獎勵數值**。獎勵表只在 server。
- **single-writer**：所有玩家資料寫入走 bot `web-ops.js` handler（記憶體執行 + bot 自己 saveData），**絕不繞過直接寫 player-data.json**（會被 bot 記憶體覆蓋）。
- **接既有 bot 職業系統**，不自建網頁職業（避免帳號分裂）。
- **不做 47 張全圖**：鎖 11 張線性核心圖。

## 共享 vs 網頁專屬（資料切分）
| 類型 | 存哪 | 寫入方式 |
|---|---|---|
| 等級/經驗 | 真實角色 `char.totalExp` | `leveling.addExp`（既有） |
| 楓幣 | `p.fish.coins` | `currency.addCoins`（既有，寫帳本） |
| 職業 | `char.class`/`jobCode` | 新 op `job.advance` |
| **網頁世界進度** | **`char.web`**（隔離命名空間） | 新 op `world.checkpoint` / `quest.event` |

`char.web` schema：
```js
char.web = {
  mapId: "20000", x: 120, y: 40,        // 存檔點（換圖/節流 30s）
  flags: { shells_done: true, job1: false },
  quests: {
    q_mi_shells: { st: "active", kills: { "0100101": 7 }, items: {} }
  }
}
```

## 11 張核心地圖（線性路徑）
`10000` 楓葉山丘(出生) → `20000` 蝸牛公園 → `30000` 蝸牛花園 → `40000` 小森林 → `50000` 危險森林 → `50001` 南港西平原 → `60000` 南港(城) → `60001` 武器店 → `2000100` 港口 → `2000110` 上船 → 出島到 `100000000` 弓箭手村（已有）。

## 任務 / 對話 DSL（資料驅動）
`src/data/quests/maple-island.json`：
```json
{
  "q_mi_shells": {
    "name": "收集蝸牛殼", "npcStart": "2100", "npcEnd": "2100",
    "req": { "level": 1 },
    "objectives": [{ "type": "kill", "mobId": "0100101", "count": 10 }],
    "rewards": { "exp": 50, "meso": 100, "flags": ["shells_done"] },
    "next": "q_mi_job"
  }
}
```
`src/data/dialogs/2100.json`（節點圖，`if` 依玩家狀態切選項）：
```json
{ "start": { "text": "…", "opts": [
  { "t": "接受任務", "act": "quest.accept:q_mi_shells", "if": "quest.q_mi_shells==none" },
  { "t": "我打完了", "act": "quest.complete:q_mi_shells", "if": "quest.q_mi_shells==ready" },
  { "t": "再見", "act": "close" }
]}}
```

## 反作弊：任務擊殺計數由 server 累加
「殺 N 隻」任務**不信客戶端 evidence**。擴充既有 `hunt.report` handler：結算經驗/楓幣時，**同時把擊殺數累加到 `char.web.quests.*.kills`**。任務完成（`quest.complete`）只驗 server 端計數是否達標 → 達標才發獎。

## 新增 web-ops ops（bot 端 `web-ops.js`）
- `world.checkpoint` `{mapId,x,y}`：存位置（節流 30s / 換圖）
- `quest.event` `{qid, event:"accept"|"complete"}`：server 查表驗證 → 發獎（走 addExp/addCoins）→ 寫 flags
- `job.advance` `{job}`：驗 `level≥8` + `flags.ready_job1` + beginner → 寫 `class`
- `hunt.report`（擴充）：順帶累加 active quest 的 kill 計數

## 三階段
- **Phase A 引擎管線**：前端任務引擎 + 對話 DSL + `char.web` 讀取；bot 端 4 個 op（含 hunt.report 擴充）。
- **Phase B 內容**：dump 11 圖進 `world.js`（線性 + 出島閘門），寫 1 條主線任務 JSON。
- **Phase C 一轉 + 出航**：職業選擇 UI → `job.advance` → 出島傳送門靠旗標解鎖 → warp 弓箭手村。

## 已定決策（預設）
1. **客群**：內容對所有角色開放；**一轉步驟只對 beginner 角色**（已轉職的角色跳過，直接可搭船）。
2. **經濟**：沿用 `hunt.report` 每日上限（Lv200 回來打蝸牛也固定 baseExp，每日上限擋）。
3. **範圍**：11 圖 + 1 主線 + 一轉 + 出船，**單人**（其他玩家「幽靈快照」二期）。

## 最大坑（會議共識）
1. 繞過 single-writer → 整庫被蓋。
2. 任務/轉職/獎勵寫在客戶端 → 比狩獵更好刷。
3. 範圍膨脹（47 圖一次做）→ 拖死 MVP。
4. EXP 雙帳：session 級 vs 真經驗；UI 要標清「本場/帳號」或只顯示 server 回報。
