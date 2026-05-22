/**
 * FlowBoard Workflow API Routes
 * CRUD for workflow definitions with versioning
 */
import { PrismaClient } from '@prisma/client';
import { ServiceLogger } from '@vistafam/pipevista-core';
import { registerTrigger, unregisterTrigger } from '../engine/trigger-router.js';
import { scheduleCronTrigger, removeCronTrigger } from '../workers/scheduler-worker.js';
const logger = new ServiceLogger('flowboard-api-workflows');
const prisma = new PrismaClient();
export async function workflowRoutes(app) {
    // List workflows
    app.get('/v1/workflows', async (req) => {
        const { tenantId, status } = req.query;
        const where = {};
        if (tenantId)
            where.tenantId = tenantId;
        if (status)
            where.status = status;
        const workflows = await prisma.workflow.findMany({
            where,
            include: { triggers: true },
            orderBy: { updatedAt: 'desc' },
        });
        return { workflows };
    });
    // Get workflow by ID
    app.get('/v1/workflows/:id', async (req, reply) => {
        const { id } = req.params;
        const workflow = await prisma.workflow.findUnique({
            where: { id },
            include: { triggers: true, executions: { take: 10, orderBy: { createdAt: 'desc' } } },
        });
        if (!workflow) {
            reply.status(404).send({ error: 'Workflow not found' });
            return;
        }
        return { workflow };
    });
    // Create workflow
    app.post('/v1/workflows', async (req, reply) => {
        const body = req.body;
        const workflow = await prisma.workflow.create({
            data: {
                tenantId: body.tenantId,
                name: body.name,
                description: body.description,
                status: 'draft',
                definition: body.definition,
                createdBy: body.createdBy,
            },
        });
        // Create triggers if provided
        if (body.triggers) {
            for (const trigger of body.triggers) {
                const t = await prisma.workflowTrigger.create({
                    data: {
                        workflowId: workflow.id,
                        tenantId: body.tenantId,
                        type: trigger.type,
                        config: trigger.config,
                        isActive: false, // Will activate on publish
                    },
                });
                // Register event triggers in cache
                if (trigger.type === 'event') {
                    await registerTrigger({
                        triggerId: t.id,
                        workflowId: workflow.id,
                        tenantId: body.tenantId,
                        type: 'event',
                        config: trigger.config,
                    });
                }
            }
        }
        logger.info(`Workflow created: ${workflow.name} (${workflow.id})`);
        reply.status(201).send({ workflow });
    });
    // Update workflow (creates new version if already active)
    app.put('/v1/workflows/:id', async (req, reply) => {
        const { id } = req.params;
        const body = req.body;
        const existing = await prisma.workflow.findUnique({ where: { id } });
        if (!existing) {
            reply.status(404).send({ error: 'Workflow not found' });
            return;
        }
        const updateData = {};
        if (body.name)
            updateData.name = body.name;
        if (body.description !== undefined)
            updateData.description = body.description;
        if (body.definition)
            updateData.definition = body.definition;
        if (body.status)
            updateData.status = body.status;
        const workflow = await prisma.workflow.update({
            where: { id },
            data: updateData,
        });
        // If activating, register triggers
        if (body.status === 'active' && existing.status !== 'active') {
            const triggers = await prisma.workflowTrigger.findMany({ where: { workflowId: id } });
            for (const trigger of triggers) {
                await registerTrigger({
                    triggerId: trigger.id,
                    workflowId: id,
                    tenantId: trigger.tenantId,
                    type: trigger.type,
                    config: trigger.config,
                });
                if (trigger.type === 'cron') {
                    const config = trigger.config;
                    await scheduleCronTrigger(id, trigger.tenantId, config.cronExpression);
                }
            }
        }
        // If pausing/archiving, unregister triggers
        if ((body.status === 'paused' || body.status === 'archived') && existing.status === 'active') {
            const triggers = await prisma.workflowTrigger.findMany({ where: { workflowId: id } });
            for (const trigger of triggers) {
                await unregisterTrigger(trigger.tenantId, trigger.id);
                if (trigger.type === 'cron') {
                    await removeCronTrigger(id);
                }
            }
        }
        logger.info(`Workflow updated: ${workflow.name} (${id})`);
        return { workflow };
    });
    // Delete workflow
    app.delete('/v1/workflows/:id', async (req, reply) => {
        const { id } = req.params;
        await prisma.workflow.delete({ where: { id } });
        reply.status(204).send();
    });
    // Publish workflow (draft -> active)
    app.post('/v1/workflows/:id/publish', async (req, reply) => {
        const { id } = req.params;
        const workflow = await prisma.workflow.update({
            where: { id },
            data: { status: 'active' },
        });
        const triggers = await prisma.workflowTrigger.findMany({ where: { workflowId: id } });
        for (const trigger of triggers) {
            await registerTrigger({
                triggerId: trigger.id,
                workflowId: id,
                tenantId: trigger.tenantId,
                type: trigger.type,
                config: trigger.config,
            });
            if (trigger.type === 'cron') {
                const config = trigger.config;
                await scheduleCronTrigger(id, trigger.tenantId, config.cronExpression);
            }
        }
        logger.info(`Workflow published: ${workflow.name} (${id})`);
        return { workflow };
    });
}
