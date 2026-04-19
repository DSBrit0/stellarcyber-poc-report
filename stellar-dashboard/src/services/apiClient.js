import axios from 'axios'
import { HTTP, RETRYABLE_STATUS } from './endpoints'
import { warn } from '../utils/logger'

/**
 * Returns an Axios instance bound to an authenticated Stellar Cyber instance.
 * The instance automatically injects the Bearer token and retries on transient errors.
 */
export function createApiClient(auth) {
  const instance = axios.create({
    baseURL: `${auth.url.replace(/\/$/, '')}/connect/api/v1`,
    headers: { Authorization: `Bearer ${auth.token}` },
    timeout: HTTP.TIMEOUT,
  })

  instance.interceptors.request.use(cfg => {
    cfg.headers.Authorization = `Bearer ${auth.token}`
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
