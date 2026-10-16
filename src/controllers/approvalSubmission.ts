import { type Request, type Response } from "express";
import { Op, type Transaction, type WhereOptions } from "sequelize";
import ApprovalSubmission from "../models/approvalSubmission";
import ApprovalSubmissionItem from "../models/approvalSubmissionItem";
import Project from "../models/project";
import User from "../models/user";
import { REGISTERED_APPROVAL_CATEGORIES } from "../config/approvalReviewers";
import {
  type ApprovalSubmissionDTO,
  type ApprovalSubmissionItemDTO,
  type ApprovalSubmissionItemStatus,
  type ApprovalSubmissionRequesterDTO,
  type ApprovalSubmissionReviewerDTO,
  type ApprovalSubmissionStatus,
  type ApprovalSubmissionWithItemsDTO,
  type ListApprovalSubmissionsDTO,
  type ReviewAllApprovalSubmissionDTO,
} from "../types/approvalSubmission/responses";
import { type APIResponse } from "../types/utils/api";
import type { JwtPayload } from "../types/auth";
import {
  assertCanCreateSubmission,
  assertCanReviewSubmission,
  canUserAccessCategoryForList,
  canUserAccessUnmappedCategoriesForList,
  canUserReadSubmission,
  filterSubmissionsByListAccess,
  getAccessibleCategoriesForUser,
  getListPermsForUser,
} from "../services/approvalReviewer.service";
import {
  notifyApprovalSubmissionItemStatusChange,
  notifyApprovalSubmissionStatusChange,
} from "../services/approvalSubmissionWebhook.service";
import { notifyPayoutModificationRequest } from "../services/payoutModificationEmail.service";
import Logger from "../utils/logger";
import db from "../utils/db";
import { z } from "zod";
import {
  approvalSubmissionIdParamSchema,
  approvalSubmissionItemIdParamSchema,
  createApprovalSubmissionItemSchema,
  createApprovalSubmissionSchema,
  listApprovalSubmissionsQuerySchema,
  type ListApprovalSubmissionsQuery,
  reviewAllApprovalSubmissionSchema,
  submissionIdParamSchema,
  updateApprovalSubmissionItemStatusSchema,
  updateApprovalSubmissionStatusSchema,
  validateItemsForCategory,
} from "../validation/approvalSubmission";

const RENO_REVIEW_STATUSES = new Set(["APPROVED", "PARTIALLY_APPROVED", "REJECTED"]);

const approvalSubmissionItemsInclude = {
  model: ApprovalSubmissionItem,
  as: "items",
  required: false,
};

const approvalSubmissionRequesterInclude = {
  model: User,
  as: "requester",
  required: false,
};

const approvalSubmissionReviewerInclude = {
  model: User,
  as: "reviewer",
  required: false,
  attributes: ["id", "username", "email"],
};

const approvalSubmissionProjectInclude = {
  model: Project,
  as: "project",
  required: false,
  attributes: ["id", "name"],
};

const approvalSubmissionWithItemsAndRequesterInclude = [
  approvalSubmissionItemsInclude,
  approvalSubmissionRequesterInclude,
  approvalSubmissionReviewerInclude,
  approvalSubmissionProjectInclude,
];

type ApprovalSubmissionReviewerRow = {
  id: number;
  username?: string | null;
  email?: string | null;
};

type ApprovalSubmissionRow = {
  requestedBy: number;
  reviewedBy: number | null;
  requester?: ApprovalSubmissionRequesterDTO;
  reviewer?: ApprovalSubmissionReviewerRow | null;
  items?: ApprovalSubmissionItemDTO[];
  project?: { id: number; name: string | null } | null;
} & Omit<ApprovalSubmissionDTO, "requestedBy" | "reviewedBy">;

function serializeRequester(
  requester: ApprovalSubmissionRequesterDTO | undefined,
  requestedById: number
): ApprovalSubmissionRequesterDTO {
  if (requester) {
    return {
      id: requester.id,
      role: requester.role,
      is_deleted: requester.is_deleted,
      is_block: requester.is_block,
    };
  }

  return { id: requestedById, role: null, is_deleted: 0, is_block: 0 };
}

