import { apiV1 } from "../config";
import type {
  ApprovalSubmissionItemStatus,
  ApprovalSubmissionStatus,
} from "../types/approvalSubmission/responses";
import Logger from "../utils/logger";

function apiV1Url(path: string): string {
  const base = apiV1.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

async function postWebhook(url: string, body: Record<string, unknown>, label: string): Promise<void> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      Logger.error(
        `${label} webhook failed (${response.status}): ${responseBody || response.statusText}`
      );
    }
  } catch (e) {
    Logger.error(e);
  }
}

export async function notifyApprovalSubmissionStatusChange(
  approvalSubmissionId: number,
  status: ApprovalSubmissionStatus
): Promise<void> {
  if (!apiV1) {
    Logger.warn("API_V1 not configured; skipping approval status webhook");
    return;
  }

  await postWebhook(
    apiV1Url("/approval-submission/webhook"),
    { approval_submission_id: approvalSubmissionId, status },
    "Approval submission status"
  );
}

export async function notifyApprovalSubmissionItemStatusChange(
  approvalSubmissionItemId: number,
  status: ApprovalSubmissionItemStatus
): Promise<void> {
  if (!apiV1) {
    Logger.warn("API_V1 not configured; skipping approval item status webhook");
    return;
  }

  await postWebhook(
    apiV1Url(`/approval-submission/${approvalSubmissionItemId}/webhook`),
    { approval_submission_item_id: approvalSubmissionItemId, status },
    "Approval submission item status"
  );
}
