import 'dotenv/config'
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PORT = process.env.PORT || 8080
const HOST = process.env.HOST || '0.0.0.0'

const app = express()

// ── Static build ──────────────────────────────────────────────────────────────
app.use(express.static(join(__dirname, 'dist')))

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

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
    next()
  },
  createProxyMiddleware({
    target: 'http://localhost',
    router: req => req.headers['x-proxy-target'],
    changeOrigin: true,
    pathRewrite: { '^/proxy': '' },
    on: {
      proxyReq(proxyReq) {
        proxyReq.removeHeader('x-proxy-target')
      },
      error(err, _req, res) {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' })
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
app.listen(PORT, HOST, () => {
  console.log(`Stellar Dashboard → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`)
  console.log(`Acessível em → http://<ip-do-servidor>:${PORT}`)
})
