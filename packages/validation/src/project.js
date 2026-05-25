import { z } from "zod";
export const projectStatusSchema = z.enum(["planning", "active", "paused", "completed", "archived"]);
export const createProjectSchema = z.object({
    name: z.string().min(1, "Project name is required"),
    description: z.string().optional(),
    status: projectStatusSchema.default("planning"),
    color: z.string().optional(),
    startDate: z.string().datetime().optional().or(z.literal("")),
    endDate: z.string().datetime().optional().or(z.literal("")),
});
export const updateProjectSchema = createProjectSchema.partial();
