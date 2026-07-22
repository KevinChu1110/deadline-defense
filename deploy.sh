#!/usr/bin/env bash
# 部署 Artale Web（前端 dist + API）到 sit-kevin
# 對外：https://maplestory-word.duckdns.org/defense/
#
# 用法：
#   ./deploy.sh           建置 + rsync + PM2 重啟 + nginx
#   ./deploy.sh --fast    跳過建置（用現有 dist/）
set -euo pipefail
cd "$(dirname "$0")"

REMOTE="${REMOTE:-sit-kevin}"
REMOTE_DIR="${REMOTE_DIR:-/home/kevin.chu/artale-web}"
PM2_BIN_REMOTE='export PATH="$HOME/.npm-global/bin:$PATH"; pm2'
VITE_BASE="${VITE_BASE:-/defense/}"

echo "▶ 目標 ${REMOTE}:${REMOTE_DIR}"
echo "▶ base ${VITE_BASE}"

if [ "${1:-}" != "--fast" ]; then
  echo "▶ Vite build (VITE_BASE=${VITE_BASE})…"
  VITE_BASE="${VITE_BASE}" npm run build
else
  echo "▶ --fast：略過 build"
  [ -d dist ] || { echo "❌ 沒有 dist/"; exit 1; }
fi

echo "▶ rsync server + dist…"
ssh "${REMOTE}" "mkdir -p '${REMOTE_DIR}/server' '${REMOTE_DIR}/dist'"
rsync -az --delete \
  --exclude='node_modules' \
  --exclude='.env' \
  ./server/ "${REMOTE}:${REMOTE_DIR}/server/"
rsync -az --delete ./dist/ "${REMOTE}:${REMOTE_DIR}/dist/"

echo "▶ 遠端 .env / PM2…"
ssh "${REMOTE}" bash -s <<EOF
set -euo pipefail
DIR="${REMOTE_DIR}"
export PATH="\$HOME/.npm-global/bin:\$PATH"

if [ ! -f "\$DIR/server/.env" ]; then
  cat > "\$DIR/server/.env" <<'ENV'
PORT=8787
HOST=127.0.0.1
BOT_ROOT=/home/kevin.chu/artale-bot
PLAYER_DATA_PATH=/home/kevin.chu/artale-bot/player-data.json
STATIC_DIR=/home/kevin.chu/artale-web/dist
# 對外走 ngrok（VPN 擋 DuckDNS）；與 artale-games 共用固定網域
WEB_ORIGIN=https://primary-marmoset-publicly.ngrok-free.app/defense
DISCORD_REDIRECT_URI=https://primary-marmoset-publicly.ngrok-free.app/defense/api/auth/discord/callback
# ⚠️ 不要在正式環境開 ALLOW_DEV_LOGIN：開了等於任何人都能用任意 discordId 登入成該玩家
COOKIE_SECURE=1
# CORS 白名單（前端實際所在的 origin）。原本靠「結尾是 .netlify.app 就放行」，
# 但那個子網域任何人都能註冊，等於開放 CSRF 竊取 session。
CORS_ORIGINS=https://maplestory-defense.netlify.app
ENV
  echo "  已建立 server/.env"
else
  grep -q '^BOT_ROOT=' "\$DIR/server/.env" || echo 'BOT_ROOT=/home/kevin.chu/artale-bot' >> "\$DIR/server/.env"
  grep -q '^PLAYER_DATA_PATH=' "\$DIR/server/.env" || echo 'PLAYER_DATA_PATH=/home/kevin.chu/artale-bot/player-data.json' >> "\$DIR/server/.env"
  grep -q '^STATIC_DIR=' "\$DIR/server/.env" || echo 'STATIC_DIR=/home/kevin.chu/artale-web/dist' >> "\$DIR/server/.env"
  grep -q '^HOST=' "\$DIR/server/.env" || echo 'HOST=127.0.0.1' >> "\$DIR/server/.env"
  grep -q '^COOKIE_SECURE=' "\$DIR/server/.env" || echo 'COOKIE_SECURE=1' >> "\$DIR/server/.env"
  grep -q '^CORS_ORIGINS=' "\$DIR/server/.env" || echo 'CORS_ORIGINS=https://maplestory-defense.netlify.app' >> "\$DIR/server/.env"
  # ⚠️ 舊版樣板寫死 ALLOW_DEV_LOGIN=1，等於線上開著「用任意 discordId 登入成該玩家」的後門
  if grep -q '^ALLOW_DEV_LOGIN=1' "\$DIR/server/.env" 2>/dev/null; then
    sed -i 's|^ALLOW_DEV_LOGIN=1|ALLOW_DEV_LOGIN=0|' "\$DIR/server/.env"
    echo "  已關閉線上 dev-login 後門"
  fi
  # 強制改為 ngrok 對外網址（DuckDNS 在 VPN 外會被擋）
  if grep -q 'maplestory-word.duckdns.org' "\$DIR/server/.env" 2>/dev/null; then
    sed -i 's|https://maplestory-word.duckdns.org/defense|https://primary-marmoset-publicly.ngrok-free.app/defense|g' "\$DIR/server/.env"
    echo "  已將 WEB_ORIGIN/Redirect 改為 ngrok"
  fi
  echo "  保留既有 server/.env"
