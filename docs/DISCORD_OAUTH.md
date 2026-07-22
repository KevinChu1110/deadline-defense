# M1 — Discord OAuth 設定

## 1. 建立 Discord Application

1. 開啟 https://discord.com/developers/applications  
2. **New Application** → 名稱例如 `Artale Web`  
3. 左側 **OAuth2** → **Redirects** 新增：

```
http://127.0.0.1:5173/api/auth/discord/callback
```

> 必須是 **5173**（網頁同源 + Vite 代理），不要寫 8787，否則 cookie 不會留在瀏覽器網頁端。

4. 複製 **Client ID** 與 **Client Secret**

## 2. 本機環境變數

```bash
cd deadline-defense/server
cp env.example .env
# 編輯 .env 填入：
# DISCORD_CLIENT_ID=...
# DISCORD_CLIENT_SECRET=...
```

## 3. 啟動

```bash
# 終端 1
cd deadline-defense && npm run dev:api

# 終端 2
cd deadline-defense && npm run dev
```

瀏覽器開 http://127.0.0.1:5173 → **進入主城** → **使用 Discord 登入**

## 行為

- 登入成功 → 用 Discord User ID 對應 `player-data.json`
- **若尚無帳號** → 自動建立初心者角色 + 120 楓葉
- Session cookie `artale_sid`（HttpOnly，7 天）
- 正式環境請設 `ALLOW_DEV_LOGIN=0` 關閉「開發用 ID 登入」

## 正式部署時

Redirect 改成正式 API 網址，例如：

```
https://api.your-domain.com/api/auth/discord/callback
```

並設定：

```
WEB_ORIGIN=https://your-game.netlify.app
DISCORD_REDIRECT_URI=https://api.your-domain.com/api/auth/discord/callback
ALLOW_DEV_LOGIN=0
```
