/**
 * Approval Step Runner
 * Creates approval request and pauses execution
 */
import { PrismaClient } from '@prisma/client';
import { evaluateTemplate } from '../engine/template-engine.js';
import { ServiceLogger } from '@vistafam/pipevista-core';
const logger = new ServiceLogger('flowboard-runner-approval');
const prisma = new PrismaClient();
export const approvalRunner = {
    async execute(stepId, config, context) {
        try {
            const executionId = context.execution.id;
            const tenantId = context.tenantId ?? 'default';
            const approvers = config.approvers ?? [];
            const message = evaluateTemplate(config.message, context);
            const deadlineMinutes = config.deadlineMinutes ?? 1440; // 24h default
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
        }
        catch (error) {
            logger.error(`Approval creation failed: ${error.message}`, { stepId });
            return {
                status: 'failed',
                error: { message: error.message },
            };
        }
    },
};