function serializeReviewer(
  reviewer: ApprovalSubmissionReviewerRow | null | undefined,
  reviewedById: number | null
): ApprovalSubmissionReviewerDTO | null {
  if (reviewedById == null) {
    return null;
  }

  if (reviewer) {
    return {
      user_id: reviewer.id,
      username: reviewer.username ?? null,
      email: reviewer.email ?? null,
    };
  }

  return { user_id: reviewedById, username: null, email: null };
}

function serializeSubmission(row: { toJSON: () => unknown }): ApprovalSubmissionDTO {
  const json = row.toJSON() as ApprovalSubmissionRow;
  const {
    requester,
    requestedBy: requestedById,
    reviewer,
    reviewedBy: reviewedById,
    items: _items,
    project: _project,
    ...submission
  } = json;
  return {
    ...submission,
    requestedBy: serializeRequester(requester, requestedById),
    reviewedBy: serializeReviewer(reviewer, reviewedById),
  };
}

function serializeSnapshot(snapshot: unknown): string | null {
  if (snapshot === undefined) {
    return null;
  }
  if (typeof snapshot === "string") {
    JSON.parse(snapshot);
    return snapshot;
  }
  return JSON.stringify(snapshot);
}

type CreateApprovalSubmissionItemInput = z.infer<typeof createApprovalSubmissionItemSchema>;

function buildItemCreateAttributes(item: CreateApprovalSubmissionItemInput): {
  itemType: string;
  itemId: string;
  itemSnapshot: string | null;
  itemNote: string | null;
} | null {
  if (item.itemSnapshot !== undefined) {
    try {
      return {
        itemType: item.itemType,
        itemId: item.itemId,
        itemSnapshot: serializeSnapshot(item.itemSnapshot),
        itemNote: item.itemNote ?? null,
      };
    } catch {
      return null;
    }
  }
  return {
    itemType: item.itemType,
    itemId: item.itemId,
    itemSnapshot: null,
    itemNote: item.itemNote ?? null,
  };
}

async function findSubmissionById(id: number) {
  return ApprovalSubmission.findByPk(id);
}

async function findSubmissionWithItemsById(id: number) {
  return ApprovalSubmission.findByPk(id, {
    include: approvalSubmissionWithItemsAndRequesterInclude,
  });
}

function serializeSubmissionWithItems(
  row: Awaited<ReturnType<typeof findSubmissionWithItemsById>>
): ApprovalSubmissionWithItemsDTO | null {
  if (!row) {
    return null;
  }

  const json = row.toJSON() as ApprovalSubmissionRow;
  const {
    requester,
    requestedBy: requestedById,
    reviewer,
    reviewedBy: reviewedById,
    items = [],
    project,
    ...submission
  } = json;
  const projectName =
    typeof project?.name === "string" && project.name.trim().length > 0
      ? project.name.trim()
      : null;

  return {
    ...submission,
    requestedBy: serializeRequester(requester, requestedById),
    reviewedBy: serializeReviewer(reviewer, reviewedById),
    items: items.map((item) => {
      const dto = item as ApprovalSubmissionItemDTO;
      if (!projectName) {
        return dto;
      }

      let snapshot: Record<string, unknown>;
      if (dto.itemSnapshot == null || dto.itemSnapshot === "") {
        snapshot = {};
      } else {
        try {
          const parsed = JSON.parse(dto.itemSnapshot) as unknown;
          if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            return dto;
          }
          snapshot = parsed as Record<string, unknown>;
        } catch {
          return dto;
        }
      }

      return {
        ...dto,
        itemSnapshot: JSON.stringify({ ...snapshot, project_name: projectName }),
      };
    }),
  };
}

