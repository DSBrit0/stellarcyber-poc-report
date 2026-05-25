#!/usr/bin/env bash
# deploy.sh — Stellar Cyber POC Dashboard
#
# Script unificado: configura o servidor ou faz deploy de nova versão.
#
# Uso interativo:  bash deploy.sh
# Uso direto:      bash deploy.sh 1   → Configurar Nginx + SSL
#                  bash deploy.sh 2   → Atualizar dashboard
#
# OS suportado: Ubuntu 20.04+ / Debian 11+
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ─── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SELF="$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"
ENV_FILE="$SCRIPT_DIR/.env"
TEMPLATE="$SCRIPT_DIR/nginx.conf.template"
APP="stellar-dashboard"

# ─── Cores e helpers ─────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERRO]${NC}  $*" >&2; exit 1; }
step()    { echo -e "\n${BOLD}──── $* ────${NC}"; }

# ─── Carregar .env ────────────────────────────────────────────────────────────
_load_env() {
  if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
  fi
}

_env_set() {
  local key="$1" val="$2"
  if [[ -f "$ENV_FILE" ]] && grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

# ─── Banner ───────────────────────────────────────────────────────────────────
_banner() {
  echo ""
  echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}${BOLD}║         Stellar Cyber POC Dashboard — Deploy Manager         ║${NC}"
  echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  Diretório : ${BOLD}$SCRIPT_DIR${NC}"
  echo -e "  Domínio   : ${BOLD}${DOMAIN:-não configurado}${NC}"
  echo -e "  Porta     : ${BOLD}${PORT:-8080}${NC}"
  echo ""
}

# ══════════════════════════════════════════════════════════════════════════════
# OPÇÃO 1 — Configurar Nginx + Let's Encrypt
# ══════════════════════════════════════════════════════════════════════════════
run_setup() {
  [[ -f "$TEMPLATE" ]] || die "Template não encontrado: $TEMPLATE\nGaranta que está no diretório correto do projeto."

  _load_env
  local DEFAULT_DOMAIN="${DOMAIN:-stellarcyber.sekuritylab.com}"
  local DEFAULT_PORT="${PORT:-8080}"
  local DEFAULT_EMAIL="${LETSENCRYPT_EMAIL:-}"

  echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}${BOLD}║           Opção 1 — Configurar Nginx + SSL                   ║${NC}"
  echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  # ── Prompts ──────────────────────────────────────────────────────────────────
  read -rp "  Domínio para HTTPS   [${DEFAULT_DOMAIN}]: " INPUT_DOMAIN
  local DOMAIN="${INPUT_DOMAIN:-$DEFAULT_DOMAIN}"

  read -rp "  E-mail Let's Encrypt [${DEFAULT_EMAIL:-obrigatório}]: " INPUT_EMAIL
  local LETSENCRYPT_EMAIL="${INPUT_EMAIL:-$DEFAULT_EMAIL}"
  [[ -z "$LETSENCRYPT_EMAIL" ]] && die "E-mail é obrigatório para registro no Let's Encrypt."

  local NODE_PORT="$DEFAULT_PORT"
  local CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
  echo ""

  # ── Verificações pré-voo ─────────────────────────────────────────────────────
  step "Verificações"

  if curl -sf "http://127.0.0.1:${NODE_PORT}/health" &>/dev/null ||
     curl -sf "http://127.0.0.1:${NODE_PORT}"        &>/dev/null; then
    success "Node.js : app respondendo na porta $NODE_PORT"
  else
    warn "Node.js : app NÃO detectado na porta $NODE_PORT"
    warn "          Rode: pm2 start server.js --name $APP"
    warn "          O Nginx ficará ativo mas sem backend até o app subir."
  fi

  local SERVER_IP
  SERVER_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null \
              || hostname -I 2>/dev/null | awk '{print $1}' \
              || echo "desconhecido")
  local RESOLVED_IP
  RESOLVED_IP=$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1}' | head -1 \
                || dig +short "$DOMAIN" A 2>/dev/null | head -1 \
                || echo "")

  if   [[ -z "$RESOLVED_IP" ]];              then warn "DNS : '$DOMAIN' não resolve — Certbot pode falhar."
  elif [[ "$RESOLVED_IP" == "$SERVER_IP" ]]; then success "DNS : $DOMAIN → $RESOLVED_IP ✓"
  else warn "DNS : $DOMAIN → $RESOLVED_IP | IP do servidor: $SERVER_IP"
  fi

  echo ""
  info "Domínio       : $DOMAIN"
  info "Porta Node.js : $NODE_PORT"
  info "E-mail cert   : $LETSENCRYPT_EMAIL"
  echo ""

  read -rp "  Confirmar e continuar? [s/N]: " CONFIRM
  [[ "${CONFIRM,,}" == "s" ]] || { echo "Cancelado."; return 0; }
  echo ""

  # ── Persistir no .env ────────────────────────────────────────────────────────
  [[ -f "$ENV_FILE" ]] || cp "$SCRIPT_DIR/.env.example" "$ENV_FILE" 2>/dev/null || touch "$ENV_FILE"
  _env_set "DOMAIN"            "$DOMAIN"
  _env_set "LETSENCRYPT_EMAIL" "$LETSENCRYPT_EMAIL"
  _env_set "HOST"              "127.0.0.1"
  success ".env atualizado (DOMAIN, LETSENCRYPT_EMAIL, HOST=127.0.0.1)"
  warn "HOST alterado para 127.0.0.1 — rode a opção 2 após o setup para aplicar."

  # ── Instalar nginx ────────────────────────────────────────────────────────────
  step "Instalando dependências do sistema"
  if command -v nginx &>/dev/null; then
    success "nginx já instalado : $(nginx -v 2>&1)"
  else
    info "Instalando nginx..."
    apt-get update -qq && apt-get install -y nginx
    systemctl enable nginx && systemctl start nginx
    success "nginx instalado"
  fi

  if command -v certbot &>/dev/null; then
    success "certbot já instalado : $(certbot --version 2>&1)"
  else
    info "Instalando certbot..."
    apt-get install -y certbot
    success "certbot instalado"
  fi

  # ── Firewall ──────────────────────────────────────────────────────────────────
  if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
    ufw allow 80/tcp  > /dev/null
    ufw allow 443/tcp > /dev/null
    ufw deny  "${NODE_PORT}"/tcp > /dev/null 2>&1 || true
    success "ufw: 80/443 abertas | porta $NODE_PORT bloqueada externamente"
  fi

  # ── Nginx paths ───────────────────────────────────────────────────────────────
  local NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
  local NGINX_ENABLED="/etc/nginx/sites-enabled/$DOMAIN"
  [[ -L /etc/nginx/sites-enabled/default ]] && \
    rm /etc/nginx/sites-enabled/default && warn "Site 'default' do Nginx removido"

  # ── Fase 1 — HTTP (se certificado ainda não existe) ───────────────────────────
  local CERT_IS_NEW=false
  if [[ -f "$CERT_DIR/fullchain.pem" ]]; then
    info "Certificado já existe em $CERT_DIR — pulando Fase 1"
  else
    CERT_IS_NEW=true
    step "Fase 1 — Nginx HTTP + obtenção do certificado"
    mkdir -p /var/www/html

    cat > "$NGINX_CONF" << HTTPCONF
