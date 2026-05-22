/**
 * FlowBoard Step Worker
 * Processes individual step jobs from BullMQ queue
 */
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { getRunner } from '../runners/index.js';
import { evaluateTemplate } from '../engine/template-engine.js';
import { handleStepCompletion, handleStepFailure } from '../engine/execution-manager.js';
import { ServiceLogger } from '@vistafam/pipevista-core';
const logger = new ServiceLogger('flowboard-step-worker');
const prisma = new PrismaClient();
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const redisConnection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
export function createStepWorker(concurrency = 5) {
    return new Worker('flowboard:steps', async (job) => {
        const { executionId, stepId, tenantId } = job.data;
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
        const definition = workflow.definition;
        const stepDef = definition.steps.find((s) => s.id === stepId);
        if (!stepDef) {
            throw new Error(`Step not found: ${stepId}`);
        }
        // 3. Build execution context
        const context = {
            trigger: execution.triggerEvent
                ? { type: execution.triggerType, payload: execution.triggerEvent }
                : undefined,
            workflow: { id: workflow.id, name: workflow.name, tenantId: execution.tenantId },
            execution: { id: execution.id, startedAt: execution.startedAt?.toISOString() },
            variables: execution.context?.variables ?? {},
            steps: execution.context?.steps ?? {},
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
                    output: result.output,
                    completedAt: new Date(),
                },
            });
            // Update execution context
            const updatedContext = execution.context;
            updatedContext.steps = updatedContext.steps ?? {};
            updatedContext.steps[stepId] = { output: result.output, status: 'completed' };
            await prisma.execution.update({
                where: { id: executionId },
                data: { context: updatedContext },
            });
            // Handle DAG progression
            await handleStepCompletion(executionId, stepId, result.output);
        }
        else if (result.status === 'waiting_approval') {
            await prisma.executionStep.updateMany({
                where: { executionId, stepId },
                data: {
                    status: 'waiting_approval',
                    output: result.output,
                },
            });
            await prisma.execution.update({
                where: { id: executionId },
                data: { status: 'paused' },
            });
        }
        else {
            // Failed
            await prisma.executionStep.updateMany({
                where: { executionId, stepId },
                data: {
                    status: 'failed',
                    error: result.error,
                    completedAt: new Date(),
                },
            });
            await handleStepFailure(executionId, stepId, new Error(result.error?.message ?? 'Step failed'), stepDef);
        }
    }, { connection: redisConnection, concurrency });
}
