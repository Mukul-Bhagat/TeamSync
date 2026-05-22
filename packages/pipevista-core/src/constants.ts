/**
 * PipeVista Constants
 */

export const PV_PORTS = {
  GATEWAY: 4100,
  EVENT_HUB: 4101,
  AI_ROUTER: 4102,
  REGISTRY: 4103,
  CONNECTOR: 4104,
  REALTIME: 4105,
  OBSERVABILITY: 4106,
  ADMIN: 4107,
} as const;

export const PV_SERVICES = {
  GATEWAY: 'pipevista-gateway',
  EVENT_HUB: 'pipevista-event-hub',
  AI_ROUTER: 'pipevista-ai-router',
  REGISTRY: 'pipevista-registry',
  CONNECTOR: 'pipevista-connector',
  REALTIME: 'pipevista-realtime',
  OBSERVABILITY: 'pipevista-observability',
  ADMIN: 'pipevista-admin',
} as const;

export const REDIS_KEY_TTLS = {
  JWT_CACHE: 5 * 60 * 1000,        // 5 min
  RBAC_CACHE: 60 * 1000,            // 1 min
  RATE_LIMIT: 60 * 1000,            // 1 min window
  SERVICE_REGISTRY: 30 * 1000,       // 30 sec
  HEALTH_STATUS: 15 * 1000,         // 15 sec
  AI_QUOTA: 24 * 60 * 60 * 1000,   // 24 hours
  AI_CACHE: 60 * 60 * 1000,        // 1 hour
  PRESENCE: 30 * 1000,              // 30 sec
  RESPONSE_CACHE: 5 * 60 * 1000,   // 5 min
} as const;
