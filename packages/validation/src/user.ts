import { z } from "zod";

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  status: z.enum(["online", "offline", "away"]).optional(),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