async function syncSubmissionStatusFromItems(
  submission: NonNullable<Awaited<ReturnType<typeof findSubmissionById>>>,
  submissionId: number,
  reviewedBy: number,
  transaction: Transaction
): Promise<ApprovalSubmissionStatus | null> {
  const items = await ApprovalSubmissionItem.findAll({
    where: { submissionId },
    transaction,
  });

  if (items.length === 0) {
    return null;
  }

  const itemStatuses = items.map(
    (row) => (row.toJSON() as ApprovalSubmissionItemDTO).status
  );
  const approvedCount = itemStatuses.filter((s) => s === "APPROVED").length;
  const allApproved = approvedCount === items.length;
  const someApproved = approvedCount > 0 && !allApproved;

  let nextStatus: ApprovalSubmissionStatus | null = null;
  if (allApproved) {
    nextStatus = "APPROVED";
  } else if (someApproved) {
    nextStatus = "PARTIALLY_APPROVED";
  }

  if (nextStatus === null) {
    return null;
  }

  const submissionData = submission.toJSON() as { status: ApprovalSubmissionStatus };
  if (submissionData.status === nextStatus) {
    return null;
  }

  const now = new Date();
  await submission.update(
    {
      status: nextStatus,
      reviewedBy,
      reviewedAt: now,
    },
    { transaction }
  );

  if (allApproved) {
    void notifyApprovalSubmissionStatusChange(submissionId, "APPROVED");
  }

  return nextStatus;
}

async function reviewAllItems(
  req: Request,
  res: Response<APIResponse<ReviewAllApprovalSubmissionDTO>>,
  itemStatus: ApprovalSubmissionItemStatus,
  submissionStatus: ApprovalSubmissionStatus
) {
  const paramsParsed = approvalSubmissionIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res
      .status(400)
      .json({ error: { message: "Invalid submission id", details: paramsParsed.error.flatten() }, data: null });
  }

  const bodyParsed = reviewAllApprovalSubmissionSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res
      .status(400)
      .json({ error: { message: "Invalid request body", details: bodyParsed.error.flatten() }, data: null });
  }

  if (!req.user?.id) {
    return res.status(403).json({ error: { message: "Unauthorized" }, data: null });
  }

  const { id } = paramsParsed.data;
  const { reviewNote } = bodyParsed.data;
  const now = new Date();

  try {
    const submission = await findSubmissionById(id);
    if (!submission) {
      return res.status(404).json({ error: { message: "Approval submission not found" }, data: null });
    }

    const submissionData = submission.toJSON() as {
      status: ApprovalSubmissionStatus;
      category: string | null;
      requestedBy: number;
    };
    if (submissionData.status !== "PENDING") {
      return res
        .status(400)
        .json({ error: { message: "Only pending submissions can be reviewed" }, data: null });
    }

    const reviewAuth = await assertCanReviewSubmission(
      req.user,
      submissionData.category,
      submissionData.requestedBy
    );
    if (!reviewAuth.allowed) {
      return res.status(403).json({ error: { message: reviewAuth.message }, data: null });
    }

    const items = await db.transaction(async (transaction) => {
      await ApprovalSubmissionItem.update(
        { status: itemStatus, decidedAt: now },
        { where: { submissionId: id }, transaction }
      );

      await submission.update(
        {
          status: submissionStatus,
          reviewedBy: Number(req.user!.id),
          reviewedAt: now,
          reviewNote: reviewNote ?? null,
        },
        { transaction }
      );

      return ApprovalSubmissionItem.findAll({
        where: { submissionId: id },
        transaction,
      });
    });

    await submission.reload();

    void notifyApprovalSubmissionStatusChange(id, submissionStatus);
    for (const item of items) {
      const itemData = item.toJSON() as ApprovalSubmissionItemDTO;
      // void notifyApprovalSubmissionItemStatusChange(itemData.id, itemStatus);
    }

    const submissionWithDetails = await findSubmissionWithItemsById(id);

    return res.status(200).json({
      error: null,
      data: {
        submission: submissionWithDetails
          ? serializeSubmission(submissionWithDetails)
          : serializeSubmission(submission),
        items: items.map((item) => item.toJSON() as ApprovalSubmissionItemDTO),
      },
    });
  } catch (e) {
    Logger.error(e);
    return res
      .status(500)
      .json({ error: { message: "Something went wrong", details: e }, data: null });
  }
}

type ListApprovalSubmissionsFilters = {
  status?: ApprovalSubmissionStatus;
  category?: string;
  contextType?: string;
  contextId?: number;
  page?: number;
  per_page?: number;
  requestedBy?: number;
  accessScope?: {
    accessibleCategories: string[];
    includeUnmapped: boolean;
  };
  listAccessUser?: JwtPayload;
  categoryFilter?: string;
};

