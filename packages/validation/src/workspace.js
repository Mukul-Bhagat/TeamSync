import { z } from "zod";
export const createWorkspaceSchema = z.object({
    name: z.string().min(1, "Workspace name is required"),
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
    description: z.string().optional(),
    color: z.string().optional(),
});
export const updateWorkspaceSchema = createWorkspaceSchema.partial();
