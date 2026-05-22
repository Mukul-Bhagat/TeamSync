import { z } from "zod";

export const createChannelSchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9-]+$/, "Channel name must be lowercase alphanumeric with hyphens"),
  description: z.string().optional(),
  isPrivate: z.boolean().default(false),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(4000, "Message too long"),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
