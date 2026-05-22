/**
 * FlowBoard Retry Worker
 * Processes delayed retry jobs for failed steps
 */
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { enqueueStep } from '../engine/execution-manager.js';
import { ServiceLogger } from '@vistafam/pipevista-core';
const logger = new ServiceLogger('flowboard-retry-worker');
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const redisConnection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
export function createRetryWorker(concurrency = 3) {
    return new Worker('flowboard:retries', async (job) => {
        const { executionId, stepId, tenantId, attempt } = job.data;
        logger.info(`Retrying step ${stepId}, attempt ${attempt}`, { executionId });
        await enqueueStep(executionId, stepId, tenantId);
    }, { connection: redisConnection, concurrency });
}