# Temporário: HTTP-only para validação Let's Encrypt (ACME challenge)
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / {
        proxy_pass            http://127.0.0.1:${NODE_PORT};
        proxy_http_version    1.1;
        proxy_set_header      Host              \$host;
        proxy_set_header      X-Real-IP         \$remote_addr;
        proxy_set_header      X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header      X-Forwarded-Proto \$scheme;
        proxy_read_timeout    300s;
        proxy_connect_timeout 75s;
    }
}
HTTPCONF

    [[ ! -L "$NGINX_ENABLED" ]] && ln -s "$NGINX_CONF" "$NGINX_ENABLED"
    nginx -t || die "Config HTTP inválida — verifique: $NGINX_CONF"
    systemctl reload nginx
    success "Nginx HTTP ativo"

    info "Obtendo certificado SSL para: $DOMAIN"
    certbot certonly \
      --webroot --webroot-path /var/www/html \
      --non-interactive --agree-tos \
      --email "$LETSENCRYPT_EMAIL" \
      -d "$DOMAIN"
    success "Certificado obtido: $CERT_DIR"
  fi

  # ── Fase 2 — SSL completo (a partir do template) ──────────────────────────────
  step "Fase 2 — Aplicando configuração SSL final"
  sed \
    -e "s|{{DOMAIN}}|${DOMAIN}|g"    \
    -e "s|{{NODE_PORT}}|${NODE_PORT}|g" \
    "$TEMPLATE" > "$NGINX_CONF"

  [[ ! -L "$NGINX_ENABLED" ]] && ln -s "$NGINX_CONF" "$NGINX_ENABLED"
  nginx -t || die "Configuração SSL inválida — verifique: $NGINX_CONF"
  systemctl reload nginx
  success "Nginx recarregado com HTTPS ativo"

  # ── Renovação automática ──────────────────────────────────────────────────────
  if [[ "$CERT_IS_NEW" == "true" ]]; then
    if systemctl is-active --quiet certbot.timer 2>/dev/null; then
      success "Renovação automática: certbot.timer ativo (systemd)"
    elif ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
      (crontab -l 2>/dev/null; \
       echo "0 3 * * * certbot renew --quiet --deploy-hook 'systemctl reload nginx'") | crontab -
      success "Renovação automática: cron configurado (03:00 diário)"
    else
      success "Renovação automática: cron já configurado"
    fi
  fi

  # ── Resumo ────────────────────────────────────────────────────────────────────
  echo ""
  echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}${BOLD}║                  Setup concluído! ✓                          ║${NC}"
  echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}${BOLD}║${NC}  URL     : ${BOLD}https://$DOMAIN${NC}"
  echo -e "${GREEN}${BOLD}║${NC}  Cert    : $CERT_DIR"
  echo -e "${GREEN}${BOLD}║${NC}  Nginx   : $NGINX_CONF"
  echo -e "${GREEN}${BOLD}║${NC}  Porta   : $NODE_PORT (interno, bloqueado externamente)"
  echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  warn "PRÓXIMOS PASSOS obrigatórios:"
  warn "  1. Configurar PM2 no boot:"
  warn "     pm2 startup  →  copie e execute o comando que aparecer"
  warn "     pm2 save"
  warn "  2. Aplicar HOST=127.0.0.1 ao Node.js:"
  warn "     bash deploy.sh 2"
  echo ""
}

