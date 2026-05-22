/**
 * FlowBoard Approval API Routes
 * Human-in-the-loop: list, approve, reject approvals
 */
import { PrismaClient } from '@prisma/client';
import { ServiceLogger } from '@vistafam/pipevista-core';
import { resumeExecution } from '../engine/execution-manager.js';
const logger = new ServiceLogger('flowboard-api-approvals');
const prisma = new PrismaClient();
export async function approvalRoutes(app) {
    // List pending approvals for a user
    app.get('/v1/approvals', async (req) => {
        const { tenantId, status, approverId } = req.query;
        const where = {};
        if (tenantId)
            where.tenantId = tenantId;
        if (status)
            where.status = status;
        if (approverId)
            where.approvers = { has: approverId };
        const approvals = await prisma.approval.findMany({
            where,
            include: { execution: { include: { workflow: true } } },
            orderBy: { createdAt: 'desc' },
        });
        return { approvals };
    });
    // Get approval by ID
    app.get('/v1/approvals/:id', async (req, reply) => {
        const { id } = req.params;
        const approval = await prisma.approval.findUnique({
            where: { id },
            include: { execution: true },
        });
        if (!approval) {
            reply.status(404).send({ error: 'Approval not found' });
            return;
        }
        return { approval };
    });
    // Approve
    app.post('/v1/approvals/:id/approve', async (req, reply) => {
        const { id } = req.params;
        const body = req.body;
        const approval = await prisma.approval.update({
            where: { id },
            data: {
                status: 'approved',
                approvedBy: body.approvedBy,
                comment: body.comment,
                respondedAt: new Date(),
            },
        });
        // Resume execution
        const execution = await prisma.execution.findUnique({
            where: { id: approval.executionId },
            include: { steps: true },
        });
        if (execution) {
            // Update the approval step
            await prisma.executionStep.updateMany({
                where: { executionId: execution.id, stepId: approval.stepId },
                data: {
                    status: 'completed',
                    output: { approved: true, comment: body.comment, approvedBy: body.approvedBy },
                    completedAt: new Date(),
                },
            });
            // Resume execution
            await resumeExecution(execution.id);
            logger.info(`Approval ${id} approved by ${body.approvedBy}, execution ${execution.id} resumed`);
        }
        return { approval };
    });
    // Reject
    app.post('/v1/approvals/:id/reject', async (req, reply) => {
        const { id } = req.params;
        const body = req.body;
        const approval = await prisma.approval.update({
            where: { id },
            data: {
                status: 'rejected',
                approvedBy: body.rejectedBy,
                comment: body.comment,
                respondedAt: new Date(),
            },
        });
        // Fail execution
        const execution = await prisma.execution.findUnique({
            where: { id: approval.executionId },
        });
        if (execution) {
            await prisma.execution.update({
                where: { id: execution.id },
                data: {
                    status: 'failed',
                    error: { message: `Approval rejected: ${body.comment ?? 'No comment'}`, stepId: approval.stepId },
                    completedAt: new Date(),
                },
            });
            await prisma.executionStep.updateMany({
                where: { executionId: execution.id, stepId: approval.stepId },
                data: {
                    status: 'failed',
                    error: { message: `Approval rejected by ${body.rejectedBy}` },
                    completedAt: new Date(),
                },
            });
            logger.info(`Approval ${id} rejected by ${body.rejectedBy}, execution ${execution.id} failed`);
        }
        return { approval };
    });
}
