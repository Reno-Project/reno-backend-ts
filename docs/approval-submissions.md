# Approval Submissions API

All endpoints are under `/approval-submissions` and require a **Bearer JWT** (`Authorization: Bearer <token>`).

Every response uses this wrapper:

```json
{
  "error": null,
  "data": { ... }
}
```

On failure, `error` is `{ "message": "...", "details": ... }` and `data` is `null`.

---

## Approval Submissions

### POST /approval-submissions

Create a new approval submission (optionally with items).

**Request Body:**

```json
{
  "contextType": "project",
  "contextId": 42,
  "category": "PAYOUT_EDIT",
  "requestNote": "Please review payout changes",
  "items": [
    {
      "itemType": "payout",
      "itemId": "payout-123",
      "itemSnapshot": {
        "before": {
          "payoutName": "Milestone 1",
          "amount": 1000,
          "due_date": "2026-01-15",
          "status": "pending"
        },
        "after": {
          "amount": 1200,
          "due_date": "2026-02-01"
        }
      },
      "itemNote": "Amount and due date updated"
    }
  ]
}
```

**required fields:** `contextType`, `contextId`

**conditional requirements:**

- If `category` is `"PAYOUT_EDIT"`: `items` is required with at least one item; each item must have `itemSnapshot` with a valid `after` object (at least one of `payoutName`, `due_date`, `amount`, `status`)

**optional fields:** `category`, `requestNote`, `items`

**registered categories:** `START_PROJECT_ADMIN`, `PAYOUT_EDIT`, `BILLING_MILESTONE_STATUS_EDIT`

**Response Body (201):**

```json
{
  "error": null,
  "data": {
    "id": 1,
    "category": "PAYOUT_EDIT",
    "contextType": "project",
    "contextId": 42,
    "status": "PENDING",
    "requestedBy": {
      "id": 7,
      "role": "contractor",
      "is_deleted": 0,
      "is_block": 0
    },
    "requestedAt": "2026-06-23T10:00:00.000Z",
    "requestNote": "Please review payout changes",
    "requestPayload": null,
    "reviewedBy": null,
    "reviewedAt": null,
    "reviewNote": null,
    "items": [
      {
        "id": 10,
        "submissionId": 1,
        "itemType": "payout",
        "itemId": "payout-123",
        "itemSnapshot": "{\"before\":{...},\"after\":{...}}",
        "status": "PENDING",
        "decidedAt": null,
        "itemNote": "Amount and due date updated"
      }
    ]
  }
}
```

---

### GET /approval-submissions

List submissions the current user is allowed to review (scoped by reviewer permissions).

**Query params (all optional):**

- `status` — `PENDING` | `APPROVED` | `REJECTED` | `PARTIALLY_APPROVED` | `CANCELLED`
- `category` — string
- `contextType` — string
- `contextId` — positive integer
- `requested_by` — positive integer
- `page` — positive integer (use with `per_page`)
- `per_page` — positive integer, max 100 (use with `page`)

Omit both `page` and `per_page` to return all results.

**Response Body (200):**

```json
{
  "error": null,
  "data": {
    "submissions": [
      {
        "id": 1,
        "category": "PAYOUT_EDIT",
        "contextType": "project",
        "contextId": 42,
        "status": "PENDING",
        "requestedBy": {
          "id": 7,
          "role": "contractor",
          "is_deleted": 0,
          "is_block": 0
        },
        "requestedAt": "2026-06-23T10:00:00.000Z",
        "requestNote": "Please review payout changes",
        "requestPayload": null,
        "reviewedBy": null,
        "reviewedAt": null,
        "reviewNote": null,
        "items": [ ... ]
      }
    ],
    "perms": ["create", "review"],
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 1,
      "total_pages": 1
    }
  }
}
```

---

### GET /approval-submissions/user-submissions

List submissions created by the current user. Same query params and response shape as `GET /approval-submissions` (except `requested_by` is ignored — always filtered to the current user).

---

### GET /approval-submissions/:id

Get a single submission with nested items.

**Path params:** `id` — positive integer

**Response Body (200):**

```json
{
  "error": null,
  "data": {
    "id": 1,
    "category": "PAYOUT_EDIT",
    "contextType": "project",
    "contextId": 42,
    "status": "PENDING",
    "requestedBy": {
      "id": 7,
      "role": "contractor",
      "is_deleted": 0,
      "is_block": 0
    },
    "requestedAt": "2026-06-23T10:00:00.000Z",
    "requestNote": "Please review payout changes",
    "requestPayload": null,
    "reviewedBy": null,
    "reviewedAt": null,
    "reviewNote": null,
    "items": [ ... ]
  }
}
```