# ══════════════════════════════════════════════════════════════════════════════
# OPÇÃO 2 — Atualizar dashboard (novo commit / nova feature)
# ══════════════════════════════════════════════════════════════════════════════
run_update() {
  _load_env
  local PORT="${PORT:-8080}"
  local DOMAIN="${DOMAIN:-localhost}"

  echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}${BOLD}║           Opção 2 — Atualizar Dashboard                      ║${NC}"
  echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  info "App ainda rodando durante o build — downtime ~3s no restart"
  echo ""

  step "1/5 — Atualizando repositório"
  cd "$SCRIPT_DIR"
  git pull origin main

  step "2/5 — Instalando dependências"
  npm install

  step "3/5 — Gerando build de produção"
  npm run build
  [[ -f "$SCRIPT_DIR/dist/index.html" ]] || die "Build falhou — dist/index.html não encontrado."
  success "Build OK : $(du -sh "$SCRIPT_DIR/dist" | cut -f1) em dist/"

  step "4/5 — Reiniciando app (~3s de downtime)"
  if pm2 describe "$APP" &>/dev/null; then
    pm2 restart "$APP" --update-env
  else
    pm2 start "$SCRIPT_DIR/server.js" --name "$APP"
  fi
  pm2 save

  step "5/5 — Verificando resposta (porta $PORT)"
  local ATTEMPTS=15
  for i in $(seq 1 $ATTEMPTS); do
    if curl -sf "http://127.0.0.1:${PORT}/health" &>/dev/null ||
       curl -sf "http://127.0.0.1:${PORT}"        &>/dev/null; then
      success "App respondendo OK (tentativa $i/$ATTEMPTS)"
      break
    fi
    if [[ $i -eq $ATTEMPTS ]]; then
      warn "App não respondeu após ${ATTEMPTS}s"
      warn "Diagnóstico: pm2 logs $APP"
      warn "Nginx pode estar retornando 502 — verifique: journalctl -u nginx -f"
      exit 1
    fi
    sleep 1
  done

  echo ""
  pm2 show "$APP" 2>/dev/null | grep -E "status|restarts|uptime" || true
  echo ""
  echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}${BOLD}║              Deploy concluído com sucesso! ✓                 ║${NC}"
  echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}${BOLD}║${NC}  URL : ${BOLD}https://${DOMAIN}${NC}"
  echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

# ══════════════════════════════════════════════════════════════════════════════
# Entry point — Menu ou argumento direto
# ══════════════════════════════════════════════════════════════════════════════
_load_env

# Argumento direto (não-interativo): bash deploy.sh 1 ou bash deploy.sh 2
if [[ "${1:-}" =~ ^[12]$ ]]; then
  CHOICE="${1}"
else
  # Menu interativo
  _banner
  echo -e "  ${BOLD}1)${NC}  Configurar Nginx + SSL  ${CYAN}(primeiro setup ou reconfigurar domínio)${NC}"
  echo -e "  ${BOLD}2)${NC}  Atualizar dashboard     ${CYAN}(novo commit, nova feature)${NC}"
  echo ""
  read -rp "  Escolha uma opção [1/2]: " CHOICE
  echo ""
fi

case "$CHOICE" in
  1)
    # Opção 1 precisa de root — re-executa com sudo se necessário
    if [[ $EUID -ne 0 ]]; then
      warn "Configurar Nginx requer sudo. Relançando com sudo..."
      exec sudo bash "$SELF" 1
    fi
    run_setup
    ;;
  2)
    run_update
    ;;
  *)
    die "Opção inválida: '$CHOICE'. Use 1 ou 2."
    ;;
esac
