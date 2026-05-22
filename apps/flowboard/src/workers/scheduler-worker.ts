/**
 * FlowBoard Scheduler Worker
 * Manages cron trigger scheduling via BullMQ repeatable jobs
 */

import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { createExecution, startExecution } from '../engine/execution-manager.js';
import { ServiceLogger } from '@vistafam/pipevista-core';

const logger = new ServiceLogger('flowboard-scheduler');
const prisma = new PrismaClient();

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const redisConnection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export const scheduledQueue = new Queue('flowboard:scheduled', { connection: redisConnection });

export function createSchedulerWorker(): Worker {
  return new Worker(
    'flowboard:scheduled',
    async (job) => {
      const { workflowId, tenantId } = job.data as {
        workflowId: string;
        tenantId: string;
      };

      logger.info(`Scheduled workflow triggered: ${workflowId}`, { tenantId });

      const execution = await createExecution({
        workflowId,
        tenantId,
        triggerType: 'cron',
        triggerMetadata: { cron: true, scheduledAt: new Date().toISOString() },
      });

      await startExecution(execution.id);
    },
    { connection: redisConnection }
  );
}

/**
 * Schedule a cron trigger for a workflow.
 */
export async function scheduleCronTrigger(
  workflowId: string,
  tenantId: string,
  cronExpression: string
): Promise<void> {
  await scheduledQueue.add(
    `cron:${workflowId}`,
    { workflowId, tenantId },
    {
      repeat: { pattern: cronExpression },
      jobId: `cron:${workflowId}`,
    }
  );

  logger.info(`Cron scheduled: ${cronExpression} for workflow ${workflowId}`);
}

/**
 * Remove a cron schedule.
 */
export async function removeCronTrigger(workflowId: string): Promise<void> {
  const jobId = `cron:${workflowId}`;
  await scheduledQueue.removeRepeatableByKey(jobId);
  logger.info(`Cron removed for workflow ${workflowId}`);
}
