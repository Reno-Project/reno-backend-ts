# Approval Submissions API

Base path: `/approval-submissions`

All endpoints return `{ error, data }`. Send `Authorization: Bearer <token>` unless noted.

## Category-based reviewers

Who may list (inbox), read (non-requester), and approve/reject is determined by submission **`category`**. Configured in [`src/config/approvalReviewers.ts`](../src/config/approvalReviewers.ts).

| `category` | Reviewer |
|------------|----------|
| `START_PROJECT_ADMIN` | Reno admin (`RENO_ADMIN` / `RENO_SUPER_ADMIN` in `user_roles`) |
| `PAYOUT_EDIT` | User whose email matches `app_config.config_value` where `config_key` is `PAYOUT_MANAGER` or `PAYOUT_APPROVAL_MAIL` |
| *(unmapped)* | Any user with `reno` role (legacy) |

Submit (`POST /`) is open to any authenticated user. Requesters can always read/cancel their own submissions.

---

## Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | Bearer (reviewer) | Reviewer inbox. Returns submissions for categories the caller can review. Optional query: `status`, `category`, `page`, `per_page`. |
| `GET` | `/user-submissions` | Bearer | Submissions requested by the current user. |
| `GET` | `/:id` | Bearer | Fetch submission + items. Requester or category reviewer. |
| `POST` | `/` | Bearer | Create submission (`PENDING`). Requires `contextType`, `contextId`; optional `category`, `requestNote`, `items[]`. |
| `PATCH` | `/:id/status` | Bearer | Requester: `CANCELLED`. Reviewer: `APPROVED`, `PARTIALLY_APPROVED`, `REJECTED`. |
| `POST` | `/:id/approve-all` | Bearer (category reviewer) | Approve all items and submission. |
| `POST` | `/:id/reject-all` | Bearer (category reviewer) | Reject all items and submission. |
| `POST` | `/:submissionId/items` | Bearer (requester) | Add item to pending submission. |
| `GET` | `/items/:itemId` | Bearer | Fetch item. Requester or category reviewer. |
| `PATCH` | `/items/:itemId/status` | Bearer (category reviewer) | Approve/reject item. Auto-syncs submission to `PARTIALLY_APPROVED` / `APPROVED`. |

---

## Workflows

### `PAYOUT_EDIT` — contractor payout field changes

**Reviewer:** payout manager (`PAYOUT_MANAGER` in `app_config`).

```json
POST /approval-submissions
{
  "contextType": "contractor_payout",
  "contextId": 42,
  "category": "PAYOUT_EDIT",
  "requestNote": "Client approved higher amount",
  "items": [{
    "itemType": "contractor_payout",
    "itemId": "42",
    "itemSnapshot": {
      "before": {
        "payoutName": "March draw",
        "due_date": "2026-03-01",
        "amount": 5000,
        "status": "pending"
      },
      "after": {
        "amount": 5500,
        "due_date": "2026-03-15"
      }
    }
  }]
}
```

`itemSnapshot.after` may only include: `payoutName`, `due_date`, `amount`, `status` (at least one required).

On approve, API_V1 applies the patch — see [api-v1-approval-webhooks.md](./api-v1-approval-webhooks.md).

### `START_PROJECT_ADMIN` — start project

**Reviewer:** Reno admin (`isRenoAdmin`).

```json
POST /approval-submissions
{
  "contextType": "project",
  "contextId": 100,
  "category": "START_PROJECT_ADMIN",
  "requestNote": "Ready to start",
  "items": [{
    "itemType": "project",
    "itemId": "100",
    "itemSnapshot": {}
  }]
}
```

---

## Request bodies

### `POST /`

```json
{
  "contextType": "string",
  "contextId": 1,
  "category": "string",
  "requestNote": "string",
  "items": [
    {
      "itemType": "string",
      "itemId": "abc-123",
      "itemSnapshot": {},
      "itemNote": "string"
    }
  ]
}
```

### `PATCH /:id/status`

Requester cancelling:

```json
{ "status": "CANCELLED" }
```

Reviewer:

```json
{
  "status": "APPROVED",
  "reviewNote": "string"
}
```

### `PATCH /items/:itemId/status`

```json
{ "status": "APPROVED" }
```

---

## Response shapes

### `ApprovalSubmissionRequesterDTO` (`requestedBy`)

```json
{
  "id": 10,
  "role": "string | null",
  "is_deleted": 0,
  "is_block": 0
}
```

### `ApprovalSubmissionDTO`

```json
{
  "id": 42,
  "category": "PAYOUT_EDIT",
  "contextType": "contractor_payout",
  "contextId": 42,
  "status": "PENDING",
  "requestedBy": { "...ApprovalSubmissionRequesterDTO" },
  "requestedAt": "ISO8601",
  "requestNote": "string | null",
  "requestPayload": "string | null",
  "reviewedBy": "number | null",
  "reviewedAt": "ISO8601 | null",
  "reviewNote": "string | null"
}
```

### `ApprovalSubmissionItemDTO`

```json
{
  "id": 1,
  "submissionId": 42,
  "itemType": "contractor_payout",
  "itemId": "42",
  "itemSnapshot": "string | null",
  "status": "PENDING",
  "decidedAt": "ISO8601 | null",
  "itemNote": "string | null"
}
```

---

## Status codes

| Code | When |
|------|------|
| `200` | Success |
| `201` | Created |
| `400` | Invalid params/body or category validation failed |
| `403` | Unauthorized or not allowed to review this category |
| `404` | Not found |
| `500` | Server error |
