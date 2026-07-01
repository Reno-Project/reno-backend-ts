import { PAYOUT_EDIT_APPROVAL_CONFIG } from "./payoutEditApproval";
import { BILLING_MILESTONE_STATUS_EDIT_APPROVAL_CONFIG } from "./billingMilestoneStatusEditApproval";

export type ApprovalVerifierType = "renoAdmin" | "payoutManager" | "payoutApprovalMail";

export type PermissionEntry = { id: number } | { email: string };

export type ApprovalCategoryConfig = {
  verifier?: ApprovalVerifierType;
  creators?: PermissionEntry[];
  reviewers?: PermissionEntry[];
};

export const APPROVAL_REVIEWER_BY_CATEGORY: Record<string, ApprovalCategoryConfig> = {
  START_PROJECT_ADMIN: { verifier: "renoAdmin" },
  PAYOUT_EDIT: PAYOUT_EDIT_APPROVAL_CONFIG,
  BILLING_MILESTONE_STATUS_EDIT: BILLING_MILESTONE_STATUS_EDIT_APPROVAL_CONFIG,
};

export type ApprovalCategory =
  | "START_PROJECT_ADMIN"
  | "PAYOUT_EDIT"
  | "BILLING_MILESTONE_STATUS_EDIT";

export const REGISTERED_APPROVAL_CATEGORIES = Object.keys(
  APPROVAL_REVIEWER_BY_CATEGORY
) as ApprovalCategory[];

export function isRegisteredApprovalCategory(
  category: string | null | undefined
): category is ApprovalCategory {
  return (
    category !== null &&
    category !== undefined &&
    category in APPROVAL_REVIEWER_BY_CATEGORY
  );
}

export function getReviewerConfig(
  category: string | null | undefined
): ApprovalCategoryConfig | null {
  if (!isRegisteredApprovalCategory(category)) {
    return null;
  }
  return APPROVAL_REVIEWER_BY_CATEGORY[category] ?? null;
}
