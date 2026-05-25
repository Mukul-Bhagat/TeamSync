/**
 * FlowBoard Event Worker
 * Consumes PipeVista events and routes to matching workflows
 */

import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { matchEventTriggers } from '../engine/trigger-router.js';
import { createExecution, startExecution } from '../engine/execution-manager.js';
import { ServiceLogger } from '@vistafam/pipevista-core';

const logger = new ServiceLogger('flowboard-event-worker');

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const redisConnection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
redisConnection.on('error', (err) => logger.warn('Redis connection error', { error: err.message }));

// Queue for starting executions
const executionQueue = new Queue('flowboard-executions', { connection: redisConnection });

export function createEventWorker(concurrency = 3): Worker {
  return new Worker(
    'flowboard-events',
    async (job) => {
      const { subject, event } = job.data as {
        subject: string;
        event: { tenantId: string; payload: Record<string, unknown>; traceId?: string };
      };

      logger.info(`Processing event: ${subject}`, { tenantId: event.tenantId });

      // Match against active triggers
      const triggers = await matchEventTriggers(event.tenantId, subject, event.payload);

      for (const trigger of triggers) {
        logger.info(`Matched workflow ${trigger.workflowId} for event ${subject}`);

        // Create execution
        const execution = await createExecution({
          workflowId: trigger.workflowId,
          tenantId: event.tenantId,
          triggerType: 'event',
          triggerEvent: event.payload,
          triggerMetadata: { subject, traceId: event.traceId },
        });

        // Start execution
        await startExecution(execution.id);
      }
    },
    { connection: redisConnection, concurrency }
  );
}
