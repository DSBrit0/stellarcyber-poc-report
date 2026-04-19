import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = 8080

const app = express()

// ── Static build ─────────────────────────────────────────────────────────────
app.use(express.static(join(__dirname, 'dist')))

// ── Dynamic reverse proxy ─────────────────────────────────────────────────────
// Frontend requests /proxy/* with header X-Proxy-Target: <stellar-cyber-url>
// Server strips /proxy and forwards the request server-side (no browser CORS).
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
    target: 'http://localhost',           // overridden per-request by router
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

// ── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Stellar Dashboard → http://localhost:${PORT}`)
})
