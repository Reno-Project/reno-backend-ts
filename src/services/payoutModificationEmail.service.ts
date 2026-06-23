import { QueryTypes } from "sequelize";
import { buildContractorPaymentsUrl, db as dbConfig } from "../config";
import User from "../models/user";
import { getPayoutManagerEmail } from "./approvalReviewer.service";
import { getEmailTemplate, sendSmtpEmail } from "./mail.service";
import type { ApprovalSubmissionWithItemsDTO } from "../types/approvalSubmission/responses";
import Logger from "../utils/logger";
import db from "../utils/db";

const PAYOUT_MODIFICATION_TEMPLATE_SLUG = "payout-modification-request";

const PAYOUT_FIELDS = ["payoutName", "due_date", "amount", "status"] as const;

type PayoutField = (typeof PAYOUT_FIELDS)[number];

const FIELD_LABELS: Record<PayoutField, string> = {
  payoutName: "Payout name",
  due_date: "Due date",
  amount: "Amount",
  status: "Status",
};

type PayoutSnapshot = {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "number") {
    return String(value);
  }
  return String(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseItemSnapshot(snapshot: string | null): PayoutSnapshot | null {
  if (!snapshot) {
    return null;
  }

  try {
    return JSON.parse(snapshot) as PayoutSnapshot;
  } catch {
    return null;
  }
}

function buildChangesHtml(items: ApprovalSubmissionWithItemsDTO["items"]): string {
  const rows: string[] = [];

  for (const item of items) {
    const parsed = parseItemSnapshot(item.itemSnapshot);
    if (!parsed?.after) {
      continue;
    }

    const before = parsed.before ?? {};
    const after = parsed.after;

    for (const field of PAYOUT_FIELDS) {
      if (after[field] === undefined) {
        continue;
      }

      const beforeValue = formatFieldValue(before[field]);
      const afterValue = formatFieldValue(after[field]);

      rows.push(`
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #dde0e2; color: #484848;">${escapeHtml(item.itemId)}</td>
          <td style="padding: 8px 12px; border: 1px solid #dde0e2; color: #484848;">${escapeHtml(FIELD_LABELS[field])}</td>
          <td style="padding: 8px 12px; border: 1px solid #dde0e2; color: #484848;">${escapeHtml(beforeValue)}</td>
          <td style="padding: 8px 12px; border: 1px solid #dde0e2; color: #484848;">${escapeHtml(afterValue)}</td>
        </tr>
      `);
    }
  }

  if (rows.length === 0) {
    return "<p style=\"color: #484848;\">No payout field changes recorded.</p>";
  }

  return `
    <table style="width: 100%; max-width: 600px; border-collapse: collapse; margin: 16px auto; font-size: 14px;">
      <thead>
        <tr style="background-color: #274BF1; color: #fff;">
          <th style="padding: 10px 12px; border: 1px solid #dde0e2; text-align: left;">Payout ID</th>
          <th style="padding: 10px 12px; border: 1px solid #dde0e2; text-align: left;">Field</th>
          <th style="padding: 10px 12px; border: 1px solid #dde0e2; text-align: left;">Before</th>
          <th style="padding: 10px 12px; border: 1px solid #dde0e2; text-align: left;">After</th>
        </tr>
      </thead>
      <tbody>
        ${rows.join("")}
      </tbody>
    </table>
  `;
}

function formatRequestedAt(requestedAt: string): string {
  const date = new Date(requestedAt);
  if (Number.isNaN(date.getTime())) {
    return requestedAt;
  }
  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function resolveRequesterDisplayName(
  username: string | null | undefined,
  email: string | null | undefined
): string {
  if (username && username.trim().length > 0) {
    return username.trim();
  }
  if (email && email.includes("@")) {
    return email.split("@")[0] ?? "User";
  }
  return "User";
}

async function getProjectName(projectId: number): Promise<string> {
  const schema = dbConfig.schema || "dbo";
  const rows = (await db.query(
    `SELECT name FROM [${schema}].[project] WHERE id = :projectId`,
    { replacements: { projectId }, type: QueryTypes.SELECT }
  )) as Array<{ name: string | null }>;

  const name = rows[0]?.name;
  return typeof name === "string" && name.trim().length > 0 ? name.trim() : `Project #${projectId}`;
}

function resolvePayoutName(items: ApprovalSubmissionWithItemsDTO["items"]): string {
  const names: string[] = [];

  for (const item of items) {
    const parsed = parseItemSnapshot(item.itemSnapshot);
    const before = parsed?.before ?? {};
    const after = parsed?.after ?? {};

    const afterName = typeof after.payoutName === "string" ? after.payoutName.trim() : "";
    const beforeName = typeof before.payoutName === "string" ? before.payoutName.trim() : "";
    const name = afterName || beforeName || item.itemId;
    names.push(name);
  }

  if (names.length === 0) {
    return "—";
  }

  return [...new Set(names)].join(", ");
}

export async function notifyPayoutModificationRequest(
  submission: ApprovalSubmissionWithItemsDTO
): Promise<void> {
  if (submission.category !== "PAYOUT_EDIT") {
    return;
  }

  const recipientRaw = await getPayoutManagerEmail();
  if (!recipientRaw) {
    Logger.warn("PAYOUT_APPROVAL_MAIL not configured; skipping payout modification email");
    return;
  }

  const reviewLink = buildContractorPaymentsUrl(submission.contextId);
  if (!reviewLink) {
    Logger.warn("PORTAL_LINK not configured; skipping payout modification email");
    return;
  }

  const requester = await User.findByPk(submission.requestedBy.id);
  const requesterJson = requester?.toJSON() as { username?: string | null; email?: string | null } | undefined;
  const requesterEmail = requesterJson?.email?.trim() ?? "";
  const requesterName = resolveRequesterDisplayName(requesterJson?.username, requesterEmail);

  const projectName = await getProjectName(submission.contextId);
  const payoutName = resolvePayoutName(submission.items);

  const replacements: Record<string, string> = {
    RequesterName: requesterName,
    RequesterEmail: requesterEmail || "—",
    PayoutName: payoutName,
    ProjectName: projectName,
    RequestedAt: formatRequestedAt(submission.requestedAt),
    RequestNote: submission.requestNote?.trim() || "—",
    ReviewLink: reviewLink,
    Changes: buildChangesHtml(submission.items),
  };

  const template = await getEmailTemplate(PAYOUT_MODIFICATION_TEMPLATE_SLUG, replacements);
  if (!template) {
    Logger.warn(
      `Email template "${PAYOUT_MODIFICATION_TEMPLATE_SLUG}" not found; skipping payout modification email`
    );
    return;
  }

  const recipients = recipientRaw
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean)
    .join(", ");

  if (!recipients) {
    Logger.warn("No valid payout approval recipients; skipping payout modification email");
    return;
  }

  await sendSmtpEmail(recipients, template.subject, template.html);
}