fi

cd "\$DIR/server"
if pm2 describe artale-web-api >/dev/null 2>&1; then
  pm2 restart artale-web-api --update-env
else
  pm2 start src/index.js --name artale-web-api --cwd "\$DIR/server" --update-env
fi
pm2 save 2>/dev/null || true
sleep 1
echo -n "  health: "
curl -sf "http://127.0.0.1:8787/api/health" || { echo FAIL; pm2 logs artale-web-api --lines 30 --nostream; exit 1; }
echo
pm2 list | grep -E "name|artale-web|artale-prd" || pm2 list
EOF

echo "▶ nginx /defense/ …"
ssh "${REMOTE}" bash -s <<'EOF'
set -euo pipefail
CONF=/etc/nginx/conf.d/maplestory-word.conf
python3 <<'PY'
from pathlib import Path
conf_path = Path("/etc/nginx/conf.d/maplestory-word.conf")
text = conf_path.read_text()
snip = """
    # Artale Web（deadline-defense）— deploy.sh 維護
    location = /defense {
        return 301 /defense/;
    }
    location /defense/ {
        proxy_pass http://127.0.0.1:8787/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Cookie $http_cookie;
        proxy_pass_header Set-Cookie;
        proxy_read_timeout 120s;
    }

"""
marker = "    # Artale Web（deadline-defense）"
if marker in text:
    start = text.find(marker)
    # 刪到下一個同縮排 location（非 defense）
    rest = text[start:]
    # 找下一個 "\n    location " 但不是 defense
    import re
    m = re.search(r"\n    location (?!/defense)(?!= /defense)", rest[1:])
    if not m:
        raise SystemExit("cannot find end of artale block")
    end = start + 1 + m.start()
    text = text[:start] + snip + text[end:]
    print("  nginx snippet updated")
else:
    # 插入在 443 server 的 location /websocket 或 location / 前
    # 取第二個 server_name maplestory-word（通常為 443）
    key = "server_name maplestory-word.duckdns.org;"
    first = text.find(key)
    second = text.find(key, first + 1) if first >= 0 else -1
    base = second if second >= 0 else first
    if base < 0:
        raise SystemExit("server_name not found")
    # 在此 server 內找 websocket 或 location /
    chunk = text[base:]
    for anchor in ("\n    location /websocket", "\n    location / {"):
        pos = chunk.find(anchor)
        if pos >= 0:
            abs_pos = base + pos + 1  # keep leading newline out
            # insert before anchor (include the newline of anchor)
            text = text[: base + pos + 1] + snip + text[base + pos + 1 :]
            print("  nginx snippet inserted before", anchor.strip())
            break
    else:
        raise SystemExit("insert point not found")
conf_path.write_text(text)
PY
sudo -n nginx -t
sudo -n systemctl reload nginx
echo "  nginx reloaded"
EOF

echo ""
echo "✅ 部署完成"
echo "   👉 https://primary-marmoset-publicly.ngrok-free.app/defense/"
echo "   👉 https://primary-marmoset-publicly.ngrok-free.app/defense/api/health"
echo "   （經 artale-games:2567 反代 /defense → artale-web-api:8787 + 既有 ngrok）"
echo ""
echo "   Discord OAuth Redirect（若要用）："
echo "   https://primary-marmoset-publicly.ngrok-free.app/defense/api/auth/discord/callback"
echo "   編輯遠端 ${REMOTE_DIR}/server/.env 填 DISCORD_CLIENT_ID / SECRET"
