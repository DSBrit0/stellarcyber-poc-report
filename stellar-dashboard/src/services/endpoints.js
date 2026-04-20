// Central API configuration — all Stellar Cyber endpoint paths and HTTP settings live here.
// No endpoint string or HTTP constant should be defined anywhere else.

export const API_PREFIX = '/connect/api/v1'

export const ENDPOINTS = {
  ACCESS_TOKEN:           `${API_PREFIX}/access_token`,
  CASES:                  `${API_PREFIX}/cases`,
  ENTITY_USAGE_DAILY:     `${API_PREFIX}/entity_usages/daily_count/all`,
  CONNECTORS:             `${API_PREFIX}/connectors`,
  EVENTS:                 `${API_PREFIX}/events`,
  INGESTION_BY_SENSOR:    `${API_PREFIX}/ingestion-stats/sensor`,
  INGESTION_BY_CONNECTOR: `${API_PREFIX}/ingestion-stats/connector`,
}

export const HTTP = {
  TIMEOUT:       20_000,
  AUTH_TIMEOUT:  15_000,
  MAX_RETRIES:   2,
  RETRY_DELAY:   800,
  DEFAULT_LIMIT: 200,
}

// HTTP status codes that warrant an automatic retry
export const RETRYABLE_STATUS = new Set([429, 502, 503, 504])
