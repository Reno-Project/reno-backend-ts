export type ApprovalVerifierType = "renoAdmin" | "payoutManager";

export type ApprovalReviewerConfig = {
  verifier: ApprovalVerifierType;
};

export const APPROVAL_REVIEWER_BY_CATEGORY = {
  START_PROJECT_ADMIN: { verifier: "renoAdmin" },
  PAYOUT_EDIT: { verifier: "payoutManager" },
} as const satisfies Record<string, ApprovalReviewerConfig>;

export type ApprovalCategory = keyof typeof APPROVAL_REVIEWER_BY_CATEGORY;

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
): ApprovalReviewerConfig | null {
  if (!isRegisteredApprovalCategory(category)) {
    return null;
  }
  return APPROVAL_REVIEWER_BY_CATEGORY[category];
}
