import { QueryTypes } from "sequelize";
import { db as dbConfig } from "../config";
import {
  APPROVAL_REVIEWER_BY_CATEGORY,
  getReviewerConfig,
  isRegisteredApprovalCategory,
  type ApprovalVerifierType,
} from "../config/approvalReviewers";
import type { JwtPayload } from "../types/auth";
import User from "../models/user";
import { verifyUser } from "./user.service";
import { isRenoAdminUser } from "./renoAdmin.service";
import db from "../utils/db";

let payoutManagerEmailCache: { value: string | null; expiresAt: number } | null = null;
const PAYOUT_MANAGER_CACHE_TTL_MS = 60_000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function getUserEmail(user: JwtPayload): Promise<string | null> {
  const fromToken = user.email;
  if (typeof fromToken === "string" && fromToken.trim().length > 0) {
    return fromToken.trim();
  }

  const row = await User.findByPk(Number(user.id));
  if (!row) {
    return null;
  }

  const json = row.toJSON() as { email?: string | null };
  const email = json.email;
  return typeof email === "string" && email.trim().length > 0 ? email.trim() : null;
}

export async function getPayoutManagerEmail(): Promise<string | null> {
  const now = Date.now();
  if (payoutManagerEmailCache && payoutManagerEmailCache.expiresAt > now) {
    return payoutManagerEmailCache.value;
  }

  const schema = dbConfig.schema || "dbo";
  const rows = (await db.query(
    `SELECT config_key, config_value
     FROM [${schema}].[app_config]
     WHERE config_key IN ('PAYOUT_MANAGER', 'PAYOUT_APPROVAL_MAIL')`,
    { type: QueryTypes.SELECT }
  )) as Array<{ config_key: string; config_value: string }>;

  const byKey = new Map(rows.map((row) => [row.config_key, row.config_value]));
  const raw =
    byKey.get("PAYOUT_MANAGER") ??
    byKey.get("PAYOUT_APPROVAL_MAIL");

  const value =
    raw !== undefined && String(raw).trim().length > 0 ? String(raw).trim() : null;

  payoutManagerEmailCache = {
    value,
    expiresAt: now + PAYOUT_MANAGER_CACHE_TTL_MS,
  };

  return value;
}

export async function isPayoutManagerUser(user: JwtPayload): Promise<boolean> {
  const [payoutManagerEmail, userEmail] = await Promise.all([
    getPayoutManagerEmail(),
    getUserEmail(user),
  ]);

  if (payoutManagerEmail === null || userEmail === null) {
    return false;
  }

  return normalizeEmail(payoutManagerEmail) === normalizeEmail(userEmail);
}

async function canReviewWithVerifier(
  user: JwtPayload,
  verifier: ApprovalVerifierType
): Promise<boolean> {
  switch (verifier) {
    case "renoAdmin":
      return isRenoAdminUser(Number(user.id));
    case "payoutManager":
      return isPayoutManagerUser(user);
    default:
      return false;
  }
}

export async function canUserReviewCategory(
  user: JwtPayload,
  category: string | null | undefined
): Promise<boolean> {
  const config = getReviewerConfig(category);

  if (config === null) {
    return verifyUser(user, "reno");
  }

  return canReviewWithVerifier(user, config.verifier);
}

export async function getReviewableCategoriesForUser(user: JwtPayload): Promise<string[]> {
  const categories: string[] = [];

  for (const [category, config] of Object.entries(APPROVAL_REVIEWER_BY_CATEGORY)) {
    if (await canReviewWithVerifier(user, config.verifier)) {
      categories.push(category);
    }
  }

  return categories;
}

export async function canUserReviewUnmappedCategories(user: JwtPayload): Promise<boolean> {
  return verifyUser(user, "reno");
}

export async function canUserReadSubmission(
  user: JwtPayload,
  requestedBy: number,
  category: string | null | undefined
): Promise<boolean> {
  if (requestedBy === Number(user.id)) {
    return true;
  }

  return canUserReviewCategory(user, category);
}

export async function assertCanReviewSubmission(
  user: JwtPayload,
  category: string | null | undefined
): Promise<{ allowed: true } | { allowed: false; message: string }> {
  const allowed = await canUserReviewCategory(user, category);
  if (!allowed) {
    const label = isRegisteredApprovalCategory(category)
      ? `category "${category}"`
      : "this submission";
    return {
      allowed: false,
      message: `You are not allowed to review submissions for ${label}`,
    };
  }

  return { allowed: true };
}
