/**
 * PipeVista Core Types
 * Shared across all 8 PipeVista microservices and ecosystem apps
 */

import { z } from 'zod';

// ── Tenant Context ───────────────────────────────────────────

export const TenantContextSchema = z.object({
  tenantId: z.string(),
  tenantSlug: z.string(),
  userId: z.string().optional(),
  userEmail: z.string().email().optional(),
  roles: z.array(z.string()).default([]),
  permissions: z.array(z.string()).default([]),
  traceId: z.string(),
  requestId: z.string(),
  clientIp: z.string().optional(),
});

export type TenantContext = z.infer<typeof TenantContextSchema>;

// ── Service Registration ─────────────────────────────────────

export const ServiceRegistrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  host: z.string(),
  port: z.number().int().min(1).max(65535),
  healthEndpoint: z.string().default('/health/ready'),
  metadata: z.record(z.unknown()).default({}),
  dependencies: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export type ServiceRegistration = z.infer<typeof ServiceRegistrationSchema>;

export const ServiceHealthStatusSchema = z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']);
export type ServiceHealthStatus = z.infer<typeof ServiceHealthStatusSchema>;

export interface ServiceInstance extends ServiceRegistration {
  status: ServiceHealthStatus;
  lastHeartbeat: string;
  registeredAt: string;
  updatedAt: string;
}

// ── Event Types ──────────────────────────────────────────────

export const PipeVistaEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  source: z.string(),
  subject: z.string(),
  tenantId: z.string(),
  traceId: z.string(),
  version: z.string().default('v1'),
  type: z.string(),
  payload: z.record(z.unknown()),
  metadata: z.object({
    userId: z.string().optional(),
    clientIp: z.string().optional(),
    requestId: z.string().optional(),
    hubReceivedAt: z.string().optional(),
  }).optional(),
});

export type PipeVistaEvent = z.infer<typeof PipeVistaEventSchema>;

export interface EventPublishRequest {
  type: string;
  tenantId: string;
  traceId?: string;
  payload: Record<string, unknown>;
  metadata?: PipeVistaEvent['metadata'];
}

// ── AI Types ─────────────────────────────────────────────────

export const AIModelSchema = z.object({
  id: z.string(),
  provider: z.enum(['openai', 'anthropic', 'google', 'deepseek', 'ollama']),
  model: z.string(),
  capabilities: z.array(z.string()),
  costPer1KInput: z.number(),
  costPer1KOutput: z.number(),
  maxTokens: z.number(),
  enabled: z.boolean(),
});

export type AIModel = z.infer<typeof AIModelSchema>;

export interface AIRequest {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: unknown[];
  tenantId: string;
  traceId: string;
}

export interface AIResponse {
  id: string;
  model: string;
  provider: string;
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  costUsd: number;
}

// ── Gateway Types ────────────────────────────────────────────

export interface GatewayRoute {
  path: string;
  service: string;
  methods: string[];
  authRequired: boolean;
  requiredPermissions: string[];
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    burstAllowance: number;
  };
  cache?: {
    enabled: boolean;
    ttlMs: number;
  };
  version: string;
}

export interface UpstreamConfig {
  name: string;
  targets: Array<{ host: string; port: number; weight: number }>;
  healthStatus: ServiceHealthStatus;
  circuitBreaker: {
    state: 'closed' | 'open' | 'half-open';
    failureCount: number;
    lastFailureTime?: string;
  };
}

// ── Webhook Types ────────────────────────────────────────────

export const WebhookEndpointSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  url: z.string().url(),
  events: z.array(z.string()),
  secret: z.string(),
  active: z.boolean().default(true),
  retryPolicy: z.object({
    maxRetries: z.number().default(5),
    backoffMultiplier: z.number().default(2),
    baseDelayMs: z.number().default(1000),
  }).default({}),
});

export type WebhookEndpoint = z.infer<typeof WebhookEndpointSchema>;

// ── Config Types ─────────────────────────────────────────────

export interface ConfigEntry {
  key: string;
  value: unknown;
  scope: {
    tenantId?: string;
    service?: string;
  };
  version: number;
  updatedAt: string;
  updatedBy: string;
}

// ── Presence Types ───────────────────────────────────────────

export interface PresenceEntry {
  userId: string;
  tenantId: string;
  socketId: string;
  status: 'online' | 'away' | 'dnd' | 'offline';
  lastSeen: string;
  platform: 'web' | 'mobile' | 'desktop';
  clientVersion: string;
}

// ── Observability Types ──────────────────────────────────────

export interface StructuredLog {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  service: string;
  message: string;
  traceId?: string;
  requestId?: string;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface MetricData {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: string;
}

// ── Health Types ─────────────────────────────────────────────

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  service: string;
  checks: Array<{
    name: string;
    status: 'up' | 'down' | 'degraded';
    latencyMs: number;
    message?: string;
  }>;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  lastUpdated: string;
  services: Array<{
    name: string;
    status: ServiceHealthStatus;
    instances: { total: number; healthy: number; degraded: number; unhealthy: number };
    latency: { p50: number; p95: number; p99: number };
    errorRate: number;
    throughput: number;
  }>;
  infrastructure: {
    database: { status: string; utilization: number };
    cache: { status: string; utilization: number };
    messaging: { status: string; utilization: number };
    storage: { status: string; utilization: number };
  };
}
