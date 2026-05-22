/**
 * FlowBoard Execution Manager
 * Orchestrates workflow execution lifecycle: create, run, pause, resume, cancel
 */

import { PrismaClient, Execution, ExecutionStep, Prisma } from '@prisma/client';
import { DAGExecutor, WorkflowStep } from './dag.js';
import { evaluateTemplate, ExecutionContext } from './template-engine.js';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { ServiceLogger } from '@vistafam/pipevista-core';

const logger = new ServiceLogger('flowboard-execution-manager');
const prisma = new PrismaClient();

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const redisConnection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

// BullMQ queues
export const stepQueue = new Queue('flowboard:steps', { connection: redisConnection });
export const retryQueue = new Queue('flowboard:retries', { connection: redisConnection });

export interface CreateExecutionInput {
  workflowId: string;
  tenantId: string;
  triggerType: string;
  triggerEvent?: Record<string, unknown>;
  triggerMetadata?: Record<string, unknown>;
  input?: Record<string, unknown>;
  userId?: string;
}

export async function createExecution(input: CreateExecutionInput): Promise<Execution> {
  const workflow = await prisma.workflow.findUnique({
    where: { id: input.workflowId },
  });

  if (!workflow) {
    throw new Error(`Workflow not found: ${input.workflowId}`);
  }

  const definition = workflow.definition as {
    steps: WorkflowStep[];
    variables?: Record<string, unknown>;
  };

  // Build initial context
  const context: ExecutionContext = {
    trigger: input.triggerEvent
      ? { type: input.triggerType, payload: input.triggerEvent }
      : undefined,
    workflow: { id: workflow.id, name: workflow.name, tenantId: input.tenantId },
    variables: definition.variables ?? {},
    steps: {},
    timestamp: new Date().toISOString(),
    tenantId: input.tenantId,
    userId: input.userId,
  };

  // Evaluate input templates if provided
  const evaluatedInput = input.input ? evaluateTemplate(input.input, context) : null;

  const execution = await prisma.execution.create({
    data: {
      tenantId: input.tenantId,
      workflowId: input.workflowId,
      triggerType: input.triggerType,
      triggerEvent: input.triggerEvent as Prisma.InputJsonValue,
      triggerMetadata: input.triggerMetadata as Prisma.InputJsonValue,
      status: 'pending',
      context: context as Prisma.InputJsonValue,
      input: evaluatedInput as Prisma.InputJsonValue,
    },
  });

  // Create execution step records
  const steps = definition.steps ?? [];
  await prisma.executionStep.createMany({
    data: steps.map((step) => ({
      executionId: execution.id,
      stepId: step.id,
      stepType: step.type,
      status: 'pending',
      retryCount: 0,
    })),
  });

  logger.info(`Execution created: ${execution.id} for workflow ${workflow.name}`);

  return execution;
}

export async function startExecution(executionId: string): Promise<void> {
  const execution = await prisma.execution.update({
    where: { id: executionId },
    data: { status: 'running', startedAt: new Date() },
  });

  const workflow = await prisma.workflow.findUnique({
    where: { id: execution.workflowId },
  });

  if (!workflow) {
    throw new Error(`Workflow not found: ${execution.workflowId}`);
  }

  const definition = workflow.definition as { steps: WorkflowStep[] };
  const dag = new DAGExecutor();
  dag.build(definition.steps);

  // Enqueue all root steps (no dependencies)
  const readySteps = dag.getReadySteps();
  for (const node of readySteps) {
    await enqueueStep(executionId, node.stepId, execution.tenantId);
  }

  // If no ready steps (empty workflow), mark complete
  if (readySteps.length === 0) {
    await finalizeExecution(executionId, 'completed');
  }

  logger.info(`Execution started: ${executionId}, ${readySteps.length} ready steps`);
}

export async function enqueueStep(
  executionId: string,
  stepId: string,
  tenantId: string
): Promise<void> {
  await stepQueue.add(
    `step:${executionId}:${stepId}`,
    { executionId, stepId, tenantId },
    {
      jobId: `${executionId}:${stepId}`,
      removeOnComplete: true,
      removeOnFail: false,
    }
  );
}

