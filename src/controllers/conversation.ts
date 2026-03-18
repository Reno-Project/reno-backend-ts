import { type Request, type Response } from "express";
import Conversation from "../models/conversation";
import {
  type ConversationDTO,
  type DeleteDTO,
  type HealthDTO,
} from "../types/conversation/responses";
import { type APIResponse } from "../types/utils/api";
import {
  createConversationSchema,
  joinLeaveSchema,
  updateConversationSchema,
} from "../validation/conversation";

export const getConversationHealth = (
  _req: Request,
  res: Response<APIResponse<HealthDTO>>
) => {
  return res.status(200).json({ error: null, data: { message: "Conversation route ready" } });
};

export const createConversation = async (
  req: Request,
  res: Response<APIResponse<ConversationDTO>>
) => {
  const parsed = createConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: { message: "Invalid request body", details: parsed.error.flatten() }, data: null });
  }
  const { entityType, entityId, parentConversationId, members = [], createdBy } = parsed.data;

  const conversation = await Conversation.create({
    entityType,
    entityId,
    parentConversationId,
    members,
    createdBy,
  });

  return res
    .status(201)
    .json({ error: null, data: conversation.toJSON() as ConversationDTO });
};

export const listConversations = async (
  req: Request,
  res: Response<APIResponse<ConversationDTO[]>>
) => {
  const { entityType, entityId } = req.query;
  const where: Record<string, unknown> = {};

  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;

  const conversations = await Conversation.findAll({ where });
  return res.status(200).json({
    error: null,
    data: conversations.map((item) => item.toJSON() as ConversationDTO),
  });
};

export const getConversation = async (
  req: Request,
  res: Response<APIResponse<ConversationDTO>>
) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res
      .status(400)
      .json({ error: { message: "Invalid conversation id" }, data: null });
  }

  const conversation = await Conversation.findByPk(id);

  if (!conversation) {
    return res
      .status(404)
      .json({ error: { message: "Conversation not found" }, data: null });
  }

  return res
    .status(200)
    .json({ error: null, data: conversation.toJSON() as ConversationDTO });
};

export const updateConversation = async (
  req: Request,
  res: Response<APIResponse<ConversationDTO>>
) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res
      .status(400)
      .json({ error: { message: "Invalid conversation id" }, data: null });
  }

  const conversation = await Conversation.findByPk(id);

  if (!conversation) {
    return res
      .status(404)
      .json({ error: { message: "Conversation not found" }, data: null });
  }

  const parsed = updateConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: { message: "Invalid request body", details: parsed.error.flatten() }, data: null });
  }
  const updates: Record<string, unknown> = parsed.data;

  if (Object.keys(updates).length > 0) {
    await conversation.update(updates);
  }

  return res
    .status(200)
    .json({ error: null, data: conversation.toJSON() as ConversationDTO });
};

export const deleteConversation = async (
  req: Request,
  res: Response<APIResponse<DeleteDTO>>
) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res
      .status(400)
      .json({ error: { message: "Invalid conversation id" }, data: null });
  }

  const conversation = await Conversation.findByPk(id);

  if (!conversation) {
    return res
      .status(404)
      .json({ error: { message: "Conversation not found" }, data: null });
  }

  await conversation.destroy();
  return res.status(200).json({ error: null, data: { message: "Conversation deleted" } });
};

export const joinConversation = async (
  req: Request,
  res: Response<APIResponse<ConversationDTO>>
) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res
      .status(400)
      .json({ error: { message: "Invalid conversation id" }, data: null });
  }

  const parsed = joinLeaveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: { message: "Invalid request body", details: parsed.error.flatten() }, data: null });
  }
  const { userId } = parsed.data;

  const conversation = await Conversation.findByPk(id);
  if (!conversation) {
    return res
      .status(404)
      .json({ error: { message: "Conversation not found" }, data: null });
  }

  const currentMembers = Array.isArray(conversation.get("members"))
    ? (conversation.get("members") as unknown[])
    : [];
  const memberSet = new Set(currentMembers.map((member) => String(member)));
  memberSet.add(String(userId));

  await conversation.update({ members: Array.from(memberSet) });
  return res
    .status(200)
    .json({ error: null, data: conversation.toJSON() as ConversationDTO });
};

export const leaveConversation = async (
  req: Request,
  res: Response<APIResponse<ConversationDTO>>
) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res
      .status(400)
      .json({ error: { message: "Invalid conversation id" }, data: null });
  }

  const parsed = joinLeaveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: { message: "Invalid request body", details: parsed.error.flatten() }, data: null });
  }
  const { userId } = parsed.data;

  const conversation = await Conversation.findByPk(id);
  if (!conversation) {
    return res
      .status(404)
      .json({ error: { message: "Conversation not found" }, data: null });
  }

  const currentMembers = Array.isArray(conversation.get("members"))
    ? (conversation.get("members") as unknown[])
    : [];
  const filteredMembers = currentMembers
    .map((member) => String(member))
    .filter((member) => member !== String(userId));

  await conversation.update({ members: filteredMembers });
  return res
    .status(200)
    .json({ error: null, data: conversation.toJSON() as ConversationDTO });
};
