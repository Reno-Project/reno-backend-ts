import { z } from "zod";
import { REGISTERED_APPROVAL_CATEGORIES } from "../config/approvalReviewers";

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
  contextType: z.string().min(1).optional(),
  contextId: z.coerce.number().int().positive().optional(),
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

const payoutEditAfterSchema = z
  .object({
    payoutName: z.string().optional(),
    due_date: z.string().optional(),
    amount: z.number().optional(),
    status: z.string().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "after must include at least one editable field",
  });

export const payoutEditSnapshotSchema = z.object({
  before: z.record(z.unknown()).optional(),
  after: payoutEditAfterSchema,
});

function parseItemSnapshot(snapshot: unknown): unknown {
  if (typeof snapshot === "string") {
    return JSON.parse(snapshot) as unknown;
  }
  return snapshot;
}

export function validateItemsForCategory(
  category: string | undefined,
  items: z.infer<typeof createApprovalSubmissionItemSchema>[] | undefined
): { ok: true } | { ok: false; message: string } {
  if (category !== "PAYOUT_EDIT" || items === undefined) {
    return { ok: true };
  }

  for (const item of items) {
    if (item.itemSnapshot === undefined) {
      return {
        ok: false,
        message: "PAYOUT_EDIT items require itemSnapshot with before/after",
      };
    }

    try {
      const parsed = parseItemSnapshot(item.itemSnapshot);
      const result = payoutEditSnapshotSchema.safeParse(parsed);
      if (!result.success) {
        return {
          ok: false,
          message: "PAYOUT_EDIT itemSnapshot must include a valid after object",
        };
      }
    } catch {
      return { ok: false, message: "itemSnapshot must be valid JSON" };
    }
  }

  return { ok: true };
}

export const createApprovalSubmissionSchema = z
  .object({
    contextType: z.string().min(1),
    contextId: z.number().int(),
    category: z.string().min(1).optional(),
    requestNote: z.string().optional(),
    items: z.array(createApprovalSubmissionItemSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.category !== undefined &&
      REGISTERED_APPROVAL_CATEGORIES.includes(
        data.category as (typeof REGISTERED_APPROVAL_CATEGORIES)[number]
      ) &&
      data.category === "PAYOUT_EDIT" &&
      (data.items === undefined || data.items.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "PAYOUT_EDIT submissions require at least one item",
        path: ["items"],
      });
    }
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