export async function handleStepCompletion(
  executionId: string,
  stepId: string,
  output: unknown
): Promise<void> {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: { steps: true },
  });

  if (!execution) return;

  const workflow = await prisma.workflow.findUnique({
    where: { id: execution.workflowId },
  });
  if (!workflow) return;

  const definition = workflow.definition as { steps: WorkflowStep[] };

  // Update context with step output
  const context = execution.context as ExecutionContext;
  context.steps = context.steps ?? {};
  context.steps[stepId] = { output, status: 'completed' };

  await prisma.execution.update({
    where: { id: executionId },
    data: { context: context as Prisma.InputJsonValue },
  });

  // Build DAG and find next steps
  const dag = new DAGExecutor();
  dag.build(definition.steps);

  // Mark completed nodes
  for (const step of execution.steps) {
    if (step.status === 'completed') {
      dag.markComplete(step.stepId, (step.output as any) ?? undefined);
    } else if (step.status === 'failed') {
      dag.markFailed(step.stepId);
    }
  }

  dag.markComplete(stepId, output);

  // Check for next ready steps
  const nextSteps = dag.getReadySteps();
  for (const node of nextSteps) {
    await enqueueStep(executionId, node.stepId, execution.tenantId);
  }

  // Check if execution is complete
  if (dag.isComplete()) {
    await finalizeExecution(executionId, 'completed', output);
  }
}

export async function handleStepFailure(
  executionId: string,
  stepId: string,
  error: Error,
  stepDef: WorkflowStep
): Promise<void> {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: { steps: true },
  });

  if (!execution) return;

  const retryPolicy = stepDef.retryPolicy ?? {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitter: true,
  };

  const stepRecord = execution.steps.find((s: any) => s.stepId === stepId);
  const currentRetries = stepRecord?.retryCount ?? 0;

  if (currentRetries < retryPolicy.maxRetries) {
    // Calculate backoff with jitter
    const delay = Math.min(
      retryPolicy.baseDelayMs * Math.pow(retryPolicy.backoffMultiplier, currentRetries),
      retryPolicy.maxDelayMs
    );
    const jitteredDelay = retryPolicy.jitter
      ? delay * (0.5 + Math.random() * 0.5)
      : delay;

    await retryQueue.add(
      `retry:${executionId}:${stepId}`,
      { executionId, stepId, tenantId: execution.tenantId, attempt: currentRetries + 1 },
      { delay: Math.round(jitteredDelay) }
    );

    await prisma.executionStep.updateMany({
      where: { executionId, stepId },
      data: { retryCount: { increment: 1 }, status: 'pending' },
    });

    logger.info(`Step ${stepId} queued for retry ${currentRetries + 1}/${retryPolicy.maxRetries} in ${Math.round(jitteredDelay)}ms`);
  } else {
    // Max retries reached
    const onFailure = stepDef.onFailure ?? 'cancel';

    await prisma.executionStep.updateMany({
      where: { executionId, stepId },
      data: { status: 'failed', error: { message: error.message, stack: error.stack } as Prisma.InputJsonValue },
    });

    if (onFailure === 'continue') {
      // Mark as failed but continue DAG
      const workflow = await prisma.workflow.findUnique({ where: { id: execution.workflowId } });
      if (!workflow) return;
      const definition = workflow.definition as { steps: WorkflowStep[] };
      const dag = new DAGExecutor();
      dag.build(definition.steps);

      // Mark all existing states
      for (const step of execution.steps) {
        if (step.status === 'completed') dag.markComplete(step.stepId);
        else if (step.status === 'failed') dag.markFailed(step.stepId);
      }
      dag.markFailed(stepId);

      const nextSteps = dag.getReadySteps();
      for (const node of nextSteps) {
        await enqueueStep(executionId, node.stepId, execution.tenantId);
      }

      if (dag.isComplete()) {
        await finalizeExecution(executionId, 'completed');
      }
    } else {
      // Cancel execution
      await finalizeExecution(executionId, 'failed', undefined, { message: error.message, stepId });
    }
  }
}

export async function finalizeExecution(
  executionId: string,
  status: 'completed' | 'failed' | 'cancelled',
  output?: unknown,
  error?: Record<string, unknown>
): Promise<void> {
  await prisma.execution.update({
    where: { id: executionId },
    data: {
      status,
      output: output as Prisma.InputJsonValue,
      error: error as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });

  logger.info(`Execution ${executionId} finalized with status: ${status}`);
}

export async function pauseExecution(executionId: string): Promise<void> {
  await prisma.execution.update({
    where: { id: executionId },
    data: { status: 'paused' },
  });
  logger.info(`Execution paused: ${executionId}`);
}

export async function resumeExecution(executionId: string): Promise<void> {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
  });

  if (!execution || execution.status !== 'paused') return;

  await prisma.execution.update({
    where: { id: executionId },
    data: { status: 'running' },
  });

  // Re-enqueue ready steps
  await startExecution(executionId);
  logger.info(`Execution resumed: ${executionId}`);
}

export async function cancelExecution(executionId: string): Promise<void> {
  await finalizeExecution(executionId, 'cancelled');
  logger.info(`Execution cancelled: ${executionId}`);
}
