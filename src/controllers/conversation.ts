import { type Request, type Response } from "express";
import Conversation from "../models/conversation";

export const getConversationHealth = (_req: Request, res: Response) => {
  return res.json({
    status: 200,
    message: "Conversation route ready",
  });
};

export const createConversation = async (req: Request, res: Response) => {
  const {
    entityType,
    entityId,
    parentConversationId,
    members = [],
    createdBy,
  } = req.body;

  if (!createdBy) {
    return res.status(400).json({ status: 400, message: "createdBy is required" });
  }

  const conversation = await Conversation.create({
    entityType,
    entityId,
    parentConversationId,
    members,
    createdBy,
  });

  return res.status(201).json({ status: 201, data: conversation });
};

export const listConversations = async (req: Request, res: Response) => {
  const { entityType, entityId } = req.query;
  const where: Record<string, unknown> = {};

  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;

  const conversations = await Conversation.findAll({ where });
  return res.json({ status: 200, data: conversations });
};

export const getConversation = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ status: 400, message: "Invalid conversation id" });
  }

  const conversation = await Conversation.findByPk(id);

  if (!conversation) {
    return res.status(404).json({ status: 404, message: "Conversation not found" });
  }

  return res.json({ status: 200, data: conversation });
};

export const updateConversation = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ status: 400, message: "Invalid conversation id" });
  }

  const conversation = await Conversation.findByPk(id);

  if (!conversation) {
    return res.status(404).json({ status: 404, message: "Conversation not found" });
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

  return res.json({ status: 200, data: conversation });
};

export const deleteConversation = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ status: 400, message: "Invalid conversation id" });
  }

  const conversation = await Conversation.findByPk(id);

  if (!conversation) {
    return res.status(404).json({ status: 404, message: "Conversation not found" });
  }

  await conversation.destroy();
  return res.json({ status: 200, message: "Conversation deleted" });
};

export const joinConversation = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ status: 400, message: "Invalid conversation id" });
  }

  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ status: 400, message: "userId is required" });
  }

  const conversation = await Conversation.findByPk(id);
  if (!conversation) {
    return res.status(404).json({ status: 404, message: "Conversation not found" });
  }

  const currentMembers = Array.isArray(conversation.get("members"))
    ? (conversation.get("members") as unknown[])
    : [];
  const memberSet = new Set(currentMembers.map((member) => String(member)));
  memberSet.add(String(userId));

  await conversation.update({ members: Array.from(memberSet) });
  return res.json({ status: 200, data: conversation });
};

export const leaveConversation = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ status: 400, message: "Invalid conversation id" });
  }

  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ status: 400, message: "userId is required" });
  }

  const conversation = await Conversation.findByPk(id);
  if (!conversation) {
    return res.status(404).json({ status: 404, message: "Conversation not found" });
  }

  const currentMembers = Array.isArray(conversation.get("members"))
    ? (conversation.get("members") as unknown[])
    : [];
  const filteredMembers = currentMembers
    .map((member) => String(member))
    .filter((member) => member !== String(userId));

  await conversation.update({ members: filteredMembers });
  return res.json({ status: 200, data: conversation });
};
