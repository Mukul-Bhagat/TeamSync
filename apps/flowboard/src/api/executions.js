/**
 * FlowBoard Execution API Routes
 * Start, monitor, pause, resume, cancel executions
 */
import { PrismaClient } from '@prisma/client';
import { ServiceLogger } from '@vistafam/pipevista-core';
import { createExecution, startExecution, pauseExecution, resumeExecution, cancelExecution } from '../engine/execution-manager.js';
const logger = new ServiceLogger('flowboard-api-executions');
const prisma = new PrismaClient();
export async function executionRoutes(app) {
    // List executions
    app.get('/v1/executions', async (req) => {
        const { tenantId, workflowId, status } = req.query;
        const where = {};
        if (tenantId)
            where.tenantId = tenantId;
        if (workflowId)
            where.workflowId = workflowId;
        if (status)
            where.status = status;
        const executions = await prisma.execution.findMany({
            where,
            include: { steps: true },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        return { executions };
    });
    // Get execution by ID
    app.get('/v1/executions/:id', async (req, reply) => {
        const { id } = req.params;
        const execution = await prisma.execution.findUnique({
            where: { id },
            include: { steps: true, logs: true },
        });
        if (!execution) {
            reply.status(404).send({ error: 'Execution not found' });
            return;
        }
        return { execution };
    });
    // Start execution (manual trigger)
    app.post('/v1/workflows/:workflowId/execute', async (req, reply) => {
        const { workflowId } = req.params;
        const body = req.body;
        const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
        if (!workflow) {
            reply.status(404).send({ error: 'Workflow not found' });
            return;
        }
        if (workflow.status !== 'active') {
            reply.status(400).send({ error: 'Workflow is not active' });
            return;
        }
        const execution = await createExecution({
            workflowId,
            tenantId: body.tenantId,
            triggerType: 'manual',
            input: body.input,
            userId: body.userId,
        });
        await startExecution(execution.id);
        logger.info(`Manual execution started: ${execution.id} for workflow ${workflowId}`);
        reply.status(202).send({ executionId: execution.id, status: 'running' });
    });
    // Pause execution
    app.post('/v1/executions/:id/pause', async (req, reply) => {
        const { id } = req.params;
        await pauseExecution(id);
        reply.send({ executionId: id, status: 'paused' });
    });
    // Resume execution
    app.post('/v1/executions/:id/resume', async (req, reply) => {
        const { id } = req.params;
        await resumeExecution(id);
        reply.send({ executionId: id, status: 'running' });
    });
    // Cancel execution
    app.post('/v1/executions/:id/cancel', async (req, reply) => {
        const { id } = req.params;
        await cancelExecution(id);
        reply.send({ executionId: id, status: 'cancelled' });
    });
    // Execution logs
    app.get('/v1/executions/:id/logs', async (req) => {
        const { id } = req.params;
        const logs = await prisma.executionLog.findMany({
            where: { executionId: id },
            orderBy: { createdAt: 'asc' },
        });
        return { logs };
    });
    // Execution timeline
    app.get('/v1/executions/:id/timeline', async (req, reply) => {
        const { id } = req.params;
        const execution = await prisma.execution.findUnique({
            where: { id },
            include: { steps: true, logs: true, approvals: true },
        });
        if (!execution) {
            reply.status(404).send({ error: 'Execution not found' });
            return;
        }
        const timeline = [
            ...execution.steps.map((s) => ({
                type: 'step',
                id: s.id,
                stepId: s.stepId,
                stepType: s.stepType,
                status: s.status,
                startedAt: s.startedAt,
                completedAt: s.completedAt,
            })),
            ...execution.logs.map((l) => ({
                type: 'log',
                id: l.id,
                level: l.level,
                message: l.message,
                createdAt: l.createdAt,
            })),
            ...execution.approvals.map((a) => ({
                type: 'approval',
                id: a.id,
                status: a.status,
                approvers: a.approvers,
                createdAt: a.createdAt,
                respondedAt: a.respondedAt,
            })),
        ].sort((a, b) => new Date(a.createdAt ?? a.startedAt).getTime() - new Date(b.createdAt ?? b.startedAt).getTime());
        return { execution, timeline };
    });
}
