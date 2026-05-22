/**
 * FlowBoard Workflow API Routes
 * CRUD for workflow definitions with versioning
 */

import { FastifyInstance } from 'fastify';
import { PrismaClient, Prisma } from '@prisma/client';
import { ServiceLogger } from '@vistafam/pipevista-core';
import { registerTrigger, unregisterTrigger } from '../engine/trigger-router.js';
import { scheduleCronTrigger, removeCronTrigger } from '../workers/scheduler-worker.js';

const logger = new ServiceLogger('flowboard-api-workflows');
const prisma = new PrismaClient();

export async function workflowRoutes(app: FastifyInstance) {
  // List workflows
  app.get('/v1/workflows', async (req) => {
    const { tenantId, status } = req.query as { tenantId?: string; status?: string };
    const where: Prisma.WorkflowWhereInput = {};
    if (tenantId) where.tenantId = tenantId;
    if (status) where.status = status;

    const workflows = await prisma.workflow.findMany({
      where,
      include: { triggers: true },
      orderBy: { updatedAt: 'desc' },
    });

    return { workflows };
  });

  // Get workflow by ID
  app.get('/v1/workflows/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: { triggers: true, executions: { take: 10, orderBy: { createdAt: 'desc' } } },
    });

    if (!workflow) { reply.status(404).send({ error: 'Workflow not found' }); return; }
    return { workflow };
  });

  // Create workflow
  app.post('/v1/workflows', async (req, reply) => {
    const body = req.body as {
      tenantId: string;
      name: string;
      description?: string;
      definition: { steps: unknown[]; variables?: Record<string, unknown> };
      triggers?: Array<{ type: string; config: Record<string, unknown> }>;
      createdBy: string;
    };

    const workflow = await prisma.workflow.create({
      data: {
        tenantId: body.tenantId,
        name: body.name,
        description: body.description,
        status: 'draft',
        definition: body.definition as Prisma.InputJsonValue,
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
            config: trigger.config as Prisma.InputJsonValue,
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
    const { id } = req.params as { id: string };
    const body = req.body as Partial<{
      name: string;
      description: string;
      definition: { steps: unknown[]; variables?: Record<string, unknown> };
      status: string;
    }>;

    const existing = await prisma.workflow.findUnique({ where: { id } });
    if (!existing) { reply.status(404).send({ error: 'Workflow not found' }); return; }

    const updateData: Prisma.WorkflowUpdateInput = {};
    if (body.name) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.definition) updateData.definition = body.definition as Prisma.InputJsonValue;
    if (body.status) updateData.status = body.status;

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
          type: trigger.type as 'event' | 'cron' | 'webhook' | 'manual',
          config: trigger.config as Record<string, unknown>,
        });

        if (trigger.type === 'cron') {
          const config = trigger.config as Record<string, unknown>;
          await scheduleCronTrigger(id, trigger.tenantId, config.cronExpression as string);
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
    const { id } = req.params as { id: string };
    await prisma.workflow.delete({ where: { id } });
    reply.status(204).send();
  });

  // Publish workflow (draft -> active)
  app.post('/v1/workflows/:id/publish', async (req, reply) => {
    const { id } = req.params as { id: string };
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
        type: trigger.type as 'event' | 'cron' | 'webhook' | 'manual',
        config: trigger.config as Record<string, unknown>,
      });

      if (trigger.type === 'cron') {
        const config = trigger.config as Record<string, unknown>;
        await scheduleCronTrigger(id, trigger.tenantId, config.cronExpression as string);
      }
    }

    logger.info(`Workflow published: ${workflow.name} (${id})`);
    return { workflow };
  });
}
