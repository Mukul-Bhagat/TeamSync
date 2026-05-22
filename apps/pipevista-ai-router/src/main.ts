/**
 * PipeVista AI Router - AI Routing System
 * Model selection, provider abstraction, load balancing, fallback, token tracking, cost optimization
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { createRedisClient, buildKey, KeyPrefixes, getJson, setJson } from '@vistafam/pipevista-core';
import { ServiceLogger } from '@vistafam/pipevista-core';
import { CircuitBreaker } from '@vistafam/pipevista-core';

const logger = new ServiceLogger('pipevista-ai-router');
const app = Fastify({ logger: false });
const PORT = parseInt(process.env.PORT ?? '4102', 10);
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// ── Provider Configuration ─────────────────────────────────────

interface ProviderConfig {
  name: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
  costPer1KInput: number;
  costPer1KOutput: number;
  maxTokens: number;
  rateLimitRpm: number;
  healthStatus: 'healthy' | 'degraded' | 'down';
}

const providers: ProviderConfig[] = [
  { name: 'openai', model: 'gpt-4o', apiKey: process.env.OPENAI_API_KEY, enabled: true, costPer1KInput: 0.005, costPer1KOutput: 0.015, maxTokens: 8192, rateLimitRpm: 500, healthStatus: 'healthy' },
  { name: 'anthropic', model: 'claude-3-5-sonnet-20241022', apiKey: process.env.ANTHROPIC_API_KEY, enabled: true, costPer1KInput: 0.003, costPer1KOutput: 0.015, maxTokens: 8192, rateLimitRpm: 400, healthStatus: 'healthy' },
  { name: 'google', model: 'gemini-1.5-pro', apiKey: process.env.GEMINI_API_KEY, enabled: true, costPer1KInput: 0.0035, costPer1KOutput: 0.0105, maxTokens: 8192, rateLimitRpm: 360, healthStatus: 'healthy' },
  { name: 'deepseek', model: 'deepseek-chat', apiKey: process.env.DEEPSEEK_API_KEY, enabled: false, costPer1KInput: 0.00014, costPer1KOutput: 0.00028, maxTokens: 8192, rateLimitRpm: 1000, healthStatus: 'healthy' },
  { name: 'ollama', model: 'llama3.1:70b', baseUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434', enabled: false, costPer1KInput: 0, costPer1KOutput: 0, maxTokens: 4096, rateLimitRpm: 100, healthStatus: 'healthy' },
];

const fallbackChain = ['openai', 'anthropic', 'google', 'deepseek', 'ollama'];
const circuitBreakers = new Map<string, CircuitBreaker>();

function getCB(name: string): CircuitBreaker {
  if (!circuitBreakers.has(name)) circuitBreakers.set(name, new CircuitBreaker({ name, failureThreshold: 3, timeoutMs: 60000 }));
  return circuitBreakers.get(name)!;
}

app.get('/health/live', async () => ({ status: 'alive', service: 'pipevista-ai-router' }));
app.get('/health/ready', async () => ({ status: 'ready', version: '0.1.0', service: 'pipevista-ai-router' }));

// ── Model Registry ───────────────────────────────────────────

app.get('/v1/models', async () => ({
  models: providers.map((p) => ({
    id: `${p.name}:${p.model}`,
    provider: p.name,
    model: p.model,
    enabled: p.enabled,
    costPer1KInput: p.costPer1KInput,
    costPer1KOutput: p.costPer1KOutput,
    maxTokens: p.maxTokens,
    healthStatus: p.healthStatus,
  })),
}));

// ── Chat Completion ──────────────────────────────────────────

app.post('/v1/ai/chat', async (req, reply) => {
  const body = req.body as { messages: Array<{ role: string; content: string }>; model?: string; temperature?: number; maxTokens?: number; tenantId: string; traceId?: string };
  const startTime = Date.now();

  // Check tenant quota
  const redis = createRedisClient({ url: REDIS_URL });
  await redis.connect().catch(() => {});
  const quotaKey = buildKey(KeyPrefixes.AI, 'quota', body.tenantId);
  const used = parseInt(await redis.get(quotaKey) ?? '0', 10);
  if (used > 1_000_000) { // 1M tokens per day default
    reply.status(429).send({ error: 'AI quota exceeded', message: 'Token limit reached for this tenant' });
    return;
  }

  // Select model
  const preferredModel = body.model ?? 'gpt-4o';
  const selectedProvider = providers.find((p) => p.model === preferredModel && p.enabled) ?? providers.find((p) => p.enabled);
  if (!selectedProvider) {
    reply.status(503).send({ error: 'No AI providers available' });
    return;
  }

  // Try fallback chain
  let response: any = null;
  let providerUsed = selectedProvider.name;
  let errors: string[] = [];

  for (const providerName of fallbackChain) {
    const provider = providers.find((p) => p.name === providerName && p.enabled);
    if (!provider) continue;

    const cb = getCB(providerName);
    if (cb.getState() === 'open') continue;

    try {
      // TODO: Actual LLM call via provider adapter
      // For now, return structured placeholder
      response = {
        id: crypto.randomUUID(),
        model: provider.model,
        provider: provider.name,
        content: `[Placeholder response from ${provider.name} ${provider.model}]`,
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      };
      providerUsed = provider.name;
      break;
    } catch (error: any) {
      cb.execute(() => Promise.reject(error)).catch(() => {});
      errors.push(`${providerName}: ${error.message}`);
    }
  }

  if (!response) {
    reply.status(503).send({ error: 'All AI providers failed', details: errors });
    return;
  }

  const latencyMs = Date.now() - startTime;
  const providerConfig = providers.find((p) => p.name === providerUsed)!;
  const costUsd = (response.usage.totalTokens / 1000) * (providerConfig.costPer1KInput + providerConfig.costPer1KOutput) / 2;

  // Track usage
  await redis.incrby(quotaKey, response.usage.totalTokens);
  await redis.expire(quotaKey, 24 * 60 * 60);

  logger.info('AI request completed', {
    tenantId: body.tenantId,
    provider: providerUsed,
    model: response.model,
    tokens: response.usage.totalTokens,
    costUsd,
    latencyMs,
  });

  reply.send({
    ...response,
    latencyMs,
    costUsd,
    fallbackUsed: providerUsed !== selectedProvider.name,
  });
});

// ── Token Usage Tracking ─────────────────────────────────────

app.get('/v1/ai/usage', async (req) => {
  const tenantId = (req.query as any).tenantId ?? 'default';
  const redis = createRedisClient({ url: REDIS_URL });
  await redis.connect().catch(() => {});
  const quotaKey = buildKey(KeyPrefixes.AI, 'quota', tenantId);
  const used = parseInt(await redis.get(quotaKey) ?? '0', 10);

  return {
    tenantId,
    tokensUsed: used,
    tokensRemaining: Math.max(0, 1_000_000 - used),
    resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
});

async function start() {
  await app.register(cors, { origin: true, credentials: true });
  await app.register(helmet);

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`PipeVista AI Router listening on port ${PORT}`, { port: PORT });
  } catch (err) {
    logger.fatal('Failed to start AI Router', { error: (err as Error).message });
    process.exit(1);
  }
}

process.on('SIGTERM', async () => { await app.close(); process.exit(0); });
process.on('SIGINT', async () => { await app.close(); process.exit(0); });

start();