function buildListWhere(filters: ListApprovalSubmissionsFilters): WhereOptions {
  const { status, category, contextType, contextId, requestedBy, accessScope } = filters;

  const where: Record<string, unknown> = {};

  if (status !== undefined) {
    where.status = status;
  }
  if (contextType !== undefined) {
    where.contextType = contextType;
  }
  if (contextId !== undefined) {
    where.contextId = contextId;
  }
  if (requestedBy !== undefined) {
    where.requestedBy = requestedBy;
  }

  if (category !== undefined) {
    where.category = category;
    return where;
  }

  if (accessScope === undefined) {
    return where;
  }

  const { accessibleCategories, includeUnmapped } = accessScope;

  if (accessibleCategories.length === 0 && !includeUnmapped) {
    return { ...where, id: -1 };
  }

  if (accessibleCategories.length === 1 && !includeUnmapped) {
    where.category = accessibleCategories[0];
    return where;
  }

  const categoryConditions: WhereOptions[] = [];
  if (accessibleCategories.length > 0) {
    categoryConditions.push({ category: { [Op.in]: accessibleCategories } });
  }
  if (includeUnmapped) {
    categoryConditions.push({ category: null });
    categoryConditions.push({ category: { [Op.notIn]: REGISTERED_APPROVAL_CATEGORIES } });
  }

  if (categoryConditions.length === 1) {
    return { ...where, ...categoryConditions[0] };
  }

  return { ...where, [Op.or]: categoryConditions };
}

function buildListFilters(
  query: ListApprovalSubmissionsQuery,
  options?: { forceRequestedBy?: number }
): ListApprovalSubmissionsFilters {
  const filters: ListApprovalSubmissionsFilters = {};
  if (query.status !== undefined) {
    filters.status = query.status;
  }
  if (query.contextType !== undefined) {
    filters.contextType = query.contextType;
  }
  if (query.contextId !== undefined) {
    filters.contextId = query.contextId;
  }
  if (query.category !== undefined) {
    filters.category = query.category;
  }
  if (query.page !== undefined) {
    filters.page = query.page;
  }
  if (query.per_page !== undefined) {
    filters.per_page = query.per_page;
  }
  if (options?.forceRequestedBy !== undefined) {
    filters.requestedBy = options.forceRequestedBy;
  } else if (query.requested_by !== undefined) {
    filters.requestedBy = query.requested_by;
  }
  return filters;
}

function buildEmptyListResult(
  page?: number,
  per_page?: number
): ListApprovalSubmissionsDTO {
  const isPaginated = page !== undefined && per_page !== undefined;
  return {
    submissions: [],
    perms: [],
    pagination: isPaginated
      ? { page, per_page, total: 0, total_pages: 0 }
      : { page: 1, per_page: 0, total: 0, total_pages: 0 },
  };
}

async function queryApprovalSubmissionsList(
  filters: ListApprovalSubmissionsFilters
): Promise<ListApprovalSubmissionsDTO> {
  const { page, per_page, listAccessUser, categoryFilter } = filters;
  const isPaginated = page !== undefined && per_page !== undefined;
  const where = buildListWhere(filters);

  const { count, rows } = await ApprovalSubmission.findAndCountAll({
    where,
    ...(isPaginated ? { limit: per_page, offset: (page - 1) * per_page } : {}),
    order: [["id", "DESC"]],
    include: approvalSubmissionWithItemsAndRequesterInclude,
    distinct: true,
  });

  const serialized = rows.map((row) => serializeSubmissionWithItems(row)!);

  let submissions = serialized;
  let perms: ListApprovalSubmissionsDTO["perms"] = [];

  if (listAccessUser !== undefined) {
    submissions = await filterSubmissionsByListAccess(listAccessUser, serialized);
    perms = await getListPermsForUser(listAccessUser, submissions, categoryFilter);
  }

  const total = count;
  const pagination = isPaginated
    ? {
        page,
        per_page,
        total,
        total_pages: total === 0 ? 0 : Math.ceil(total / per_page),
      }
    : {
        page: 1,
        per_page: total,
        total,
        total_pages: total === 0 ? 0 : 1,
      };

  return { submissions, perms, pagination };
}

