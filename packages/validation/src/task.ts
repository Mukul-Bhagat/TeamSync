import { z } from "zod";

export const taskStatusSchema = z.enum(["todo", "in_progress", "review", "done"]);
export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: taskStatusSchema.default("todo"),
  priority: taskPrioritySchema.default("medium"),
  assigneeId: z.string().uuid().optional().or(z.literal("")),
  dueDate: z.string().datetime().optional().or(z.literal("")),
});

export const updateTaskSchema = createTaskSchema.partial();

export const createCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty"),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
