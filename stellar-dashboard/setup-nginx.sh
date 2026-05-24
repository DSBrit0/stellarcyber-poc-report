#!/usr/bin/env bash
# setup-nginx.sh — Configura Nginx + Let's Encrypt para o Stellar Cyber POC Dashboard
#
# Uso:  sudo bash setup-nginx.sh
# OS:   Ubuntu 20.04+ / Debian 11+
#
# Fluxo em 2 fases (evita falha do nginx -t antes do certificado existir):
#   Fase 1 — HTTP-only: nginx valida o domínio para o Certbot (ACME challenge)
#   Fase 2 — SSL full:  config final com HTTPS gerada a partir de nginx.conf.template
#
# Pode ser rerrodado com segurança: detecta se o cert já existe e pula a Fase 1.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ─── Cores ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERRO]${NC}  $*" >&2; exit 1; }

# ─── Root check ──────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && die "Execute como root ou com sudo:\n  sudo bash $0"

# ─── Paths ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
TEMPLATE="$SCRIPT_DIR/nginx.conf.template"

[[ -f "$TEMPLATE" ]] || die "Template não encontrado: $TEMPLATE\nGaranta que está executando o script dentro do diretório do projeto."

# ─── Carregar .env existente ──────────────────────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# ─── Defaults ────────────────────────────────────────────────────────────────
DEFAULT_DOMAIN="${DOMAIN:-stellarcyber.sekuritylab.com}"
DEFAULT_PORT="${PORT:-8080}"
DEFAULT_EMAIL="${LETSENCRYPT_EMAIL:-}"

# ─── Banner ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║      Stellar Cyber POC Dashboard — Nginx + SSL Setup         ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Diretório do projeto : ${BOLD}$SCRIPT_DIR${NC}"
echo ""

# ─── Prompts interativos ──────────────────────────────────────────────────────
read -rp "  Domínio para HTTPS   [${DEFAULT_DOMAIN}]: " INPUT_DOMAIN
DOMAIN="${INPUT_DOMAIN:-$DEFAULT_DOMAIN}"

read -rp "  E-mail Let's Encrypt [${DEFAULT_EMAIL:-obrigatório}]: " INPUT_EMAIL
LETSENCRYPT_EMAIL="${INPUT_EMAIL:-$DEFAULT_EMAIL}"
[[ -z "$LETSENCRYPT_EMAIL" ]] && die "E-mail é obrigatório para registro no Let's Encrypt."

NODE_PORT="$DEFAULT_PORT"
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
echo ""

# ─── Verificações pré-voo ─────────────────────────────────────────────────────
info "Executando verificações antes de continuar..."
echo ""

# Node.js app rodando?
if curl -sf "http://127.0.0.1:${NODE_PORT}/health" &>/dev/null ||
   curl -sf "http://127.0.0.1:${NODE_PORT}"        &>/dev/null; then
  success "Node.js : app respondendo na porta $NODE_PORT"
else
  warn "Node.js : app NÃO detectado na porta $NODE_PORT"
  warn "          Rode antes:  pm2 start server.js --name stellar-dashboard"
  warn "          O Nginx ficará ativo mas sem backend até o app subir."
fi

# DNS aponta para este servidor?
SERVER_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null \
            || hostname -I 2>/dev/null | awk '{print $1}' \
            || echo "desconhecido")
RESOLVED_IP=$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1}' | head -1 \
              || dig +short "$DOMAIN" A 2>/dev/null | head -1 \
              || echo "")

if [[ -z "$RESOLVED_IP" ]]; then
  warn "DNS    : Não foi possível resolver '$DOMAIN'."
  warn "         O Certbot vai falhar se o DNS não estiver configurado."
elif [[ "$RESOLVED_IP" == "$SERVER_IP" ]]; then
  success "DNS    : $DOMAIN → $RESOLVED_IP  ✓ (corresponde ao IP do servidor)"
else
  warn "DNS    : $DOMAIN → $RESOLVED_IP  |  IP deste servidor: $SERVER_IP"
  warn "         Se os IPs não baterem o Certbot vai falhar na validação."
fi

echo ""
info "Domínio       : $DOMAIN"
info "Porta Node.js : $NODE_PORT  (altere PORT= no .env para mudar)"
info "E-mail cert   : $LETSENCRYPT_EMAIL"
echo ""

read -rp "  Confirmar e continuar? [s/N]: " CONFIRM
[[ "${CONFIRM,,}" == "s" ]] || { echo "Cancelado."; exit 0; }
echo ""

# ─── Persistir no .env ───────────────────────────────────────────────────────
_env_set() {
  local key="$1" val="$2"
  if [[ -f "$ENV_FILE" ]] && grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}
[[ -f "$ENV_FILE" ]] || cp "$SCRIPT_DIR/.env.example" "$ENV_FILE" 2>/dev/null || touch "$ENV_FILE"
_env_set "DOMAIN"            "$DOMAIN"
_env_set "LETSENCRYPT_EMAIL" "$LETSENCRYPT_EMAIL"
success ".env atualizado  (DOMAIN, LETSENCRYPT_EMAIL)"

# ─── Instalar nginx ───────────────────────────────────────────────────────────
if command -v nginx &>/dev/null; then
  success "nginx já instalado : $(nginx -v 2>&1)"
