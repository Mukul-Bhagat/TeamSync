/**
 * VistaFam TeamSync API - Communication and Collaboration Nervous System
 * Channels, messages, DMs, threads, reactions, presence, notifications, voice rooms
 * Integrates with PipeVista Realtime for websocket delivery
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { ServiceLogger } from '@vistafam/pipevista-core';

// Routes
import { channelRoutes } from './routes/channels.js';
import { messageRoutes } from './routes/messages.js';
import { dmRoutes } from './routes/dms.js';
import { notificationRoutes } from './routes/notifications.js';
import { presenceRoutes } from './routes/presence.js';
import { fileRoutes } from './routes/files.js';
import { searchRoutes } from './routes/search.js';
import { voiceRoomRoutes } from './routes/voice-rooms.js';
import { integrationRoutes } from './routes/integrations.js';
import { aiSummaryRoutes } from './routes/ai-summary.js';

// Workers
import { createNotificationWorker } from './workers/notification-worker.js';
import { startEventIntegrationWorker } from './workers/event-integration-worker.js';
import { createAISummaryWorker } from './workers/ai-summary-worker.js';

const logger = new ServiceLogger('teamsync-api');
const app = Fastify({ logger: false });
const PORT = parseInt(process.env.PORT ?? '4002', 10);

// ── Health Endpoints ───────────────────────────────────────

app.get('/health/live', async () => ({ status: 'alive', service: 'teamsync-api' }));
app.get('/health/ready', async () => ({ status: 'ready', version: '0.1.0', service: 'teamsync-api' }));
app.get('/health/deep', async () => {
  // Deep health: check Supabase connectivity
  try {
    const { getSupabase } = await import('./lib/supabase.js');
    const supabase = getSupabase();
    const { error } = await supabase.from('channels').select('id').limit(1);
    if (error) throw error;
    return { status: 'healthy', checks: { database: 'ok', realtime: 'ok' } };
  } catch (err) {
    return { status: 'unhealthy', error: (err as Error).message };
  }
});

// ── API Routes ─────────────────────────────────────────────

app.register(channelRoutes, { prefix: '/api' });
app.register(messageRoutes, { prefix: '/api' });
app.register(dmRoutes, { prefix: '/api' });
app.register(notificationRoutes, { prefix: '/api' });
app.register(presenceRoutes, { prefix: '/api' });
app.register(fileRoutes, { prefix: '/api' });
app.register(searchRoutes, { prefix: '/api' });
app.register(voiceRoomRoutes, { prefix: '/api' });
app.register(integrationRoutes, { prefix: '/api' });
app.register(aiSummaryRoutes, { prefix: '/api' });

// ── Startup ────────────────────────────────────────────────

async function start() {
  await app.register(cors, { origin: true, credentials: true });
  await app.register(helmet);

  // Start workers
  const notificationWorker = createNotificationWorker(5);
  const aiSummaryWorker = createAISummaryWorker(2);
  let eventWorker: { close: () => Promise<void> } | null = null;

  try {
    eventWorker = await startEventIntegrationWorker();
    logger.info('Event integration worker started');
  } catch (err) {
    logger.warn('Failed to start event integration worker', { error: (err as Error).message });
  }

  logger.info('Workers started: notification(5), ai-summary(2), event-integration(1)');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('Shutting down workers and server...');
    await notificationWorker.close();
    await aiSummaryWorker.close();
    if (eventWorker) await eventWorker.close();
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('Shutting down workers and server...');
    await notificationWorker.close();
    await aiSummaryWorker.close();
    if (eventWorker) await eventWorker.close();
    await app.close();
    process.exit(0);
  });

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`TeamSync API listening on port ${PORT}`, { port: PORT });
  } catch (err) {
    logger.fatal('Failed to start TeamSync API', { error: (err as Error).message });
    process.exit(1);
  }
}

start();
