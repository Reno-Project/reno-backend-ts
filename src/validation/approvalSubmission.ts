import { z } from "zod";

const jsonValue = z.union([z.record(z.unknown()), z.array(z.unknown())]);

const approvalSubmissionStatusEnum = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "PARTIALLY_APPROVED",
  "CANCELLED",
]);

export const listApprovalSubmissionsQuerySchema = z.object({
  status: approvalSubmissionStatusEnum.optional(),
  category: z.string().min(1).optional(),
  requested_by: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().optional(),
  per_page: z.coerce.number().int().positive().max(100).optional(),
});

export type ListApprovalSubmissionsQuery = z.infer<typeof listApprovalSubmissionsQuerySchema>;

export const createApprovalSubmissionItemSchema = z.object({
  itemType: z.string().min(1),
  itemId: z.string().min(1),
  itemSnapshot: z.union([jsonValue, z.string().min(1)]).optional(),
  itemNote: z.string().optional(),
});

export const createApprovalSubmissionSchema = z.object({
  contextType: z.string().min(1),
  contextId: z.number().int(),
  category: z.string().min(1).optional(),
  requestNote: z.string().optional(),
  items: z.array(createApprovalSubmissionItemSchema).optional(),
});

const renoReviewStatuses = z.enum(["APPROVED", "PARTIALLY_APPROVED", "REJECTED"]);
const creatorCancelStatus = z.enum(["CANCELLED"]);

export const updateApprovalSubmissionStatusSchema = z.discriminatedUnion("status", [
  z.object({
    status: renoReviewStatuses,
    reviewNote: z.string().optional(),
  }),
  z.object({
    status: creatorCancelStatus,
  }),
]);

export const submissionIdParamSchema = z.object({
  submissionId: z.coerce.number().int().positive(),
});

export const approvalSubmissionIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const reviewAllApprovalSubmissionSchema = z.object({
  reviewNote: z.string().optional(),
});

export const approvalSubmissionItemIdParamSchema = z.object({
  itemId: z.coerce.number().int().positive(),
});

export const updateApprovalSubmissionItemStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});
