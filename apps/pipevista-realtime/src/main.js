/**
 * PipeVista Realtime - Realtime Infrastructure
 * WebSocket gateway, Redis pub/sub bridge, notification streams, presence
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createRedisClient, buildKey, KeyPrefixes, getJson, setJson } from '@vistafam/pipevista-core';
import { ServiceLogger } from '@vistafam/pipevista-core';
const logger = new ServiceLogger('pipevista-realtime');
const app = Fastify({ logger: false });
const PORT = parseInt(process.env.PORT ?? '4105', 10);
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const redis = createRedisClient({ url: REDIS_URL });
const pubClient = createRedisClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();
const io = new SocketIOServer({ cors: { origin: '*', methods: ['GET', 'POST'] } });
app.get('/health/live', async () => ({ status: 'alive', service: 'pipevista-realtime' }));
app.get('/health/ready', async () => ({ status: 'ready', version: '0.1.0', service: 'pipevista-realtime' }));
// ── Socket.IO Room Management ────────────────────────────
function tenantRoom(tenantId) { return `tenant:${tenantId}`; }
function channelRoom(tenantId, channelId) { return `tenant:${tenantId}:channel:${channelId}`; }
function userRoom(tenantId, userId) { return `tenant:${tenantId}:user:${userId}`; }
function presenceRoom(tenantId) { return `tenant:${tenantId}:presence`; }
// ── Presence Management ──────────────────────────────────────
app.get('/v1/realtime/presence/:tenantId', async (req) => {
    const { tenantId } = req.params;
    const pattern = buildKey(KeyPrefixes.REALTIME, 'presence', tenantId, '*');
    const keys = await redis.keys(pattern);
    const entries = await Promise.all(keys.map((k) => getJson(redis, k)));
    return { tenantId, onlineUsers: entries.filter(Boolean) };
});
app.post('/v1/realtime/presence', async (req, reply) => {
    const body = req.body;
    const key = buildKey(KeyPrefixes.REALTIME, 'presence', body.tenantId, body.userId);
    const entry = { ...body, lastSeen: new Date().toISOString(), clientVersion: '1.0' };
    await setJson(redis, key, entry, 30000);
    // Broadcast presence change
    io.to(presenceRoom(body.tenantId)).emit('presence:changed', entry);
    logger.info(`Presence update: ${body.userId} is ${body.status}`);
    reply.send({ success: true });
});
// ── Notification Streams ───────────────────────────────────
app.post('/v1/realtime/notify', async (req, reply) => {
    const body = req.body;
    if (body.channelId) {
        io.to(channelRoom(body.tenantId, body.channelId)).emit(body.eventName, body.payload);
    }
    if (body.userIds) {
        for (const userId of body.userIds) {
            io.to(userRoom(body.tenantId, userId)).emit(body.eventName, body.payload);
        }
    }
    if (!body.channelId && !body.userIds) {
        io.to(tenantRoom(body.tenantId)).emit(body.eventName, body.payload);
    }
    logger.info(`Notification sent: ${body.eventName}`, { tenantId: body.tenantId });
    reply.send({ success: true, recipients: body.userIds?.length ?? 'broadcast' });
});
// ── Event Bridge ───────────────────────────────────────────
app.post('/v1/realtime/bridge', async (req, reply) => {
    const body = req.body;
    // Bridge NATS events to Socket.IO rooms
    io.to(tenantRoom(body.tenantId)).emit('event', { subject: body.subject, payload: body.payload });
    reply.send({ success: true });
});
// ── Connection Stats ───────────────────────────────────────
app.get('/v1/realtime/stats', async () => ({
    totalConnections: io.engine?.clientsCount ?? 0,
    rooms: Array.from(io.sockets.adapter.rooms.keys()),
    serverTime: new Date().toISOString(),
}));
async function start() {
    await app.register(cors, { origin: true, credentials: true });
    await app.register(helmet);
    // Attach Socket.IO to Fastify
    await app.ready();
    io.attach(app.server);
    io.adapter(createAdapter(pubClient, subClient));
    io.on('connection', (socket) => {
        logger.info(`Socket connected: ${socket.id}`);
        socket.on('authenticate', async (data) => {
            socket.join(tenantRoom(data.tenantId));
            socket.join(userRoom(data.tenantId, data.userId));
            socket.join(presenceRoom(data.tenantId));
            await setJson(redis, buildKey(KeyPrefixes.REALTIME, 'presence', data.tenantId, data.userId), {
                userId: data.userId, tenantId: data.tenantId, status: 'online', socketId: socket.id, platform: 'web',
            }, 30000);
            socket.emit('authenticated', { success: true });
            io.to(presenceRoom(data.tenantId)).emit('presence:changed', {
                userId: data.userId, status: 'online', lastSeen: new Date().toISOString(),
            });
        });
        socket.on('join:channel', (data) => {
            socket.join(channelRoom(data.tenantId, data.channelId));
            socket.emit('channel:joined', { channelId: data.channelId });
        });
        socket.on('leave:channel', (data) => {
            socket.leave(channelRoom(data.tenantId, data.channelId));
        });
        socket.on('disconnect', async () => {
            logger.info(`Socket disconnected: ${socket.id}`);
        });
    });
    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        logger.info(`PipeVista Realtime listening on port ${PORT}`, { port: PORT });
    }
    catch (err) {
        logger.fatal('Failed to start Realtime', { error: err.message });
        process.exit(1);
    }
}
process.on('SIGTERM', async () => { io.close(); await app.close(); process.exit(0); });
process.on('SIGINT', async () => { io.close(); await app.close(); process.exit(0); });
start();
