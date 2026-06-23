# API_V1 Approval Webhooks

reno-backend-ts calls API_V1 when approval submission items or submissions change status. **API_V1 must implement these handlers** to apply approved changes to business tables.

Configured via `API_V1` env var in reno-backend-ts.

---

## `POST /approval-submission/:approvalSubmissionItemId/webhook`

Called when a single item is reviewed (`PATCH /items/:itemId/status`).

### Request body

```json
{
  "approval_submission_item_id": 123,
  "status": "APPROVED"
}
```

`status` is `APPROVED` or `REJECTED`.

### Handler logic

1. Load `approval_submission_item` by `approval_submission_item_id` (from shared DB or internal API).
2. Load parent `approval_submission` for `category`, `contextType`, `contextId`.
3. If `status` is `REJECTED` — no mutation; return `200`.
4. If `status` is `APPROVED` — branch on parent `category`:

#### `category: "PAYOUT_EDIT"`

- Parse `item_snapshot` JSON; read `after` object.
- Allowed patch fields on `contractor_payout`: `payoutName`, `due_date`, `amount`, `status`.
- `UPDATE contractor_payout SET ... WHERE id = item.item_id` (only keys present in `after`).
- Idempotent: if item already applied, no-op and return `200`.

#### `category: "START_PROJECT_ADMIN"`

- Trigger project start for `context_id` / `context_type` per existing API_V1 project logic.
- Use `item_snapshot` payload if additional start parameters are stored there.

#### Unmapped category

- Fall back to existing Reno approval webhook behavior if any.

---

## `POST /approval-submission/webhook`

Called when submission-level status changes (approve-all, reject-all, submission status patch, auto-sync when all items approved).

### Request body

```json
{
  "approval_submission_id": 42,
  "status": "APPROVED"
}
```

Use when the whole submission is approved/rejected in one step. For item-level workflows (`PAYOUT_EDIT`), prefer the item webhook above.

---

## Error handling

- Return non-2xx only for retryable failures; reno-backend-ts logs the error.
- Validate item is `APPROVED` before mutating; ignore duplicate webhook deliveries.
