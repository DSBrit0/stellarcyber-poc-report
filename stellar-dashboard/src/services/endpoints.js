// Central API configuration — all Stellar Cyber endpoint paths and HTTP settings live here.
// No endpoint string or HTTP constant should be defined anywhere else.

export const API_PREFIX = '/connect/api/v1'

export const ENDPOINTS = {
  ACCESS_TOKEN:           `${API_PREFIX}/access_token`,
  CASES:                  `${API_PREFIX}/cases`,
  ENTITY_USAGE_DAILY:     `${API_PREFIX}/entity_usages/daily_count/all`,
  CONNECTORS:             `${API_PREFIX}/connectors`,
  INGESTION_BY_SENSOR:    `${API_PREFIX}/ingestion-stats/sensor`,
  INGESTION_BY_CONNECTOR: `${API_PREFIX}/ingestion-stats/connector`,
  DATA_SENSORS:           `${API_PREFIX}/data_sensors`,
  TENANTS:                `${API_PREFIX}/tenants`,
  STORAGE_USAGES:         `${API_PREFIX}/storage-usages`,
  // Case alerts: ${API_PREFIX}/cases/{id}/alerts  (ID is dynamic — constructed in api.js)
}

export const HTTP = {
  TIMEOUT:       20_000,
  AUTH_TIMEOUT:  15_000,
  MAX_RETRIES:   2,
  RETRY_DELAY:   800,
  DEFAULT_LIMIT: 200,
}

// Paginação (Swagger 7.0 SaaS + validação ao vivo):
// - GET /cases: `limit` + `skip`; a resposta traz `total`. Sem FROM~/TO~created_at a
//   API devolve só as últimas ~24h, então o período do POC é sempre enviado.
// - GET /cases/{id}/alerts: `limit` máximo 50 (valores maiores são truncados em 50).
export const PAGING = {
  CASES_PAGE:      500,
  CASES_MAX:       5_000,  // teto por severidade (10 páginas)
  MEDIUM_TOP:      100,
  CASE_ALERTS_PAGE: 50,
  CASE_ALERTS_MAX:  500,   // teto por case (10 páginas)
}

// HTTP status codes that warrant an automatic retry
export const RETRYABLE_STATUS = new Set([429, 502, 503, 504])
