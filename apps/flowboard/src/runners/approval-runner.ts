/**
 * Approval Step Runner
 * Creates approval request and pauses execution
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { StepRunner, StepResult } from './index.js';
import { evaluateTemplate, ExecutionContext } from '../engine/template-engine.js';
import { ServiceLogger } from '@vistafam/pipevista-core';

const logger = new ServiceLogger('flowboard-runner-approval');
const prisma = new PrismaClient();

export const approvalRunner: StepRunner = {
  async execute(stepId: string, config: Record<string, unknown>, context: ExecutionContext): Promise<StepResult> {
    try {
      const executionId = context.execution!.id;
      const tenantId = context.tenantId ?? 'default';
      const approvers = (config.approvers as string[]) ?? [];
      const message = evaluateTemplate(config.message as string, context) as string;
      const deadlineMinutes = (config.deadlineMinutes as number) ?? 1440; // 24h default
      const deadline = new Date(Date.now() + deadlineMinutes * 60 * 1000);

      const approval = await prisma.approval.create({
        data: {
          executionId,
          stepId,
          tenantId,
          status: 'pending',
          approvers,
          comment: message,
          deadline,
        },
      });

      logger.info(`Approval created: ${approval.id} for execution ${executionId}`, { stepId });

      return {
        status: 'waiting_approval',
        output: { approvalId: approval.id, approvers, deadline },
      };
    } catch (error: any) {
      logger.error(`Approval creation failed: ${error.message}`, { stepId });
      return {
        status: 'failed',
        error: { message: error.message },
      };
    }
  },
};
