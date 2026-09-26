import 'dotenv/config'
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import https from 'https'
import dns from 'dns'
import net from 'net'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PORT = process.env.PORT || 8080
const HOST = process.env.HOST || '0.0.0.0'

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err.message)
  console.error(err.stack)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason instanceof Error ? reason.stack : reason)
  process.exit(1)
})

const app = express()

// ── Static build ──────────────────────────────────────────────────────────────
app.use(express.static(join(__dirname, 'dist')))

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// ── Proxy target guard ────────────────────────────────────────────────────────
// A URL da instância varia por cliente (domínio próprio ou IP público), então não
// há allowlist de domínios. Em vez disso: só HTTPS, só a API do Stellar Cyber, e
// nenhum destino em rede interna (loopback, privada, link-local, metadata de cloud).
const API_PATH_PREFIX = '/connect/api/v1/'

const BLOCKED_NETS = new net.BlockList()
for (const [addr, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) BLOCKED_NETS.addSubnet(addr, prefix, 'ipv4')
for (const [addr, prefix] of [
  ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
]) BLOCKED_NETS.addSubnet(addr, prefix, 'ipv6')

function isBlockedIp(ip) {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)  // IPv4-mapped IPv6
  if (mapped) ip = mapped[1]
  return BLOCKED_NETS.check(ip, net.isIPv6(ip) ? 'ipv6' : 'ipv4')
}

function parseTarget(raw) {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return url
  } catch {
    return null
  }
}

// DNS é validado no momento da conexão (não só na checagem inicial), o que também
// impede DNS rebinding. IPs literais não passam por lookup — são checados no guard.
function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) return callback(err)
    const list = Array.isArray(address) ? address : [{ address }]
    const bad  = list.find(a => isBlockedIp(a.address))
    if (bad) {
      const blocked = new Error(`Target resolves to a blocked address (${bad.address})`)
      blocked.code  = 'EBLOCKED'
      return callback(blocked)
    }
    callback(null, address, family)
  })
}

const proxyAgent = new https.Agent({ lookup: safeLookup })

// ── Dynamic reverse proxy ─────────────────────────────────────────────────────
// Frontend envia /proxy/* com header X-Proxy-Target: <url-da-instancia>
// O servidor repassa a requisição server-side, evitando bloqueio de CORS.
app.use(
  '/proxy',
  (req, res, next) => {
    if (!req.headers['x-proxy-target']) {
      res.status(400).json({ error: 'Missing X-Proxy-Target header' })
      return
    }
    const target = parseTarget(req.headers['x-proxy-target'])
    if (!target) {
      res.status(400).json({ error: 'Invalid X-Proxy-Target: only https:// URLs are allowed' })
      return
    }
    const host = target.hostname.replace(/^\[|\]$/g, '')
    if (net.isIP(host) && isBlockedIp(host)) {
      res.status(403).json({ error: 'X-Proxy-Target points to an internal address' })
      return
    }
    if (!req.path.startsWith(API_PATH_PREFIX) || /\.\.|%2e%2e/i.test(req.url)) {
      res.status(403).json({ error: 'Path not allowed through proxy' })
      return
    }
    req.proxyTarget = target.origin
    next()
  },
  createProxyMiddleware({
    target: 'https://localhost',
    router: req => req.proxyTarget,
    agent:  proxyAgent,
    changeOrigin: true,
    pathRewrite: { '^/proxy': '' },
    proxyTimeout: 85_000,
    timeout:      85_000,
    on: {
      proxyReq(proxyReq) {
        proxyReq.removeHeader('x-proxy-target')
      },
      error(err, _req, res) {
        if (!res.headersSent) {
          res.writeHead(err.code === 'EBLOCKED' ? 403 : 502, { 'Content-Type': 'application/json' })
        }
        res.end(JSON.stringify({ error: err.message }))
      },
    },
  })
)

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

// ── Start ─────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, HOST, () => {
  console.log(`Stellar Dashboard → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`)
  console.log(`Acessível em → http://<ip-do-servidor>:${PORT}`)
})

// Graceful shutdown: releases port 8080 before PM2 starts the new process.
// closeAllConnections() forces Nginx keep-alive connections to close immediately
// (without it, server.close() hangs until PM2 sends SIGKILL, racing with the new process)
process.on('SIGTERM', () => {
  server.closeAllConnections?.()             // Node 18.2+ — force-close keep-alive sockets
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 5000).unref()  // safety: exit if close hangs
})
