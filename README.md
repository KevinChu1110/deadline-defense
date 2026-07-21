# 神木防衛 · Deadline Defense

楓之谷風格路線塔防：22 職業卡、10 關 100 波、卡片升級。

**GitHub:** https://github.com/KevinChu1110/deadline-defense

## 本機開發

```bash
npm install
npm run dev
```

建置：

```bash
npm run build
npm run preview
```

## 部署到 Netlify（Git 連線）

Repo 已含 `netlify.toml`（`npm run build` → publish `dist`）。

1. 開啟：https://app.netlify.com/start/deploy?repository=https://github.com/KevinChu1110/deadline-defense  
2. 授權 GitHub（若尚未）  
3. 確認 Build command = `npm run build`、Publish = `dist`  
4. Deploy  

之後 `git push origin main` 會自動重新部署。

## 怎麼玩

1. 開場選關（通關解鎖 Stage 02）
2. 右側選 Specialist（或按 `1` / `2` / `3`）
3. 點地圖綠色 `+` 部署格
4. 按 **Start Wave**（空白鍵）
5. 部分波次清場後 **三選一辦公道具**
6. 漏怪扣 Core；防火牆可擋漏；Core 歸零即失敗
7. 可賣出單位回收 1 點（`Delete`）
8. `Speed` ×1/×2/×3 · `M` 靜音 · `Stages` 選關

### 關卡

| Stage | 名稱 | 特色 |
|------|------|------|
| 01 | First Shift / 第一班 | 單路線，教學 8 波 |
| 02 | Moving Target / 移動目標 | **雙路線**（INBOX + LIFT）+ Handoff Ghost |

### Specialists

| Code | 角色 | 費用 | 能力 |
|------|------|------|------|
| GUA | 守護者 | 2 | 減速 |
| CAT | 催化者 | 3 | 高傷 + 燃燒 |
| ANL | 分析師 | 2 | 破隱 + 易傷 |

### 辦公道具（中途三選一）

濃縮咖啡（攻速）、機械鍵盤（點數）、便利貼（Core 緩速）、釘書機（破甲）、行動電源（傷害）、備份碟（修 Core）、防火牆（擋漏）、影印機（人數+點數）

### 敵人語法

- Notification — 快脆
- Hidden Bug — 隱形（需 ANL 或被標記）
- Conflict Pair — 厚一點
- Burnout Wall — 坦克
- Ticket Zombie — 復活一次
- Handoff Ghost — 高速（Stage 02 電梯路）
- Review Loop — 迷你 Boss，半血自癒

## 專案結構

```
deadline-defense/
  index.html
  package.json
  src/
    main.js              # UI 綁定 / 選關 / 獎勵
    styles/main.css
    audio/sfx.js
    data/
      specialists.js
      enemies.js
      items.js           # 辦公道具
      stage01.js
      stage02.js
      stages.js          # 關卡表 + 進度
    game/
      Game.js
      entities.js
      path.js
      render.js
      sprites.js
      fx.js
```

## 已完成功能

- [x] MVP 單關塔防 loop
- [x] 像素美術 + 合成音效
- [x] Stage 02 雙路線
- [x] 中途道具三選一
- [x] 關卡選單 + localStorage 進度

## 下一步（建議）

- [ ] 更多 Specialist（OPR / WEA / CUR）
- [ ] Stage 03 Boss 關
- [ ] 自訂像素 sheet / 真實音檔替換

## 授權

自用 / 學習專案。請勿直接搬運其他遊戲的美術與文案。