async function handleListApprovalSubmissions(
  res: Response<APIResponse<ListApprovalSubmissionsDTO>>,
  filters: ListApprovalSubmissionsFilters
) {
  try {
    const data = await queryApprovalSubmissionsList(filters);
    return res.status(200).json({ error: null, data });
  } catch (e) {
    Logger.error(e);
    return res
      .status(500)
      .json({ error: { message: "Something went wrong", details: e }, data: null });
  }
}

export const listApprovalSubmissions = async (
  req: Request,
  res: Response<APIResponse<ListApprovalSubmissionsDTO>>
) => {
  if (!req.user?.id) {
    return res.status(403).json({ error: { message: "Unauthorized" }, data: null });
  }

  const parsed = listApprovalSubmissionsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: { message: "Invalid query params", details: parsed.error.flatten() }, data: null });
  }

  const accessibleCategories = await getAccessibleCategoriesForUser(req.user);
  const includeUnmapped = await canUserAccessUnmappedCategoriesForList(req.user);

  if (parsed.data.category !== undefined) {
    const canAccess = await canUserAccessCategoryForList(req.user, parsed.data.category);
    if (!canAccess) {
      return res.status(200).json({
        error: null,
        data: buildEmptyListResult(parsed.data.page, parsed.data.per_page),
      });
    }

    return handleListApprovalSubmissions(res, {
      ...buildListFilters(parsed.data),
      ...(parsed.data.category !== undefined ? { categoryFilter: parsed.data.category } : {}),
      listAccessUser: req.user,
    });
  }

  if (accessibleCategories.length === 0 && !includeUnmapped) {
    return res.status(200).json({
      error: null,
      data: buildEmptyListResult(parsed.data.page, parsed.data.per_page),
    });
  }

  return handleListApprovalSubmissions(res, {
    ...buildListFilters(parsed.data),
    accessScope: { accessibleCategories, includeUnmapped },
    listAccessUser: req.user,
  });
};

export const listMyApprovalSubmissions = async (
  req: Request,
  res: Response<APIResponse<ListApprovalSubmissionsDTO>>
) => {
  if (!req.user?.id) {
    return res.status(403).json({ error: { message: "Unauthorized" }, data: null });
  }

  const parsed = listApprovalSubmissionsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: { message: "Invalid query params", details: parsed.error.flatten() }, data: null });
  }

  if (parsed.data.category !== undefined) {
    const canAccess = await canUserAccessCategoryForList(req.user, parsed.data.category);
    if (!canAccess) {
      return res.status(200).json({
        error: null,
        data: buildEmptyListResult(parsed.data.page, parsed.data.per_page),
      });
    }
  }

  return handleListApprovalSubmissions(res, {
    ...buildListFilters(parsed.data, {
      forceRequestedBy: Number(req.user.id),
    }),
    ...(parsed.data.category !== undefined ? { categoryFilter: parsed.data.category } : {}),
    listAccessUser: req.user,
  });
};

export const getApprovalSubmission = async (
  req: Request,
  res: Response<APIResponse<ApprovalSubmissionWithItemsDTO>>
) => {
  const paramsParsed = approvalSubmissionIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res
      .status(400)
      .json({ error: { message: "Invalid submission id", details: paramsParsed.error.flatten() }, data: null });
  }

  if (!req.user?.id) {
    return res.status(403).json({ error: { message: "Unauthorized" }, data: null });
  }

  const { id } = paramsParsed.data;

  try {
    const submission = await findSubmissionWithItemsById(id);
    if (!submission) {
      return res.status(404).json({ error: { message: "Approval submission not found" }, data: null });
    }

    const submissionData = submission.toJSON() as {
      requestedBy: number;
      category: string | null;
    };
    const canRead = await canUserReadSubmission(
      req.user,
      submissionData.requestedBy,
      submissionData.category
    );
    if (!canRead) {
      return res
        .status(403)
        .json({ error: { message: "You are not allowed to access this submission" }, data: null });
    }

    return res.status(200).json({ error: null, data: serializeSubmissionWithItems(submission)! });
  } catch (e) {
    Logger.error(e);
    return res
      .status(500)
      .json({ error: { message: "Something went wrong", details: e }, data: null });
  }
};

