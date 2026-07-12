#!/usr/bin/env bash
# Deploy grammar-and-rephrase on oracle-ubuntu (pull -> build -> pm2 restart).
# Usage (on the server): bash ~/thinkering/grammar-and-rephrase/deploy.sh
set -euo pipefail

export PATH="$HOME/.nvm/versions/node/v23.10.0/bin:$HOME/.local/share/pnpm:$PATH"
PM2="$(command -v pm2 || echo "$HOME/.local/share/pnpm/global/5/.pnpm/pm2@6.0.5/node_modules/pm2/bin/pm2")"
APP=grammar-and-rephrase
APP_DIR="$HOME/thinkering/$APP"

cd "$APP_DIR"
git pull --ff-only
npm ci
npm run build

if "$PM2" describe "$APP" >/dev/null 2>&1; then
  "$PM2" restart "$APP" --update-env
else
  "$PM2" start dist/server.cjs --name "$APP"
fi
"$PM2" save
echo "Deployed. Health check:"
sleep 2
curl -sf http://127.0.0.1:${PORT:-3000}/api/config && echo