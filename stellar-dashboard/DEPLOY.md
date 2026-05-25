# Stellar Cyber POC Dashboard — Guia de Deploy e Manutenção

Este documento cobre o primeiro deploy, a configuração do Nginx com HTTPS e o processo de atualização contínua.

---

## Índice

1. [Pré-requisitos](#1-pré-requisitos)
2. [Primeiro Deploy](#2-primeiro-deploy)
3. [Configurar Nginx + HTTPS](#3-configurar-nginx--https)
4. [Atualizar o Dashboard](#4-atualizar-o-dashboard)
5. [Arquitetura do Servidor](#5-arquitetura-do-servidor)
6. [Alterar Domínio](#6-alterar-domínio)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Pré-requisitos

### Servidor

| Item | Versão mínima | Verificar |
|---|---|---|
| Ubuntu / Debian | 20.04 / 11 | `lsb_release -a` |
| Node.js | 18+ | `node -v` |
| npm | 9+ | `npm -v` |
| PM2 | qualquer | `pm2 -v` |
| Git | qualquer | `git --version` |

**Instalar Node.js e PM2** (se necessário):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

### DNS

O DNS do domínio deve apontar para o IP público do servidor **antes** de rodar o setup do Nginx.
O Let's Encrypt valida o domínio via HTTP — sem DNS correto, o certificado não é emitido.

```bash
# Verificar se o DNS está propagado
dig stellarcyber.sekuritylab.com +short
# deve retornar o IP público do servidor
```

---

## 2. Primeiro Deploy

```bash
# 1. Clonar o repositório
git clone <url-do-repo> ~/stellarcyber-poc-report
cd ~/stellarcyber-poc-report/stellar-dashboard

# 2. Criar o .env a partir do exemplo
cp .env.example .env

# 3. Instalar dependências e gerar build
npm install
npm run build

# 4. Iniciar o app com PM2
pm2 start server.js --name stellar-dashboard
pm2 save

# 5. Configurar PM2 para iniciar automaticamente no boot ← OBRIGATÓRIO
pm2 startup
# Execute o comando que aparecer na tela (começa com "sudo env PATH=...")
pm2 save
```

> **Por que o `pm2 startup` é obrigatório?**
> Sem ele, o app não sobe após reinicialização do servidor. O Nginx ficaria servindo 502 indefinidamente até intervenção manual.

---

## 3. Configurar Nginx + HTTPS

Execute apenas uma vez por servidor. Pode ser rerrodado com segurança.

```bash
cd ~/stellarcyber-poc-report/stellar-dashboard
sudo bash setup-nginx.sh
```

O script irá perguntar:

```
  Domínio para HTTPS   [stellarcyber.sekuritylab.com]: ↵  (Enter para aceitar)
  E-mail Let's Encrypt [obrigatório]: seu@email.com
  Confirmar e continuar? [s/N]: s
```

### O que o script faz (em ordem)

```
Verificações
  ├── DNS aponta para este servidor?
  └── App Node.js está respondendo na porta 8080?

Instalação
  ├── nginx          (se não instalado)
  └── certbot        (se não instalado)

Atualiza .env
  ├── DOMAIN=...
  ├── LETSENCRYPT_EMAIL=...
  └── HOST=127.0.0.1   ← Node passa a ouvir só em localhost

Firewall (ufw, se ativo)
  ├── Abre  porta 80  (HTTP / ACME challenge)
  ├── Abre  porta 443 (HTTPS)
  └── Fecha porta 8080 (Node não deve ser acessível diretamente)

Fase 1 — HTTP
  ├── Gera config Nginx HTTP-only (sem SSL)
  ├── nginx -t → reload
  └── certbot certonly --webroot → obtém certificado

Fase 2 — HTTPS
  ├── Gera config SSL a partir de nginx.conf.template
  ├── nginx -t → reload
  └── Configura renovação automática (certbot.timer ou cron 03:00)
```

### Após o setup, execute obrigatoriamente:

```bash
# Aplica HOST=127.0.0.1 ao processo Node.js em execução
bash update.sh
```

### Verificar que tudo está funcionando

```bash
# Status do Nginx
systemctl status nginx

# Simular renovação do certificado
certbot renew --dry-run

# Testar HTTPS
curl -I https://stellarcyber.sekuritylab.com
# Deve retornar: HTTP/2 200
```

---

## 4. Atualizar o Dashboard

Para cada nova versão do código:

```bash
cd ~/stellarcyber-poc-report/stellar-dashboard
bash update.sh
```

### O que o script faz (em ordem)

```
git pull origin main          ← app ainda rodando, Nginx OK
npm install                   ← app ainda rodando, Nginx OK
npm run build                 ← app ainda rodando, Nginx OK
verifica dist/index.html      ← falha aqui se o build quebrou
pm2 restart --update-env      ← ~3s de downtime (Nginx: 502 momentâneo)
health check (15 tentativas)  ← confirma que o Nginx voltou a rotear OK
```

> **Por que não há `pm2 stop` antes do build?**
> O script antigo parava o app antes de rodar `npm install` + `npm run build`, causando 1-3 minutos de downtime (502 no Nginx). Na versão atual, o app só para durante o `pm2 restart`, reduzindo o downtime para ~3 segundos.

### Saída esperada

```
==> Atualizando repositório...
==> Instalando dependências...
==> Gerando build...
==> Build concluído: 4.2M em dist/
==> Reiniciando aplicação...
==> Salvando estado do PM2...
==> Verificando resposta do servidor (porta 8080)...
==> App respondendo OK  (tentativa 2/15)

  status    │ online
  restarts  │ 1
  uptime    │ 0s

✓ Deploy concluído — https://stellarcyber.sekuritylab.com
```

---

## 5. Arquitetura do Servidor

```
Internet
    │ HTTPS :443
    ▼
┌─────────────────────────────────┐
│  Nginx (reverse proxy)          │
│  /etc/nginx/sites-available/    │
│  stellarcyber.sekuritylab.com   │
│                                 │
│  ├── SSL termination            │
│  ├── HTTP → HTTPS redirect      │
│  └── Security headers           │
└──────────────┬──────────────────┘
               │ HTTP 127.0.0.1:8080
               ▼
┌─────────────────────────────────┐
│  Node.js / Express (PM2)        │
│  server.js                      │
│                                 │
│  ├── Serve dist/ (React SPA)    │
│  ├── GET /health                │
│  └── /proxy/* → Stellar Cyber   │
└─────────────────────────────────┘
               │ HTTPS (X-Proxy-Target)
               ▼
    Stellar Cyber API
```

**Portas em produção:**

| Porta | Quem escuta | Acessível externamente |
|---|---|---|
| 80 | Nginx | Sim (redireciona para 443) |
| 443 | Nginx | Sim (HTTPS) |
| 8080 | Node.js | **Não** (bloqueado pelo ufw) |

**Arquivos gerados pelo setup:**

| Arquivo | Descrição |
|---|---|
| `/etc/nginx/sites-available/<domínio>` | Config Nginx gerada a partir de `nginx.conf.template` |
| `/etc/nginx/sites-enabled/<domínio>` | Symlink para ativar o site |
| `/etc/letsencrypt/live/<domínio>/` | Certificados Let's Encrypt |
| `.env` | Variáveis do app (não commitado no git) |

---

## 6. Alterar Domínio

Para usar um domínio diferente (outros analistas que clonam o projeto):

```bash
# Opção A — deixar o script perguntar (recomendado)
sudo bash setup-nginx.sh
# → Digite o novo domínio quando solicitado

# Opção B — configurar antes no .env
nano .env
# altere: DOMAIN=meudominio.com
sudo bash setup-nginx.sh
# → pressione Enter para aceitar o valor do .env
```

O script salva o domínio no `.env` automaticamente. Na próxima execução, o valor anterior já aparece como padrão.

---

## 7. Troubleshooting

### Nginx retorna 502 Bad Gateway

O app Node.js não está respondendo.

```bash
pm2 status                        # ver estado do processo
pm2 logs stellar-dashboard --lines 50   # ver erros recentes
pm2 restart stellar-dashboard     # tentar reiniciar
```

### Nginx retorna 404 para todas as rotas

O build não foi gerado ou está incompleto.

```bash
ls -lh dist/                      # verificar se dist/ existe
bash update.sh                    # regerar build e reiniciar
```

### Certificado expirado

O cron de renovação automática falhou.

```bash
certbot renew --dry-run           # testar renovação
certbot renew                     # renovar manualmente
systemctl reload nginx            # recarregar nginx após renovação
```

### App não sobe após reinicialização do servidor

O `pm2 startup` não foi configurado.

```bash
pm2 startup
# Execute o comando mostrado na tela
pm2 save
```

### Verificar logs do Nginx

```bash
journalctl -u nginx -f            # logs em tempo real
tail -f /var/log/nginx/error.log  # erros
tail -f /var/log/nginx/access.log # acessos
```

### Rerodar o setup do Nginx

O script detecta que o certificado já existe e pula a Fase 1 (não pede novo certificado).

```bash
sudo bash setup-nginx.sh
```
