#!/usr/bin/env bash
# update.sh — Deploy do Stellar Cyber POC Dashboard
#
# Uso: bash update.sh
#
# Ordem de operações (minimiza downtime com Nginx):
#   1. git pull          — atualiza código (app ainda rodando)
#   2. npm install       — instala deps    (app ainda rodando)
#   3. npm run build     — gera dist/      (app ainda rodando)
#   4. pm2 restart       — reinicia app    (~3s de downtime)
#   5. health check      — confirma que o Nginx consegue chegar no app
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP="stellar-dashboard"
DIR="$(cd "$(dirname "$0")" && pwd)"

# ─── Carregar .env para obter PORT ───────────────────────────────────────────
if [[ -f "$DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$DIR/.env"
  set +a
fi
PORT="${PORT:-8080}"

# ─── Funções de output ────────────────────────────────────────────────────────
ok()   { echo "==> $*"; }
warn() { echo "    [WARN] $*"; }
die()  { echo "    [ERRO] $*" >&2; exit 1; }

# ─── 1. Atualizar repositório ─────────────────────────────────────────────────
ok "Atualizando repositório..."
cd "$DIR"
git pull origin main

# ─── 2. Instalar dependências ─────────────────────────────────────────────────
ok "Instalando dependências..."
npm install

# ─── 3. Gerar build de produção ───────────────────────────────────────────────
ok "Gerando build..."
npm run build

# Verificar se o build gerou o arquivo esperado
[[ -f "$DIR/dist/index.html" ]] || die "Build falhou — dist/index.html não encontrado."
ok "Build concluído: $(du -sh "$DIR/dist" | cut -f1) em dist/"

# ─── 4. Reiniciar app via PM2 ─────────────────────────────────────────────────
# Nota: restart em vez de stop+start reduz downtime de minutos para ~3 segundos.
# --update-env garante que mudanças no .env sejam carregadas.
ok "Reiniciando aplicação..."
if pm2 describe "$APP" &>/dev/null; then
  pm2 restart "$APP" --update-env
else
  pm2 start server.js --name "$APP"
fi

ok "Salvando estado do PM2..."
pm2 save

# ─── 5. Health check ─────────────────────────────────────────────────────────
# Confirma que o app voltou a responder antes de declarar sucesso.
# Nginx retornaria 502 se esta checagem falhar.
ok "Verificando resposta do servidor (porta $PORT)..."
ATTEMPTS=30
for i in $(seq 1 $ATTEMPTS); do
  if curl -sf "http://127.0.0.1:${PORT}/health" &>/dev/null ||
     curl -sf "http://127.0.0.1:${PORT}"        &>/dev/null; then
    ok "App respondendo OK  (tentativa $i/${ATTEMPTS})"
    break
  fi
  if [[ $i -eq $ATTEMPTS ]]; then
    warn "App não respondeu após ${ATTEMPTS}s — coletando diagnóstico..."
    echo ""
    pm2 status
    echo ""
    pm2 logs "$APP" --lines 30 --nostream 2>/dev/null || true
    echo ""
    ss -tlnp 2>/dev/null | grep ":${PORT}" || echo "(nenhum processo na porta $PORT)"
    echo ""
    warn "Se o app crashar em loop: veja os logs [FATAL] acima para o erro real"
    warn "Teste manual: node server.js"
    exit 1
  fi
  sleep 1
done

# ─── Resumo ───────────────────────────────────────────────────────────────────
echo ""
pm2 show "$APP" | grep -E "status|restarts|uptime" || true
echo ""
echo "✓ Deploy concluído — https://${DOMAIN:-localhost}"
