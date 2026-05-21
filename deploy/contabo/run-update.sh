#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/lotto"

cd "$APP_DIR"

if command -v chromium >/dev/null 2>&1; then
  export CHROMIUM_PATH="$(command -v chromium)"
elif command -v chromium-browser >/dev/null 2>&1; then
  export CHROMIUM_PATH="$(command -v chromium-browser)"
fi

/usr/bin/npm run update:data
