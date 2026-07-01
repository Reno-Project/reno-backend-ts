/**
 * BILLING_MILESTONE_STATUS_EDIT approval permissions.
 * - Create: user id 1404 only
 * - Review: user id 1358 only
 */
export const BILLING_MILESTONE_STATUS_EDIT_APPROVAL_CONFIG = {
  creators: [{ id: 1404 }, { email: "ohayouarmaan@gmail.com" }],
  reviewers: [{ email: "ohayouarmaan@gmail.com" }, { id: 1404 }],
};
