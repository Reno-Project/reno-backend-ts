# Approval Submissions API

Base path: `/approval-submissions`

All endpoints return `{ error, data }`. Send `Authorization: Bearer <token>` unless noted.

## Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | Reno | List all submissions with nested items. Optional query: `status`, `category`, `requested_by`, `page`, `per_page` (max 100). Omit `page`/`per_page` to return all results. |
| `GET` | `/user-submissions` | Bearer | List submissions requested by the current user. Same query params as above except `requested_by` is ignored. |
| `GET` | `/:id` | Bearer (Reno or requester only) | Fetch a single submission by ID, including its items. |
| `POST` | `/` | Bearer | Create a submission (`PENDING`). Requires `contextType`, `contextId`; optional `category`, `requestNote`, `items[]`. |
| `PATCH` | `/:id/status` | Bearer | Update submission status. Requester may set `CANCELLED`; Reno may set `APPROVED`, `PARTIALLY_APPROVED`, or `REJECTED` (optional `reviewNote`). Submission must be `PENDING`. |
| `POST` | `/:id/approve-all` | Reno | Approve all items and the submission in one transaction. Optional body: `reviewNote`. Submission must be `PENDING`. |
| `POST` | `/:id/reject-all` | Reno | Reject all items and the submission in one transaction. Optional body: `reviewNote`. Submission must be `PENDING`. |
| `POST` | `/:submissionId/items` | Bearer (requester only) | Add an item to a pending submission. Requires `itemType`, `itemId`; optional `itemSnapshot`, `itemNote`. |
| `GET` | `/items/:itemId` | Bearer (Reno or requester only) | Fetch a single submission item by ID. |
| `PATCH` | `/items/:itemId/status` | Reno | Review a single pending item. Body requires `status`: `APPROVED` or `REJECTED`. Parent submission must be `PENDING` or `PARTIALLY_APPROVED`. After each review: if every item is `APPROVED`, the submission becomes `APPROVED`; if at least one item is `APPROVED` but not all, it becomes `PARTIALLY_APPROVED` (sets `reviewedBy` / `reviewedAt` and fires the submission webhook when the status changes). |

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

### `POST /:submissionId/items`

```json
{
  "itemType": "string",
  "itemId": "abc-123",
  "itemSnapshot": {},
  "itemNote": "string"
}
```

`itemSnapshot` may be a JSON object/array or a JSON string.

### `PATCH /:id/status`

Requester cancelling:

```json
{ "status": "CANCELLED" }
```

Reno reviewing:

```json
{
  "status": "APPROVED",
  "reviewNote": "string"
}
```

Allowed Reno values: `APPROVED`, `PARTIALLY_APPROVED`, `REJECTED`.

### `POST /:id/approve-all` / `POST /:id/reject-all`

```json
{
  "reviewNote": "string"
}
```

### `PATCH /items/:itemId/status`

```json
{
  "status": "APPROVED"
}
```

---

## Response shapes

### `ApprovalSubmissionRequesterDTO`

Nested on `requestedBy` (joined from `users` via `requested_by`).

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
  "category": "string | null",
  "contextType": "string",
  "contextId": 1,
  "status": "PENDING | APPROVED | REJECTED | PARTIALLY_APPROVED | CANCELLED",
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
  "itemType": "string",
  "itemId": "abc-123",
  "itemSnapshot": "string | null",
  "status": "PENDING | APPROVED | REJECTED",
  "decidedAt": "ISO8601 | null",
  "itemNote": "string | null"
}
```

### `GET /`, `GET /user-submissions` — `ListApprovalSubmissionsDTO`

```json
{
  "error": null,
  "data": {
    "submissions": [
      {
        "...ApprovalSubmissionDTO fields",
        "items": ["...ApprovalSubmissionItemDTO"]
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 100,
      "total_pages": 5
    }
  }
}
```

### `GET /:id`, `POST /` — `ApprovalSubmissionWithItemsDTO`

Submission fields plus `items: ApprovalSubmissionItemDTO[]`.

### `GET /items/:itemId`, `POST /:submissionId/items`, `PATCH /items/:itemId/status` — `ApprovalSubmissionItemDTO`

### `POST /:id/approve-all`, `POST /:id/reject-all` — `ReviewAllApprovalSubmissionDTO`

```json
{
  "error": null,
  "data": {
    "submission": { "...ApprovalSubmissionDTO" },
    "items": ["...ApprovalSubmissionItemDTO"]
  }
}
```

### `PATCH /:id/status` — `ApprovalSubmissionDTO`

---

## Status codes

| Code | When |
|------|------|
| `200` | Success (GET, PATCH, approve-all, reject-all) |
| `201` | Created (POST `/`, POST `/:submissionId/items`) |
| `400` | Invalid params, body, or business rule (e.g. submission not `PENDING`) |
| `403` | Missing/invalid token, wrong role, or not the requester |
| `404` | Submission or item not found |
| `500` | Server error |
