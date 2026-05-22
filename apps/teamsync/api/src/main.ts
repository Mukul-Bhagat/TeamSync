/**
 * VistaFam TeamSync API - Communication and Collaboration
 * Channels, messages, presence, notifications
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { createLogger } from '@vistafam/logger';

const logger = createLogger('teamsync-api');
const app = Fastify({ logger: false });
const PORT = parseInt(process.env.PORT ?? '4002', 10);

// In-memory stores (replace with PostgreSQL + Redis in production)
const channels = new Map<string, unknown>();
const messages = new Map<string, unknown[]>();
const presence = new Map<string, unknown>();

app.get('/health/live', async () => ({ status: 'alive' }));
app.get('/health/ready', async () => ({ status: 'ready', version: '0.1.0' }));

// Channels
app.get('/api/v1/channels', async () => ({ channels: Array.from(channels.values()) }));

app.post('/api/v1/channels', async (req, reply) => {
  const body = req.body as { name: string; type: 'public' | 'private' | 'dm' };
  const id = crypto.randomUUID();
  const channel = { id, ...body, createdAt: new Date().toISOString() };
  channels.set(id, channel);
  messages.set(id, []);
  logger.info(`Channel created: ${body.name} (${id})`);
  reply.status(201).send(channel);
});

app.get('/api/v1/channels/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  const channel = channels.get(id);
  if (!channel) { reply.status(404).send({ error: 'Channel not found' }); return; }
  reply.send(channel);
});

// Messages
app.get('/api/v1/channels/:id/messages', async (req) => {
  const { id } = req.params as { id: string };
  const channelMessages = messages.get(id) ?? [];
  return { messages: channelMessages };
});

app.post('/api/v1/channels/:id/messages', async (req, reply) => {
  const { id } = req.params as { id: string };
  const body = req.body as { content: string; authorId: string };
  const message = {
    id: crypto.randomUUID(),
    channelId: id,
    ...body,
    createdAt: new Date().toISOString(),
  };
  const channelMessages = messages.get(id) ?? [];
  channelMessages.push(message);
  messages.set(id, channelMessages);
  logger.info(`Message sent in channel ${id}`);
  reply.status(201).send(message);
});

// Presence
app.get('/api/v1/presence', async () => ({ presence: Object.fromEntries(presence) }));

app.post('/api/v1/presence', async (req, reply) => {
  const body = req.body as { userId: string; status: string };
  presence.set(body.userId, { ...body, lastSeen: new Date().toISOString() });
  reply.send({ success: true });
});

// Notifications
app.get('/api/v1/notifications', async () => ({ notifications: [] }));

async function start() {
  await app.register(cors, { origin: true, credentials: true });
  await app.register(helmet);

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`TeamSync API listening on port ${PORT}`, { port: PORT });
  } catch (err) {
    logger.fatal('Failed to start TeamSync API', { error: (err as Error).message });
    process.exit(1);
  }
}

process.on('SIGTERM', async () => { await app.close(); process.exit(0); });
process.on('SIGINT', async () => { await app.close(); process.exit(0); });

start();
