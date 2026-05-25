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
export const ServiceHealthStatusSchema = z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']);
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