export const approveAllApprovalSubmission = (req: Request, res: Response<APIResponse<ReviewAllApprovalSubmissionDTO>>) =>
  reviewAllItems(req, res, "APPROVED", "APPROVED");

export const rejectAllApprovalSubmission = (req: Request, res: Response<APIResponse<ReviewAllApprovalSubmissionDTO>>) =>
  reviewAllItems(req, res, "REJECTED", "REJECTED");

export const createApprovalSubmission = async (
  req: Request,
  res: Response<APIResponse<ApprovalSubmissionWithItemsDTO>>
) => {
  const parsed = createApprovalSubmissionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: { message: "Invalid request body", details: parsed.error.flatten() }, data: null });
  }

  const { contextType, contextId, category, requestNote, items } = parsed.data;

  const categoryValidation = validateItemsForCategory(category, items);
  if (!categoryValidation.ok) {
    return res.status(400).json({ error: { message: categoryValidation.message }, data: null });
  }

  if (!req.user?.id) {
    return res
      .status(403)
      .json({ error: { message: "Unauthorized" }, data: null });
  }

  const createAuth = await assertCanCreateSubmission(req.user, category);
  if (!createAuth.allowed) {
    return res.status(403).json({ error: { message: createAuth.message }, data: null });
  }

  const itemAttributes: {
    itemType: string;
    itemId: string;
    itemSnapshot: string | null;
    itemNote: string | null;
  }[] = [];

  if (items !== undefined) {
    for (const item of items) {
      const attributes = buildItemCreateAttributes(item);
      if (attributes === null) {
        return res
          .status(400)
          .json({ error: { message: "itemSnapshot must be valid JSON" }, data: null });
      }
      itemAttributes.push(attributes);
    }
  }

  try {
    const { submissionId } = await db.transaction(async (transaction) => {
      const createdSubmission = await ApprovalSubmission.create(
        {
          contextType,
          contextId,
          category: category ?? null,
          status: "PENDING",
          requestedBy: Number(req.user!.id),
          requestedAt: new Date(),
          reviewedBy: null,
          reviewedAt: null,
          reviewNote: null,
          requestNote: requestNote ?? null,
          requestPayload: null,
        },
        { transaction }
      );

      const submissionId = (createdSubmission.toJSON() as { id: number }).id;

      for (const attributes of itemAttributes) {
        await ApprovalSubmissionItem.create(
          {
            submissionId,
            ...attributes,
            status: "PENDING",
            decidedAt: null,
          },
          { transaction }
        );
      }

      return { submissionId };
    });

    const submissionWithDetails = await findSubmissionWithItemsById(submissionId);

    if (category === "PAYOUT_EDIT" && submissionWithDetails) {
      const data = serializeSubmissionWithItems(submissionWithDetails)!;
      void notifyPayoutModificationRequest(data).catch(Logger.error);
    }

    return res.status(201).json({
      error: null,
      data: serializeSubmissionWithItems(submissionWithDetails)!,
    });
  } catch (e) {
    Logger.error(e);
    return res
      .status(500)
      .json({ error: { message: "Something went wrong", details: e }, data: null });
  }
};

