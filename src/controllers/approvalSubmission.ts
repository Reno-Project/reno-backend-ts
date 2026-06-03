import { type Request, type Response } from "express";
import ApprovalSubmission from "../models/approvalSubmission";
import ApprovalSubmissionItem from "../models/approvalSubmissionItem";
import {
  type ApprovalSubmissionDTO,
  type ApprovalSubmissionItemDTO,
  type ApprovalSubmissionItemStatus,
  type ApprovalSubmissionStatus,
  type ReviewAllApprovalSubmissionDTO,
} from "../types/approvalSubmission/responses";
import { type APIResponse } from "../types/utils/api";
import {
  notifyApprovalSubmissionItemStatusChange,
  notifyApprovalSubmissionStatusChange,
} from "../services/approvalSubmissionWebhook.service";
import { verifyUser } from "../services/user.service";
import Logger from "../utils/logger";
import db from "../utils/db";
import {
  approvalSubmissionIdParamSchema,
  approvalSubmissionItemIdParamSchema,
  createApprovalSubmissionItemSchema,
  createApprovalSubmissionSchema,
  reviewAllApprovalSubmissionSchema,
  submissionIdParamSchema,
  updateApprovalSubmissionItemStatusSchema,
  updateApprovalSubmissionStatusSchema,
} from "../validation/approvalSubmission";

const RENO_REVIEW_STATUSES = new Set(["APPROVED", "PARTIALLY_APPROVED", "REJECTED"]);

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

async function findSubmissionById(id: number) {
  return ApprovalSubmission.findByPk(id);
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
    console.log(bodyParsed.error);
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

    const submissionData = submission.toJSON() as ApprovalSubmissionDTO;
    if (submissionData.status !== "PENDING") {
      return res
        .status(400)
        .json({ error: { message: "Only pending submissions can be reviewed" }, data: null });
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
      void notifyApprovalSubmissionItemStatusChange(itemData.id, itemStatus);
    }

    return res.status(200).json({
      error: null,
      data: {
        submission: submission.toJSON() as ApprovalSubmissionDTO,
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

export const approveAllApprovalSubmission = (req: Request, res: Response<APIResponse<ReviewAllApprovalSubmissionDTO>>) =>
  reviewAllItems(req, res, "APPROVED", "APPROVED");

export const rejectAllApprovalSubmission = (req: Request, res: Response<APIResponse<ReviewAllApprovalSubmissionDTO>>) =>
  reviewAllItems(req, res, "REJECTED", "REJECTED");

export const createApprovalSubmission = async (
  req: Request,
  res: Response<APIResponse<ApprovalSubmissionDTO>>
) => {
  const parsed = createApprovalSubmissionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: { message: "Invalid request body", details: parsed.error.flatten() }, data: null });
  }

  const { contextType, contextId, category, requestNote } = parsed.data;

  if (!req.user?.id) {
    return res
      .status(403)
      .json({ error: { message: "Unauthorized" }, data: null });
  }

  try {
    const submission = await ApprovalSubmission.create({
      contextType,
      contextId,
      category: category ?? null,
      status: "PENDING",
      requestedBy: Number(req.user.id),
      requestedAt: new Date(),
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
      requestNote: requestNote ?? null,
      requestPayload: null,
    });

    return res
      .status(201)
      .json({ error: null, data: submission.toJSON() as ApprovalSubmissionDTO });
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

    const submissionData = submission.toJSON() as ApprovalSubmissionDTO;
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

    let serializedSnapshot: string | null = null;
    if (itemSnapshot !== undefined) {
      try {
        serializedSnapshot = serializeSnapshot(itemSnapshot);
      } catch {
        return res
          .status(400)
          .json({ error: { message: "itemSnapshot must be valid JSON" }, data: null });
      }
    }

    const item = await ApprovalSubmissionItem.create({
      submissionId,
      itemType,
      itemId,
      itemSnapshot: serializedSnapshot,
      status: "PENDING",
      decidedAt: null,
      itemNote: itemNote ?? null,
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

    const submissionData = submission.toJSON() as ApprovalSubmissionDTO;
    if (submissionData.status !== "PENDING") {
      return res
        .status(400)
        .json({ error: { message: "Only items on pending submissions can be reviewed" }, data: null });
    }

    const now = new Date();
    await item.update({ status, decidedAt: now });
    await item.reload();

    void notifyApprovalSubmissionItemStatusChange(itemId, status);

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

    const submissionData = submission.toJSON() as ApprovalSubmissionDTO;

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
      const isReno = await verifyUser(req.user, "reno");
      if (!isReno) {
        return res
          .status(403)
          .json({ error: { message: "Only Reno users can approve or reject submissions" }, data: null });
      }

      const reviewNote = "reviewNote" in bodyParsed.data ? bodyParsed.data.reviewNote ?? null : null;

      await submission.update({
        status,
        reviewedBy: Number(req.user.id),
        reviewedAt: new Date(),
        reviewNote,
      });
    }

    await submission.reload();

    void notifyApprovalSubmissionStatusChange(id, status);

    return res
      .status(200)
      .json({ error: null, data: submission.toJSON() as ApprovalSubmissionDTO });
  } catch (e) {
    Logger.error(e);
    return res
      .status(500)
      .json({ error: { message: "Something went wrong", details: e }, data: null });
  }
};
