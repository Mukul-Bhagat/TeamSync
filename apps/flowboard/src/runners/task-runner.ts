/**
 * Task Creation Step Runner
 * Creates kanban tasks from workflow steps
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { StepRunner, StepResult } from './index.js';
import { evaluateTemplate, ExecutionContext } from '../engine/template-engine.js';
import { ServiceLogger } from '@vistafam/pipevista-core';

const logger = new ServiceLogger('flowboard-runner-task');
const prisma = new PrismaClient();

export const taskRunner: StepRunner = {
  async execute(stepId: string, config: Record<string, unknown>, context: ExecutionContext): Promise<StepResult> {
    try {
      const executionId = context.execution!.id;
      const tenantId = context.tenantId ?? 'default';
      const title = evaluateTemplate(config.title as string, context) as string;
      const description = evaluateTemplate(config.description as string, context) as string | undefined;
      const assigneeId = evaluateTemplate(config.assigneeId as string, context) as string | undefined;
      const priority = (config.priority as string) ?? 'medium';
      const boardId = evaluateTemplate(config.boardId as string, context) as string | undefined;
      const tags = (config.tags as string[]) ?? [];

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
    } catch (error: any) {
      logger.error(`Task creation failed: ${error.message}`, { stepId });
      return {
        status: 'failed',
        error: { message: error.message },
      };
    }
  },
};
