# Engineering Manual: Adding Approval Categories

This guide outlines the standardized process for implementing new approval workflows within the system, such as `BILLING_MILESTONE_STATUS_EDIT`.

## 1. Create a Permission Configuration File (Optional)

Define the specific access control logic for the new category by creating a configuration file under `src/config/`.

The default behavior is to allow anybody to create an approval submission while only allowing admins / superadmins to review it.

**Example:** `src/config/billingMilestoneStatusEditApproval.ts`

```ts
/**
 * BILLING_MILESTONE_STATUS_EDIT permissions configuration.
 * - Create: user id 1404 only
 * - Review: user id 1358 only
 */
export const BILLING_MILESTONE_STATUS_EDIT_APPROVAL_CONFIG = {
  // Option A: Restrict who can initiate the approval
  creators: [
    { id: 1404 },
    { email: "user@example.com" },
  ],

  // Option B: Restrict reviewers (this overrides the default verifier)
  reviewers: [
    { id: 1358 },
  ],

  // Option C: Use a built-in system verifier instead of specific reviewers
  // verifier: "renoAdmin" | "payoutManager" | "payoutApprovalMail",
};
```

### Permission Rule Reference

| Configuration | Create Permission | Review Permission |
|---|---|---|
| Nothing set | Anyone authenticated | Default verifier, or any `reno` user |
| `creators: [...]` | Only listed User IDs/Emails | — |
| `reviewers: [...]` | — | Only listed User IDs/Emails |
| `verifier: "renoAdmin"` | — | System Administrators |
| `verifier: "payoutApprovalMail"` | — | Email matching `PAYOUT_APPROVAL_MAIL` |

**Note:** Each entry in the lists must be strictly `{ id: number }` or `{ email: string }`, never both. To prevent conflicts of interest, users who are both creators and reviewers cannot review their own submissions.

---

## 2. Register the Category

Once the configuration is defined, it must be registered within the central approval registry.

**Location:** `src/config/approvalReviewers.ts`

```ts
import { BILLING_MILESTONE_STATUS_EDIT_APPROVAL_CONFIG } from "./billingMilestoneStatusEditApproval";

export const APPROVAL_REVIEWER_BY_CATEGORY: Record<string, ApprovalCategoryConfig> = {
  // ...existing categories...
  BILLING_MILESTONE_STATUS_EDIT: BILLING_MILESTONE_STATUS_EDIT_APPROVAL_CONFIG,
};

export type ApprovalCategory =
  | "START_PROJECT_ADMIN"
  | "PAYOUT_EDIT"
  | "BILLING_MILESTONE_STATUS_EDIT"; // Append new category here
```

The system constant `REGISTERED_APPROVAL_CATEGORIES` will update automatically based on these object keys.

---

## 3. Implement Category-Specific Validation

Most approval categories require no additional validation. `BILLING_MILESTONE_STATUS_EDIT` is an example of this — no changes to validation are needed.

However, if your category requires specific item shapes or mandatory fields, you must update the validation logic.

**Location:** `src/validation/approvalSubmission.ts`

Refer to the `PAYOUT_EDIT` implementation for patterns on:

- `validateItemsForCategory()` — defines the required schema for `itemSnapshot` and individual item shapes
- `createApprovalSubmissionSchema.superRefine()` — used for cross-field validation, such as ensuring at least one item is present in the submission

If the category requires unique metadata validation, ensure these constraints are added to the submission schema logic.

---

## 4. Implement Side Effects

In the **reno-backend** repository, `src/app/controllers/approval-submission.js` contains a switch case where you can add your newly created approval category. This is a webhook handler that runs whenever the status of any approval changes.

When a submission status changes in **reno-backend-ts**, a webhook is posted to the reno-backend `API_V1` endpoint (`/approval-submission/webhook`). Add a case for your category in that switch to handle approved, rejected, or cancelled outcomes — for example, applying a billing milestone status update when `BILLING_MILESTONE_STATUS_EDIT` is approved.

**Location (reno-backend-ts):** `src/services/approvalSubmissionWebhook.service.ts` — fires the webhook on status change. No changes needed here unless you need a new webhook payload shape.

**Location (reno-backend):** `src/app/controllers/approval-submission.js` — add your category to the switch case to implement the business logic that runs on status change.
