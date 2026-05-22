/**
 * FlowBoard Task API Routes
 * Lightweight kanban board management for workflow-generated tasks
 */
import { PrismaClient } from '@prisma/client';
import { ServiceLogger } from '@vistafam/pipevista-core';
const logger = new ServiceLogger('flowboard-api-tasks');
const prisma = new PrismaClient();
export async function taskRoutes(app) {
    // ── Boards ──────────────────────────────────────────────
    app.get('/v1/boards', async (req) => {
        const { tenantId } = req.query;
        const boards = await prisma.kanbanBoard.findMany({
            where: tenantId ? { tenantId } : undefined,
            include: { tasks: true },
        });
        return { boards };
    });
    app.post('/v1/boards', async (req, reply) => {
        const body = req.body;
        const board = await prisma.kanbanBoard.create({
            data: {
                tenantId: body.tenantId,
                name: body.name,
                workflowId: body.workflowId,
                columns: body.columns,
            },
        });
        reply.status(201).send({ board });
    });
    // ── Tasks ───────────────────────────────────────────────
    app.get('/v1/tasks', async (req) => {
        const { tenantId, boardId, assigneeId, status } = req.query;
        const where = {};
        if (tenantId)
            where.tenantId = tenantId;
        if (boardId)
            where.boardId = boardId;
        if (assigneeId)
            where.assigneeId = assigneeId;
        if (status)
            where.status = status;
        const tasks = await prisma.task.findMany({
            where,
            orderBy: [{ boardId: 'asc' }, { position: 'asc' }],
        });
        return { tasks };
    });
    app.post('/v1/tasks', async (req, reply) => {
        const body = req.body;
        const task = await prisma.task.create({
            data: {
                tenantId: body.tenantId,
                title: body.title,
                description: body.description,
                boardId: body.boardId,
                assigneeId: body.assigneeId,
                priority: body.priority ?? 'medium',
                dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
                tags: body.tags ?? [],
            },
        });
        logger.info(`Task created: ${task.title} (${task.id})`);
        reply.status(201).send({ task });
    });
    app.get('/v1/tasks/:id', async (req, reply) => {
        const { id } = req.params;
        const task = await prisma.task.findUnique({ where: { id } });
        if (!task) {
            reply.status(404).send({ error: 'Task not found' });
            return;
        }
        return { task };
    });
    app.put('/v1/tasks/:id', async (req, reply) => {
        const { id } = req.params;
        const body = req.body;
        const updateData = {};
        if (body.title !== undefined)
            updateData.title = body.title;
        if (body.description !== undefined)
            updateData.description = body.description;
        if (body.status !== undefined)
            updateData.status = body.status;
        if (body.assigneeId !== undefined)
            updateData.assigneeId = body.assigneeId;
        if (body.priority !== undefined)
            updateData.priority = body.priority;
        if (body.dueDate !== undefined)
            updateData.dueDate = new Date(body.dueDate);
        if (body.tags !== undefined)
            updateData.tags = body.tags;
        if (body.boardId !== undefined)
            updateData.boardId = body.boardId;
        if (body.position !== undefined)
            updateData.position = body.position;
        const task = await prisma.task.update({ where: { id }, data: updateData });
        return { task };
    });
    app.delete('/v1/tasks/:id', async (req, reply) => {
        const { id } = req.params;
        await prisma.task.delete({ where: { id } });
        reply.status(204).send();
    });
}
