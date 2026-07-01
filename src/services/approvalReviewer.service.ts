import { QueryTypes } from "sequelize";
import { db as dbConfig } from "../config";
import {
  APPROVAL_REVIEWER_BY_CATEGORY,
  getReviewerConfig,
  isRegisteredApprovalCategory,
  REGISTERED_APPROVAL_CATEGORIES,
  type ApprovalVerifierType,
  type PermissionEntry,
} from "../config/approvalReviewers";
import type { JwtPayload } from "../types/auth";
import User from "../models/user";
import { verifyUser } from "./user.service";
import { isRenoAdminUser } from "./renoAdmin.service";
import db from "../utils/db";

let payoutManagerEmailCache: { value: string | null; expiresAt: number } | null = null;
let payoutApprovalMailCache: { value: string | null; expiresAt: number } | null = null;
const APP_CONFIG_EMAIL_CACHE_TTL_MS = 60_000;

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

async function getAppConfigEmail(configKey: string): Promise<string | null> {
  const schema = dbConfig.schema || "dbo";
  const rows = (await db.query(
    `SELECT config_value
     FROM [${schema}].[app_config]
     WHERE config_key = :config_key`,
    {
      replacements: { config_key: configKey },
      type: QueryTypes.SELECT,
    }
  )) as Array<{ config_value: string }>;

  const raw = rows[0]?.config_value;
  return raw !== undefined && String(raw).trim().length > 0 ? String(raw).trim() : null;
}

export async function getPayoutManagerEmail(): Promise<string | null> {
  const now = Date.now();
  if (payoutManagerEmailCache && payoutManagerEmailCache.expiresAt > now) {
    return payoutManagerEmailCache.value;
  }

  const payoutManager = await getAppConfigEmail("PAYOUT_MANAGER");
  const value =
    payoutManager ?? (await getAppConfigEmail("PAYOUT_APPROVAL_MAIL"));

  payoutManagerEmailCache = {
    value,
    expiresAt: now + APP_CONFIG_EMAIL_CACHE_TTL_MS,
  };

  return value;
}

export async function getPayoutApprovalMail(): Promise<string | null> {
  const now = Date.now();
  if (payoutApprovalMailCache && payoutApprovalMailCache.expiresAt > now) {
    return payoutApprovalMailCache.value;
  }

  const value = await getAppConfigEmail("PAYOUT_APPROVAL_MAIL");

  payoutApprovalMailCache = {
    value,
    expiresAt: now + APP_CONFIG_EMAIL_CACHE_TTL_MS,
  };

  return value;
}

async function userEmailMatchesConfigEmail(
  user: JwtPayload,
  configEmail: string | null
): Promise<boolean> {
  if (configEmail === null) {
    return false;
  }

  const userEmail = await getUserEmail(user);
  if (userEmail === null) {
    return false;
  }

  return normalizeEmail(userEmail) === normalizeEmail(configEmail);
}

export async function isPayoutManagerUser(user: JwtPayload): Promise<boolean> {
  return userEmailMatchesConfigEmail(user, await getPayoutManagerEmail());
}

export async function isPayoutApprovalMailUser(user: JwtPayload): Promise<boolean> {
  return userEmailMatchesConfigEmail(user, await getPayoutApprovalMail());
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
    case "payoutApprovalMail":
      return isPayoutApprovalMailUser(user);
    default:
      return false;
  }
}

export async function userMatchesPermissionEntry(
  user: JwtPayload,
  entry: PermissionEntry
): Promise<boolean> {
  if ("id" in entry) {
    return Number(user.id) === entry.id;
  }

  const userEmail = await getUserEmail(user);
  if (userEmail === null) {
    return false;
  }

  return normalizeEmail(userEmail) === normalizeEmail(entry.email);
}

export async function userMatchesAnyPermissionEntry(
  user: JwtPayload,
  entries: PermissionEntry[]
): Promise<boolean> {
  for (const entry of entries) {
    if (await userMatchesPermissionEntry(user, entry)) {
      return true;
    }
  }
  return false;
}

export async function canUserCreateCategory(
  user: JwtPayload,
  category: string | null | undefined
): Promise<boolean> {
  const config = getReviewerConfig(category);
  if (config?.creators !== undefined && config.creators.length > 0) {
    return userMatchesAnyPermissionEntry(user, config.creators);
  }
  return true;
}

export async function assertCanCreateSubmission(
  user: JwtPayload,
  category: string | null | undefined
): Promise<{ allowed: true } | { allowed: false; message: string }> {
  const allowed = await canUserCreateCategory(user, category);
  if (!allowed) {
    const label = isRegisteredApprovalCategory(category)
      ? `category "${category}"`
      : "this category";
    return {
      allowed: false,
      message: `You are not allowed to create submissions for ${label}`,
    };
  }

  return { allowed: true };
}

