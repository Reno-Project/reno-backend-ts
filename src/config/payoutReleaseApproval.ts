/**
 * PAYOUT_RELEASE approval permissions.
 * - Create: server-side when release mail is sent (reno-backend requestPayoutApproval)
 * - Review: user whose email matches app_config.PAYOUT_APPROVAL_MAIL
 */
export const PAYOUT_RELEASE_APPROVAL_CONFIG = {
  verifier: "payoutApprovalMail",
} as const;
