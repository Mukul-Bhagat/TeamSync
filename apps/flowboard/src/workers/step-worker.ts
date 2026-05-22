/**
 * FlowBoard Step Worker
 * Processes individual step jobs from BullMQ queue
 */

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient, Prisma } from '@prisma/client';
import { getRunner } from '../runners/index.js';
import { evaluateTemplate, ExecutionContext } from '../engine/template-engine.js';
import { DAGExecutor, WorkflowStep } from '../engine/dag.js';
import { handleStepCompletion, handleStepFailure, finalizeExecution } from '../engine/execution-manager.js';
import { ServiceLogger } from '@vistafam/pipevista-core';

const logger = new ServiceLogger('flowboard-step-worker');
const prisma = new PrismaClient();

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const redisConnection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export function createStepWorker(concurrency = 5): Worker {
  return new Worker(
    'flowboard:steps',
    async (job) => {
      const { executionId, stepId, tenantId } = job.data as {
        executionId: string;
        stepId: string;
        tenantId: string;
      };

      logger.info(`Processing step ${stepId} for execution ${executionId}`, { jobId: job.id });

      // 1. Update step status to running
      await prisma.executionStep.updateMany({
        where: { executionId, stepId },
        data: { status: 'running', startedAt: new Date() },
      });

      // 2. Load execution and workflow
      const execution = await prisma.execution.findUnique({
        where: { id: executionId },
        include: { steps: true },
      });

      if (!execution || execution.status === 'cancelled' || execution.status === 'paused') {
        logger.info(`Execution ${executionId} is ${execution?.status}, skipping step ${stepId}`);
        return;
      }

      const workflow = await prisma.workflow.findUnique({
        where: { id: execution.workflowId },
      });

      if (!workflow) {
        throw new Error(`Workflow not found: ${execution.workflowId}`);
      }

      const definition = workflow.definition as { steps: WorkflowStep[] };
      const stepDef = definition.steps.find((s) => s.id === stepId);
      if (!stepDef) {
        throw new Error(`Step not found: ${stepId}`);
      }

      // 3. Build execution context
      const context: ExecutionContext = {
        trigger: execution.triggerEvent
          ? { type: execution.triggerType, payload: execution.triggerEvent as Record<string, unknown> }
          : undefined,
        workflow: { id: workflow.id, name: workflow.name, tenantId: execution.tenantId },
        execution: { id: execution.id, startedAt: execution.startedAt?.toISOString() },
        variables: (execution.context as any)?.variables ?? {},
        steps: (execution.context as any)?.steps ?? {},
        timestamp: new Date().toISOString(),
        tenantId: execution.tenantId,
      };

      // 4. Evaluate step input templates
      const evaluatedInput = evaluateTemplate(stepDef.config.input, context);

      // 5. Get runner and execute
      const runner = getRunner(stepDef.type);
      if (!runner) {
        throw new Error(`No runner registered for step type: ${stepDef.type}`);
      }

      const result = await runner.execute(stepId, stepDef.config, context);

      // 6. Handle result
      if (result.status === 'completed') {
        // Update step record
        await prisma.executionStep.updateMany({
          where: { executionId, stepId },
          data: {
            status: 'completed',
            output: result.output as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        });

        // Update execution context
        const updatedContext = execution.context as any;
        updatedContext.steps = updatedContext.steps ?? {};
        updatedContext.steps[stepId] = { output: result.output, status: 'completed' };

        await prisma.execution.update({
          where: { id: executionId },
          data: { context: updatedContext },
        });

        // Handle DAG progression
        await handleStepCompletion(executionId, stepId, result.output);
      } else if (result.status === 'waiting_approval') {
        await prisma.executionStep.updateMany({
          where: { executionId, stepId },
          data: {
            status: 'waiting_approval',
            output: result.output as Prisma.InputJsonValue,
          },
        });

        await prisma.execution.update({
          where: { id: executionId },
          data: { status: 'paused' },
        });
      } else {
        // Failed
        await prisma.executionStep.updateMany({
          where: { executionId, stepId },
          data: {
            status: 'failed',
            error: result.error as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        });

        await handleStepFailure(executionId, stepId, new Error(result.error?.message ?? 'Step failed'), stepDef);
      }
    },
    { connection: redisConnection, concurrency }
  );
}