---

### PATCH /approval-submissions/:id/status

Update submission status.

**Path params:** `id` — positive integer

**Request Body (reviewer):**

```json
{
  "status": "APPROVED",
  "reviewNote": "Looks good"
}
```

**Request Body (requester cancel):**

```json
{
  "status": "CANCELLED"
}
```

**required fields:** `status`

**status values:**

- Reviewer: `APPROVED` | `PARTIALLY_APPROVED` | `REJECTED` (+ optional `reviewNote`)
- Requester only: `CANCELLED`

Submission must be `PENDING`.

**Response Body (200):**

```json
{
  "error": null,
  "data": {
    "id": 1,
    "category": "PAYOUT_EDIT",
    "contextType": "project",
    "contextId": 42,
    "status": "APPROVED",
    "requestedBy": {
      "id": 7,
      "role": "contractor",
      "is_deleted": 0,
      "is_block": 0
    },
    "requestedAt": "2026-06-23T10:00:00.000Z",
    "requestNote": "Please review payout changes",
    "requestPayload": null,
    "reviewedBy": 3,
    "reviewedAt": "2026-06-23T12:00:00.000Z",
    "reviewNote": "Looks good"
  }
}
```

---

### POST /approval-submissions/:id/approve-all

Approve all items and the submission in one action.

**Path params:** `id` — positive integer

**Request Body:**

```json
{
  "reviewNote": "All approved"
}
```

**required fields:** none (`reviewNote` is optional)

**Response Body (200):**

```json
{
  "error": null,
  "data": {
    "submission": {
      "id": 1,
      "category": "PAYOUT_EDIT",
      "contextType": "project",
      "contextId": 42,
      "status": "APPROVED",
      "requestedBy": { "id": 7, "role": "contractor", "is_deleted": 0, "is_block": 0 },
      "requestedAt": "2026-06-23T10:00:00.000Z",
      "requestNote": "Please review payout changes",
      "requestPayload": null,
      "reviewedBy": 3,
      "reviewedAt": "2026-06-23T12:00:00.000Z",
      "reviewNote": "All approved"
    },
    "items": [
      {
        "id": 10,
        "submissionId": 1,
        "itemType": "payout",
        "itemId": "payout-123",
        "itemSnapshot": "{...}",
        "status": "APPROVED",
        "decidedAt": "2026-06-23T12:00:00.000Z",
        "itemNote": null
      }
    ]
  }
}
```

---

### POST /approval-submissions/:id/reject-all

Reject all items and the submission in one action. Same request/response shape as `approve-all`, but statuses become `REJECTED`.

**Request Body:**

```json
{
  "reviewNote": "Rejected — incorrect amounts"
}
```

**required fields:** none

---

## Approval Submission Items

### POST /approval-submissions/:submissionId/items

Add an item to an existing `PENDING` submission. Only the original requester can add items.

**Path params:** `submissionId` — positive integer

**Request Body:**

```json
{
  "itemType": "payout",
  "itemId": "payout-456",
  "itemSnapshot": {
    "before": { "amount": 500 },
    "after": { "amount": 600 }
  },
  "itemNote": "Second payout adjustment"
}
```

**required fields:** `itemType`, `itemId`

**optional fields:** `itemSnapshot`, `itemNote`

**conditional:** For `PAYOUT_EDIT` submissions, `itemSnapshot` is required with valid `before`/`after` shape (same rules as create).

`itemSnapshot` can be a JSON object or a JSON string.

**Response Body (201):**

```json
{
  "error": null,
  "data": {
    "id": 11,
    "submissionId": 1,
    "itemType": "payout",
    "itemId": "payout-456",
    "itemSnapshot": "{\"before\":{\"amount\":500},\"after\":{\"amount\":600}}",
    "status": "PENDING",
    "decidedAt": null,
    "itemNote": "Second payout adjustment"
  }
}
```

---

### GET /approval-submissions/items/:itemId

Get a single item by ID.

**Path params:** `itemId` — positive integer

**Response Body (200):**

```json
{
  "error": null,
  "data": {
    "id": 10,
    "submissionId": 1,
    "itemType": "payout",
    "itemId": "payout-123",
    "itemSnapshot": "{\"before\":{...},\"after\":{...}}",
    "status": "PENDING",
    "decidedAt": null,
    "itemNote": "Amount and due date updated"
  }
}
```

---

### PATCH /approval-submissions/items/:itemId/status

