import axios from 'axios'
import { HTTP, RETRYABLE_STATUS } from './endpoints'
import { warn } from '../utils/logger'

/**
 * Returns an Axios instance that routes all requests through the local /proxy
 * endpoint. The server forwards them to the Stellar Cyber instance server-side,
 * avoiding browser CORS restrictions.
 */
export function createApiClient(auth) {
  const target = auth.url.replace(/\/$/, '')

  const instance = axios.create({
    baseURL: '/proxy/connect/api/v1',
    headers: {
      Authorization:    `Bearer ${auth.token}`,
      'X-Proxy-Target': target,
    },
    timeout: HTTP.TIMEOUT,
  })

  instance.interceptors.request.use(cfg => {
    cfg.headers.Authorization    = `Bearer ${auth.token}`
    cfg.headers['X-Proxy-Target'] = target
    return cfg
  })

  instance.interceptors.response.use(
    res => res,
    async err => {
      const cfg    = err.config
      const status = err.response?.status
      if (!cfg) return Promise.reject(err)

      cfg._retries = cfg._retries ?? 0

      if (cfg._retries < HTTP.MAX_RETRIES && (RETRYABLE_STATUS.has(status) || err.code === 'ECONNABORTED')) {
        cfg._retries++
        const delay = HTTP.RETRY_DELAY * cfg._retries
        warn('apiClient', `Retry ${cfg._retries}/${HTTP.MAX_RETRIES}`, { url: cfg.url, status, delay })
        await new Promise(r => setTimeout(r, delay))
        return instance(cfg)
      }

      return Promise.reject(err)
    }
  )

  return instance
}