else
  info "Instalando nginx..."
  apt-get update -qq
  apt-get install -y nginx
  systemctl enable nginx
  systemctl start nginx
  success "nginx instalado"
fi

# ─── Instalar certbot ─────────────────────────────────────────────────────────
if command -v certbot &>/dev/null; then
  success "certbot já instalado : $(certbot --version 2>&1)"
else
  info "Instalando certbot + plugin webroot..."
  apt-get install -y certbot
  success "certbot instalado"
fi

# ─── Abrir portas no ufw (se ativo) ──────────────────────────────────────────
if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 80/tcp  > /dev/null
  ufw allow 443/tcp > /dev/null
  success "ufw : portas 80 e 443 liberadas"
fi

# ─── Paths da configuração Nginx ─────────────────────────────────────────────
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
NGINX_ENABLED="/etc/nginx/sites-enabled/$DOMAIN"

# Remove site default do Nginx para evitar conflito na porta 80
if [[ -L /etc/nginx/sites-enabled/default ]]; then
  warn "Removendo site 'default' do Nginx (conflito na porta 80)"
  rm /etc/nginx/sites-enabled/default
fi

# ─────────────────────────────────────────────────────────────────────────────
# FASE 1 — Config HTTP-only (permite que o Certbot valide o domínio via ACME)
#
# IMPORTANTE: o nginx -t FALHA se o template SSL for aplicado antes do cert
# existir. Por isso geramos uma config HTTP-only aqui e aplicamos o template
# completo apenas DEPOIS de obter o certificado (Fase 2).
# ─────────────────────────────────────────────────────────────────────────────
if [[ -f "$CERT_DIR/fullchain.pem" ]]; then
  info "Certificado já existe em $CERT_DIR — pulando Fase 1"
  CERT_IS_NEW=false
else
  CERT_IS_NEW=true
  info "FASE 1 — Configurando Nginx HTTP para validação do domínio..."

  mkdir -p /var/www/html

  # Config HTTP-only gerada inline — NÃO usa o template SSL (evita nginx -t fail)
  cat > "$NGINX_CONF" << HTTPCONF
# Fase 1 — temporária: somente HTTP para Let's Encrypt ACME challenge
# Este arquivo será substituído pela config SSL após obter o certificado.
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # Diretório de validação ACME (Let's Encrypt)
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Proxy para o app enquanto aguarda o certificado
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

  # Ativar site
  [[ ! -L "$NGINX_ENABLED" ]] && ln -s "$NGINX_CONF" "$NGINX_ENABLED"

  nginx -t || die "Config HTTP inválida — verifique o arquivo: $NGINX_CONF"
  systemctl reload nginx
  success "Nginx recarregado (HTTP)"

  # ── Obter certificado Let's Encrypt (webroot) ───────────────────────────────
  info "FASE 1 — Obtendo certificado SSL para: $DOMAIN"
  certbot certonly \
    --webroot \
    --webroot-path /var/www/html \
    --non-interactive \
    --agree-tos \
    --email  "$LETSENCRYPT_EMAIL" \
    -d       "$DOMAIN"

  success "Certificado obtido: $CERT_DIR"
fi

# ─────────────────────────────────────────────────────────────────────────────
# FASE 2 — Config SSL completa gerada a partir do nginx.conf.template
# Agora os arquivos de certificado existem → nginx -t vai passar.
# ─────────────────────────────────────────────────────────────────────────────
info "FASE 2 — Aplicando configuração SSL final a partir do template..."

sed \
  -e "s|{{DOMAIN}}|${DOMAIN}|g"    \
  -e "s|{{NODE_PORT}}|${NODE_PORT}|g" \
  "$TEMPLATE" > "$NGINX_CONF"

# Ativar site (garante que o symlink existe mesmo em re-runs)
[[ ! -L "$NGINX_ENABLED" ]] && ln -s "$NGINX_CONF" "$NGINX_ENABLED"

nginx -t || die "Configuração Nginx SSL inválida.\nVerifique: $NGINX_CONF"
success "Configuração SSL válida"

systemctl reload nginx
success "Nginx recarregado com HTTPS ativo"

# ─── Renovação automática ─────────────────────────────────────────────────────
if [[ "$CERT_IS_NEW" == "true" ]]; then
  if systemctl is-active --quiet certbot.timer 2>/dev/null; then
    success "Renovação automática : certbot.timer ativo (systemd)"
  else
    # Fallback: cron diário às 03:00 com reload do nginx após renovação
    if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
      (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --deploy-hook 'systemctl reload nginx'") | crontab -
      success "Renovação automática : cron configurado (diário às 03:00)"
    else
      success "Renovação automática : cron já configurado"
    fi
  fi
fi

# ─── Resumo final ─────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║              Setup concluído com sucesso! ✓                  ║${NC}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║${NC}  URL pública   : ${BOLD}https://$DOMAIN${NC}"
echo -e "${GREEN}${BOLD}║${NC}  Certificado   : $CERT_DIR"
echo -e "${GREEN}${BOLD}║${NC}  Config Nginx  : $NGINX_CONF"
echo -e "${GREEN}${BOLD}║${NC}  Porta Node.js : $NODE_PORT  (interno)"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
info "Verificar Nginx       : systemctl status nginx"
info "Testar renovação cert : certbot renew --dry-run"
info "Rerodar setup         : sudo bash $0"
echo ""
