/**
 * Task Creation Step Runner
 * Creates kanban tasks from workflow steps
 */
import { PrismaClient } from '@prisma/client';
import { evaluateTemplate } from '../engine/template-engine.js';
import { ServiceLogger } from '@vistafam/pipevista-core';
const logger = new ServiceLogger('flowboard-runner-task');
const prisma = new PrismaClient();
export const taskRunner = {
    async execute(stepId, config, context) {
        try {
            const executionId = context.execution.id;
            const tenantId = context.tenantId ?? 'default';
            const title = evaluateTemplate(config.title, context);
            const description = evaluateTemplate(config.description, context);
            const assigneeId = evaluateTemplate(config.assigneeId, context);
            const priority = config.priority ?? 'medium';
            const boardId = evaluateTemplate(config.boardId, context);
            const tags = config.tags ?? [];
            const task = await prisma.task.create({
                data: {
                    tenantId,
                    executionId,
                    stepId,
                    title,
                    description,
                    assigneeId,
                    priority,
                    boardId,
                    tags,
                    status: 'todo',
                },
            });
            logger.info(`Task created: ${task.id} - ${title}`, { stepId });
            return {
                status: 'completed',
                output: { taskId: task.id, title, status: task.status },
            };
        }
        catch (error) {
            logger.error(`Task creation failed: ${error.message}`, { stepId });
            return {
                status: 'failed',
                error: { message: error.message },
            };
        }
    },
};
