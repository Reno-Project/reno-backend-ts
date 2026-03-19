import { type Request, type Response } from "express";
import Message from "../models/message";
import { type MessageDTO } from "../types/conversation/responses";
import { type APIResponse } from "../types/utils/api";

export const createMessage = async (
  req: Request,
  res: Response<APIResponse<MessageDTO>>
) => {
  const { conversationId, userId, body } = req.body;

  if (!conversationId) {
    return res
      .status(400)
      .json({ error: { message: "conversationId is required" }, data: null });
  }
  if (!userId) {
    return res.status(400).json({ error: { message: "userId is required" }, data: null });
  }
  if (!body) {
    return res.status(400).json({ error: { message: "body is required" }, data: null });
  }

  const message = await Message.create({
    conversationId,
    userId,
    body,
  });

  return res.status(201).json({ error: null, data: message.toJSON() as MessageDTO });
};

export const listMessages = async (
  req: Request,
  res: Response<APIResponse<MessageDTO[]>>
) => {
  const { conversation, user } = req.query;
  const where: Record<string, unknown> = {};

  if (conversation) where.conversationId = conversation;
  if (user) where.userId = user;

  const messages = await Message.findAll({ where });
  return res.status(200).json({ error: null, data: messages.map(m => m.toJSON() as MessageDTO) });
};
