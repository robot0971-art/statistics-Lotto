#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/lotto"
NGINX_AVAILABLE="/etc/nginx/sites-available/lotto"
NGINX_ENABLED="/etc/nginx/sites-enabled/lotto"
CRON_FILE="/etc/cron.d/lotto-update"

echo "[1/7] Installing system packages..."
apt update
apt install -y nginx curl ca-certificates

if ! command -v node >/dev/null 2>&1; then
  echo "[2/7] Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
else
  echo "[2/7] Node.js already installed."
fi

echo "[3/7] Installing Chromium dependencies for Puppeteer..."
apt install -y \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libu2f-udev \
  libvulkan1 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxrandr2 \
  xdg-utils

if apt-cache show chromium >/dev/null 2>&1; then
  apt install -y chromium
elif apt-cache show chromium-browser >/dev/null 2>&1; then
  apt install -y chromium-browser
else
  echo "Could not find chromium package in apt repositories."
  echo "Install Chromium manually, then rerun this script if update:data fails."
fi

echo "[4/7] Creating app directory..."
mkdir -p "$APP_DIR"

if [ ! -f "$APP_DIR/package.json" ]; then
  echo "Project files are not present in $APP_DIR."
  echo "Copy the project into $APP_DIR first, then run this script again."
  exit 1
fi

echo "[5/7] Installing npm dependencies..."
cd "$APP_DIR"
npm install --omit=optional

echo "[6/7] Installing nginx site config..."
cp deploy/contabo/nginx-lotto.conf "$NGINX_AVAILABLE"
ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx

echo "[7/7] Installing cron schedule..."
cp deploy/contabo/lotto-update.cron "$CRON_FILE"
chmod 644 "$CRON_FILE"
chmod +x deploy/contabo/run-update.sh

echo "Contabo setup complete."
echo "Site root: $APP_DIR"
echo "Nginx config: $NGINX_AVAILABLE"
echo "Cron file: $CRON_FILE"
echo "Log file: /var/log/lotto-update.log"
