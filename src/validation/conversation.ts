import { z } from "zod";

export const createConversationSchema = z.object({
  entityType: z.string().nullable().optional(),
  entityId: z.string().nullable().optional(),
  parentConversationId: z.number().int().nullable().optional(),
  members: z.array(z.unknown()).optional(),
  createdBy: z.string().min(1),
});

export const updateConversationSchema = z.object({
  entityType: z.string().nullable().optional(),
  entityId: z.string().nullable().optional(),
  parentConversationId: z.number().int().nullable().optional(),
  members: z.array(z.unknown()).optional(),
  createdBy: z.string().min(1).optional(),
});

export const joinLeaveSchema = z.object({
  userId: z.string().min(1),
});
