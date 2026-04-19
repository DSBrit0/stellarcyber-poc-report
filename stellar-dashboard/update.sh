#!/bin/bash
set -e

APP="stellar-dashboard"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Parando aplicação..."
pm2 stop "$APP" 2>/dev/null || true

echo "==> Atualizando repositório..."
cd "$DIR"
git pull origin main

echo "==> Instalando dependências..."
npm install --omit=dev

echo "==> Gerando build..."
npm run build

echo "==> Iniciando aplicação..."
pm2 start server.js --name "$APP" 2>/dev/null || pm2 restart "$APP"

echo "==> Salvando estado do PM2..."
pm2 save

echo ""
pm2 show "$APP" | grep -E "status|restarts|uptime"
echo ""
echo "✓ Deploy concluído."
