import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  color: z.string().optional(),
});

export const createPageSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  content: z.string().min(1, "Content is required"),
  excerpt: z.string().optional(),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  parentId: z.string().uuid().optional().or(z.literal("")),
  isPublished: z.boolean().default(true),
});

export const updatePageSchema = createPageSchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
