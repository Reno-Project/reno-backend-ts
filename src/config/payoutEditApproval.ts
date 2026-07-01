/**
 * PAYOUT_EDIT approval permissions.
 * - Create: anyone authenticated (no creators override)
 * - Review: user whose email matches app_config.PAYOUT_APPROVAL_MAIL
 */
export const PAYOUT_EDIT_APPROVAL_CONFIG = {
  verifier: "payoutApprovalMail",
} as const;
