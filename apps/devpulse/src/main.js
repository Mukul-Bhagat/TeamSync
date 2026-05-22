/**
 * VistaFam DevPulse - Developer Analytics
 * DORA metrics, git integration, pipeline insights
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { createLogger } from '@vistafam/logger';
const logger = createLogger('devpulse');
const app = Fastify({ logger: false });
const PORT = parseInt(process.env.PORT ?? '4008', 10);
const metrics = new Map();
app.get('/health/live', async () => ({ status: 'alive' }));
app.get('/health/ready', async () => ({ status: 'ready', version: '0.1.0' }));
// Metrics endpoints
app.get('/api/v1/metrics/dora', async () => ({
    deploymentFrequency: 'daily',
    leadTimeForChanges: '2 hours',
    changeFailureRate: '5%',
    timeToRecovery: '30 minutes',
}));
app.get('/api/v1/metrics/activity', async () => ({
    commitsToday: 42,
    pullRequestsOpen: 8,
    reviewsPending: 3,
    deployments: 5,
}));
// Webhook ingestion
app.post('/api/v1/webhooks/github', async (req, reply) => {
    const body = req.body;
    logger.info(`GitHub webhook received: ${body.event}`);
    reply.status(200).send({ received: true });
});
// Reports
app.get('/api/v1/reports', async () => ({
    reports: [
        { id: 'report-1', name: 'Sprint Velocity', type: 'velocity', generatedAt: new Date().toISOString() },
        { id: 'report-2', name: 'Deployment Summary', type: 'deployments', generatedAt: new Date().toISOString() },
    ],
}));
async function start() {
    await app.register(cors, { origin: true, credentials: true });
    await app.register(helmet);
    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        logger.info(`DevPulse listening on port ${PORT}`, { port: PORT });
    }
    catch (err) {
        logger.fatal('Failed to start DevPulse', { error: err.message });
        process.exit(1);
    }
}
process.on('SIGTERM', async () => { await app.close(); process.exit(0); });
process.on('SIGINT', async () => { await app.close(); process.exit(0); });
start();
