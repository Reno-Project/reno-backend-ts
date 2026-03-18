import { z } from "zod";

export const createMessageSchema = z.object({
  conversationId: z.number().int(),
  userId: z.string().min(1),
  body: z.string().min(1),
});

export const listMessagesSchema = z.object({
  conversation: z
    .string()
    .regex(/^\d+$/)
    .optional(),
  user: z.string().min(1).optional(),
});