Approve or reject a single item. May auto-update the parent submission to `APPROVED` or `PARTIALLY_APPROVED` when all/some items are approved.

**Path params:** `itemId` — positive integer

**Request Body:**

```json
{
  "status": "APPROVED"
}
```

**required fields:** `status`

**status values:** `APPROVED` | `REJECTED`

Item must be `PENDING`. Parent submission must be `PENDING` or `PARTIALLY_APPROVED`.

**Response Body (200):**

```json
{
  "error": null,
  "data": {
    "id": 10,
    "submissionId": 1,
    "itemType": "payout",
    "itemId": "payout-123",
    "itemSnapshot": "{...}",
    "status": "APPROVED",
    "decidedAt": "2026-06-23T12:00:00.000Z",
    "itemNote": "Amount and due date updated"
  }
}
```

---

## Permissions

Permissions are configured per category in [`src/config/approvalReviewers.ts`](../src/config/approvalReviewers.ts). Overrides are **opt-in** — if a category has no `creators` or `reviewers` list, behavior is unchanged from the defaults below.

### Defaults (no override in config)

| Action | Who is allowed |
|---|---|
| Create | Any authenticated user |
| Review `START_PROJECT_ADMIN` | Reno admins (`RENO_ADMIN`, `RENO_SUPER_ADMIN` roles) |
| Review `PAYOUT_EDIT` | User whose email matches `app_config.PAYOUT_APPROVAL_MAIL` |
| Review `BILLING_MILESTONE_STATUS_EDIT` | User id `1358` |
| Create `BILLING_MILESTONE_STATUS_EDIT` | User id `1404` only |
| Review unmapped / unknown category | Any `reno` user |

### Config overrides

Each `creators` or `reviewers` entry is **either** a user ID **or** an email — one field per entry, never both:

```ts
export type PermissionEntry =
  | { id: number }
  | { email: string };

// Example:
SOME_CATEGORY: {
  creators: [
    { id: 7 },
    { email: "contractor@example.com" },
  ],
  reviewers: [
    { id: 3 },
    { email: "admin@example.com" },
  ],
}
```

| Config | Effect |
|---|---|
| `creators` non-empty | Only users matching **any** entry can create submissions for that category |
| `reviewers` non-empty | Only users matching **any** entry can review that category (replaces `verifier`) |
| `verifier` (no `reviewers`) | Existing verifier logic applies (`renoAdmin` or `payoutManager`) |

**Matching rules:**

- `{ id: N }` — allowed if `req.user.id === N`
- `{ email: "..." }` — allowed if the user's email matches (case-insensitive; JWT first, then `users` table)

### List filtering

`GET /approval-submissions` and `GET /approval-submissions/user-submissions` only return submissions whose category the current user may **create or review**.

Each list response includes a top-level **`perms`** field (sibling to `submissions`, not inside each submission): an array of `"create"` and/or `"review"` for the **current user**.

- With `?category=...`: `perms` reflects create/review access for that category.
- Without a category filter: `perms` is the union of create/review across the unique categories in the returned submissions.

Examples: `"perms": ["review"]`, `"perms": ["create"]`, or `"perms": ["create", "review"]`.

If the user has both create and review for a category, they **cannot review their own** submissions. On `user-submissions` lists (all own), `perms` omits `"review"` in that case. On mixed lists, hide review actions for rows where `requestedBy.id` matches the current user.

- With `?category=...`: if the user lacks both permissions for that category, the response is an empty list (not 403).
- Without a category filter: the query is scoped to accessible categories at the DB level, then results are filtered again per submission as a safety net.
- Permission resolution is centralized in `canUserAccessCategoryForList` (config today; DB joins later).

### 403 errors

Create attempts by unauthorized users return:

```json
{
  "error": { "message": "You are not allowed to create submissions for category \"SOME_CATEGORY\"" },
  "data": null
}
```

Review attempts by unauthorized users return:

```json
{
  "error": { "message": "You are not allowed to review submissions for category \"SOME_CATEGORY\"" },
  "data": null
}
```

---

## Shared Types

**Submission status:** `PENDING` | `APPROVED` | `REJECTED` | `PARTIALLY_APPROVED` | `CANCELLED`

**Item status:** `PENDING` | `APPROVED` | `REJECTED`

**PAYOUT_EDIT itemSnapshot shape:**

```json
{
  "before": { },
  "after": {
    "payoutName": "string",
    "due_date": "string",
    "amount": 1200,
    "status": "string"
  }
}
```

`after` must include at least one editable field (`payoutName`, `due_date`, `amount`, or `status`).