export const createApprovalSubmissionItem = async (
  req: Request,
  res: Response<APIResponse<ApprovalSubmissionItemDTO>>
) => {
  const paramsParsed = submissionIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res
      .status(400)
      .json({ error: { message: "Invalid submission id", details: paramsParsed.error.flatten() }, data: null });
  }

  const bodyParsed = createApprovalSubmissionItemSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res
      .status(400)
      .json({ error: { message: "Invalid request body", details: bodyParsed.error.flatten() }, data: null });
  }

  if (!req.user?.id) {
    return res.status(403).json({ error: { message: "Unauthorized" }, data: null });
  }

  const { submissionId } = paramsParsed.data;
  const { itemType, itemId, itemSnapshot, itemNote } = bodyParsed.data;

  try {
    const submission = await findSubmissionById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: { message: "Approval submission not found" }, data: null });
    }

    const submissionData = submission.toJSON() as {
      status: ApprovalSubmissionStatus;
      requestedBy: number;
      category: string | null;
    };
    if (submissionData.status !== "PENDING") {
      return res
        .status(400)
        .json({ error: { message: "Items can only be added to pending submissions" }, data: null });
    }

    if (submissionData.requestedBy !== Number(req.user.id)) {
      return res
        .status(403)
        .json({ error: { message: "Only the submission requester can add items" }, data: null });
    }

    const createAuth = await assertCanCreateSubmission(req.user, submissionData.category);
    if (!createAuth.allowed) {
      return res.status(403).json({ error: { message: createAuth.message }, data: null });
    }

    const categoryValidation = validateItemsForCategory(
      submissionData.category ?? undefined,
      [{ itemType, itemId, itemSnapshot, itemNote }]
    );
    if (!categoryValidation.ok) {
      return res.status(400).json({ error: { message: categoryValidation.message }, data: null });
    }

    const attributes = buildItemCreateAttributes({ itemType, itemId, itemSnapshot, itemNote });
    if (attributes === null) {
      return res
        .status(400)
        .json({ error: { message: "itemSnapshot must be valid JSON" }, data: null });
    }

    const item = await ApprovalSubmissionItem.create({
      submissionId,
      ...attributes,
      status: "PENDING",
      decidedAt: null,
    });

    return res
      .status(201)
      .json({ error: null, data: item.toJSON() as ApprovalSubmissionItemDTO });
  } catch (e) {
    Logger.error(e);
    return res
      .status(500)
      .json({ error: { message: "Something went wrong", details: e }, data: null });
  }
};

export const getApprovalSubmissionItem = async (
  req: Request,
  res: Response<APIResponse<ApprovalSubmissionItemDTO>>
) => {
  const paramsParsed = approvalSubmissionItemIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res
      .status(400)
      .json({ error: { message: "Invalid item id", details: paramsParsed.error.flatten() }, data: null });
  }

  if (!req.user?.id) {
    return res.status(403).json({ error: { message: "Unauthorized" }, data: null });
  }

  const { itemId } = paramsParsed.data;

  try {
    const item = await ApprovalSubmissionItem.findByPk(itemId);
    if (!item) {
      return res.status(404).json({ error: { message: "Approval submission item not found" }, data: null });
    }

    const itemData = item.toJSON() as ApprovalSubmissionItemDTO;
    const submission = await findSubmissionById(itemData.submissionId);
    if (!submission) {
      return res.status(404).json({ error: { message: "Approval submission not found" }, data: null });
    }

    const submissionData = submission.toJSON() as {
      requestedBy: number;
      category: string | null;
    };
    const canRead = await canUserReadSubmission(
      req.user,
      submissionData.requestedBy,
      submissionData.category
    );
    if (!canRead) {
      return res
        .status(403)
        .json({ error: { message: "You are not allowed to access this item" }, data: null });
    }

    return res
      .status(200)
      .json({ error: null, data: itemData });
  } catch (e) {
    Logger.error(e);
    return res
      .status(500)
      .json({ error: { message: "Something went wrong", details: e }, data: null });
  }
};