export async function canUserReviewCategory(
  user: JwtPayload,
  category: string | null | undefined
): Promise<boolean> {
  const config = getReviewerConfig(category);

  if (config === null) {
    return verifyUser(user, "reno");
  }

  if (config.reviewers !== undefined && config.reviewers.length > 0) {
    return userMatchesAnyPermissionEntry(user, config.reviewers);
  }

  if (config.verifier !== undefined) {
    return canReviewWithVerifier(user, config.verifier);
  }

  return verifyUser(user, "reno");
}

/**
 * Whether a user may see submissions for a category in list responses.
 * Centralized for config today; swap internals for DB joins later.
 */
export async function canUserAccessCategoryForList(
  user: JwtPayload,
  category: string | null | undefined
): Promise<boolean> {
  const [canCreate, canReview] = await Promise.all([
    canUserCreateCategory(user, category),
    canUserReviewCategory(user, category),
  ]);
  return canCreate || canReview;
}

export async function getAccessibleCategoriesForUser(user: JwtPayload): Promise<string[]> {
  const categories: string[] = [];

  for (const category of REGISTERED_APPROVAL_CATEGORIES) {
    if (await canUserAccessCategoryForList(user, category)) {
      categories.push(category);
    }
  }

  return categories;
}

export async function canUserAccessUnmappedCategoriesForList(
  user: JwtPayload
): Promise<boolean> {
  return canUserAccessCategoryForList(user, null);
}

export async function filterSubmissionsByListAccess<
  T extends { category: string | null },
>(user: JwtPayload, submissions: T[]): Promise<T[]> {
  const accessByCategory = new Map<string | null, boolean>();

  const filtered: T[] = [];
  for (const submission of submissions) {
    const category = submission.category;
    let canAccess = accessByCategory.get(category);
    if (canAccess === undefined) {
      canAccess = await canUserAccessCategoryForList(user, category);
      accessByCategory.set(category, canAccess);
    }
    if (canAccess) {
      filtered.push(submission);
    }
  }

  return filtered;
}

export async function getUserCategoryPermissionsForList(
  user: JwtPayload,
  category: string | null | undefined
): Promise<Array<"create" | "review">> {
  const [canCreate, canReview] = await Promise.all([
    canUserCreateCategory(user, category),
    canUserReviewCategory(user, category),
  ]);

  const perms: Array<"create" | "review"> = [];
  if (canCreate) {
    perms.push("create");
  }
  if (canReview) {
    perms.push("review");
  }
  return perms;
}

export async function getListPermsForUser(
  user: JwtPayload,
  submissions: Array<{ category: string | null; requestedBy: { id: number } }>,
  categoryFilter?: string
): Promise<Array<"create" | "review">> {
  let perms: Array<"create" | "review">;
  if (categoryFilter !== undefined) {
    perms = await getUserCategoryPermissionsForList(user, categoryFilter);
  } else {
    const permSet = new Set<"create" | "review">();
    const categories = new Set(submissions.map((submission) => submission.category));

    for (const category of categories) {
      const categoryPerms = await getUserCategoryPermissionsForList(user, category);
      for (const permission of categoryPerms) {
        permSet.add(permission);
      }
    }

    perms = Array.from(permSet);
  }

  const hasBoth = perms.includes("create") && perms.includes("review");
  if (!hasBoth || submissions.length === 0) {
    return perms;
  }

  const userId = Number(user.id);
  const allOwnSubmissions = submissions.every(
    (submission) => submission.requestedBy.id === userId
  );

  if (allOwnSubmissions) {
    return perms.filter((permission) => permission !== "review");
  }

  return perms;
}

export async function getReviewableCategoriesForUser(user: JwtPayload): Promise<string[]> {
  const categories: string[] = [];

  for (const [category, config] of Object.entries(APPROVAL_REVIEWER_BY_CATEGORY)) {
    if (config.reviewers !== undefined && config.reviewers.length > 0) {
      if (await userMatchesAnyPermissionEntry(user, config.reviewers)) {
        categories.push(category);
      }
    } else if (config.verifier !== undefined && (await canReviewWithVerifier(user, config.verifier))) {
      categories.push(category);
    }
  }

  return categories;
}

export async function canUserReviewUnmappedCategories(user: JwtPayload): Promise<boolean> {
  return verifyUser(user, "reno");
}

export async function canUserReviewSubmission(
  user: JwtPayload,
  category: string | null | undefined,
  requestedBy: number
): Promise<boolean> {
  const canReview = await canUserReviewCategory(user, category);
  if (!canReview) {
    return false;
  }

  if (requestedBy !== Number(user.id)) {
    return true;
  }

  const canCreate = await canUserCreateCategory(user, category);
  return !canCreate;
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
  category: string | null | undefined,
  requestedBy: number
): Promise<{ allowed: true } | { allowed: false; message: string }> {
  const allowed = await canUserReviewSubmission(user, category, requestedBy);
  if (!allowed) {
    if (requestedBy === Number(user.id)) {
      const [canCreate, canReview] = await Promise.all([
        canUserCreateCategory(user, category),
        canUserReviewCategory(user, category),
      ]);
      if (canCreate && canReview) {
        return {
          allowed: false,
          message: "You cannot review your own submission",
        };
      }
    }

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
