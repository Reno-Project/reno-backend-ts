import { type Request, type Response } from "express";
import Conversation from "../models/conversation";
import {
  type ConversationDTO,
  type DeleteDTO,
  type HealthDTO,
} from "../types/conversation/responses";
import { type APIResponse } from "../types/utils/api";

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
  const {
    entityType,
    entityId,
    parentConversationId,
    members = [],
    createdBy,
  } = req.body;

  if (!createdBy) {
    return res
      .status(400)
      .json({ error: { message: "createdBy is required" }, data: null });
  }

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

  const updates: Record<string, unknown> = {};
  if (Object.prototype.hasOwnProperty.call(req.body, "entityType")) {
    updates.entityType = req.body.entityType;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "entityId")) {
    updates.entityId = req.body.entityId;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "parentConversationId")) {
    updates.parentConversationId = req.body.parentConversationId;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "members")) {
    updates.members = req.body.members;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "createdBy")) {
    updates.createdBy = req.body.createdBy;
  }

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

  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: { message: "userId is required" }, data: null });
  }

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

  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: { message: "userId is required" }, data: null });
  }

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
