import { type Request, type Response } from "express";
import Message from "../models/message";

export const createMessage = async (req: Request, res: Response) => {
  const { conversationId, userId, body } = req.body;

  if (!conversationId) {
    return res.status(400).json({ status: 400, message: "conversationId is required" });
  }
  if (!userId) {
    return res.status(400).json({ status: 400, message: "userId is required" });
  }
  if (!body) {
    return res.status(400).json({ status: 400, message: "body is required" });
  }

  const message = await Message.create({
    conversationId,
    userId,
    body,
  });

  return res.status(201).json({ status: 201, data: message });
};

export const listMessages = async (req: Request, res: Response) => {
  const { conversation, user } = req.query;
  const where: Record<string, unknown> = {};

  if (conversation) where.conversationId = conversation;
  if (user) where.userId = user;

  const messages = await Message.findAll({ where });
  return res.json({ status: 200, data: messages });
};