export const updateApprovalSubmissionItemStatus = async (
  req: Request,
  res: Response<APIResponse<ApprovalSubmissionItemDTO>>
) => {
  const paramsParsed = approvalSubmissionItemIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res
      .status(400)
      .json({ error: { message: "Invalid item id", details: paramsParsed.error.flatten() }, data: null });
  }

  const bodyParsed = updateApprovalSubmissionItemStatusSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res
      .status(400)
      .json({ error: { message: "Invalid request body", details: bodyParsed.error.flatten() }, data: null });
  }

  if (!req.user?.id) {
    return res.status(403).json({ error: { message: "Unauthorized" }, data: null });
  }

  const { itemId } = paramsParsed.data;
  const { status } = bodyParsed.data;

  try {
    const item = await ApprovalSubmissionItem.findByPk(itemId);
    if (!item) {
      return res.status(404).json({ error: { message: "Approval submission item not found" }, data: null });
    }

    const itemData = item.toJSON() as ApprovalSubmissionItemDTO;
    if (itemData.status !== "PENDING") {
      return res
        .status(400)
        .json({ error: { message: "Only pending items can be reviewed" }, data: null });
    }

    const submission = await findSubmissionById(itemData.submissionId);
    if (!submission) {
      return res.status(404).json({ error: { message: "Approval submission not found" }, data: null });
    }

    const submissionData = submission.toJSON() as {
      status: ApprovalSubmissionStatus;
      category: string | null;
      requestedBy: number;
    };
    if (submissionData.status !== "PENDING" && submissionData.status !== "PARTIALLY_APPROVED") {
      return res
        .status(400)
        .json({ error: { message: "Only items on pending or partially approved submissions can be reviewed" }, data: null });
    }

    const reviewAuth = await assertCanReviewSubmission(
      req.user,
      submissionData.category,
      submissionData.requestedBy
    );
    if (!reviewAuth.allowed) {
      return res.status(403).json({ error: { message: reviewAuth.message }, data: null });
    }

    const now = new Date();
    let submissionStatusChange: ApprovalSubmissionStatus | null = null;

    await db.transaction(async (transaction) => {
      await item.update({ status, decidedAt: now }, { transaction });
      submissionStatusChange = await syncSubmissionStatusFromItems(
        submission,
        itemData.submissionId,
        Number(req.user!.id),
        transaction
      );
    });

    await item.reload();
    if (submissionStatusChange !== null) {
      await submission.reload();
    }

    // void notifyApprovalSubmissionItemStatusChange(itemId, status);
    if (submissionStatusChange !== null) {
      void notifyApprovalSubmissionStatusChange(itemData.submissionId, submissionStatusChange);
    }

    return res
      .status(200)
      .json({ error: null, data: item.toJSON() as ApprovalSubmissionItemDTO });
  } catch (e) {
    Logger.error(e);
    return res
      .status(500)
      .json({ error: { message: "Something went wrong", details: e }, data: null });
  }
};

export const updateApprovalSubmissionStatus = async (
  req: Request,
  res: Response<APIResponse<ApprovalSubmissionDTO>>
) => {
  const paramsParsed = approvalSubmissionIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res
      .status(400)
      .json({ error: { message: "Invalid submission id", details: paramsParsed.error.flatten() }, data: null });
  }

  const bodyParsed = updateApprovalSubmissionStatusSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res
      .status(400)
      .json({ error: { message: "Invalid request body", details: bodyParsed.error.flatten() }, data: null });
  }

  if (!req.user?.id) {
    return res.status(403).json({ error: { message: "Unauthorized" }, data: null });
  }

  const { id } = paramsParsed.data;
  const { status } = bodyParsed.data;

  try {
    const submission = await findSubmissionById(id);
    if (!submission) {
      return res.status(404).json({ error: { message: "Approval submission not found" }, data: null });
    }

    const submissionData = submission.toJSON() as {
      status: ApprovalSubmissionStatus;
      requestedBy: number;
      category: string | null;
    };

    if (submissionData.status !== "PENDING") {
      return res
        .status(400)
        .json({ error: { message: "Only pending submissions can be updated" }, data: null });
    }

    if (status === "CANCELLED") {
      if (submissionData.requestedBy !== Number(req.user.id)) {
        return res
          .status(403)
          .json({ error: { message: "Only the submission requester can cancel" }, data: null });
      }

      await submission.update({ status: "CANCELLED" });
    } else if (RENO_REVIEW_STATUSES.has(status)) {
      const reviewAuth = await assertCanReviewSubmission(
        req.user,
        submissionData.category,
        submissionData.requestedBy
      );
      if (!reviewAuth.allowed) {
        return res.status(403).json({ error: { message: reviewAuth.message }, data: null });
      }

      const reviewNote = "reviewNote" in bodyParsed.data ? bodyParsed.data.reviewNote ?? null : null;

      await submission.update({
        status,
        reviewedBy: Number(req.user.id),
        reviewedAt: new Date(),
        reviewNote,
      });
    }

    const submissionWithRequester = await ApprovalSubmission.findByPk(id, {
      include: [approvalSubmissionRequesterInclude, approvalSubmissionReviewerInclude],
    });

    void notifyApprovalSubmissionStatusChange(id, status);

    return res.status(200).json({
      error: null,
      data: submissionWithRequester
        ? serializeSubmission(submissionWithRequester)
        : serializeSubmission(submission),
    });
  } catch (e) {
    Logger.error(e);
    return res
      .status(500)
      .json({ error: { message: "Something went wrong", details: e }, data: null });
  }
};
