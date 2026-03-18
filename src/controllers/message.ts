import { type Request, type Response } from "express";
import { QueryTypes } from "sequelize";
import Message from "../models/message";
import { db as dbConfig } from "../config";
import db from "../utils/db";
import { type MessageDTO, type MessageWithUserDTO } from "../types/conversation/responses";
import { type APIResponse } from "../types/utils/api";
import { createMessageSchema, listMessagesSchema } from "../validation/message";

export const createMessage = async (
  req: Request,
  res: Response<APIResponse<MessageDTO>>
) => {
  const parsed = createMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: { message: "Invalid request body", details: parsed.error.flatten() }, data: null });
  }
  const { conversationId, userId, body } = parsed.data;

  const message = await Message.create({
    conversationId,
    userId,
    body,
  });

  return res.status(201).json({ error: null, data: message.toJSON() as MessageDTO });
};

export const listMessages = async (
  req: Request,
  res: Response<APIResponse<MessageWithUserDTO[]>>
) => {
  const parsed = listMessagesSchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: { message: "Invalid query params", details: parsed.error.flatten() }, data: null });
  }
  const { conversation, user } = parsed.data;
  const whereClauses: string[] = [];
  const replacements: Record<string, unknown> = {};

  if (conversation !== undefined) {
    const conversationId = Number(conversation);
    if (!Number.isInteger(conversationId)) {
      return res
        .status(400)
        .json({ error: { message: "conversation must be a number" }, data: null });
    }
    whereClauses.push("m.conversationId = :conversationId");
    replacements.conversationId = conversationId;
  }

  if (user !== undefined) {
    whereClauses.push("m.userId = :userId");
    replacements.userId = String(user);
  }

  const schema = dbConfig.schema || "dbo";
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const rows = (await db.query(
    `
      SELECT
        m.id AS message_id,
        m.conversationId AS message_conversationId,
        m.userId AS message_userId,
        m.body AS message_body,
        m.createdAt AS message_createdAt,
        m.updatedAt AS message_updatedAt,
        u.id AS user_id,
        u.username as username,
        u.profile_url as profile
      FROM [${schema}].[messages] m
      JOIN [${schema}].[users] u ON u.id = m.userId
      ${whereSql}
      ORDER BY m.id DESC
    `,
    { replacements, type: QueryTypes.SELECT }
  )) as Record<string, unknown>[];

  const messages = rows.map((row) => {
    const message: MessageDTO = {
      id: Number(row.message_id),
      conversationId: Number(row.message_conversationId),
      userId: String(row.message_userId),
      body: String(row.message_body),
    };
    if (row.message_createdAt !== undefined) {
      message.createdAt = row.message_createdAt as string;
    }
    if (row.message_updatedAt !== undefined) {
      message.updatedAt = row.message_updatedAt as string;
    }
    const userData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (!key.startsWith("message_")) {
        userData[key] = value;
      }
    }
    return { message, user: userData };
  });

  return res.status(200).json({ error: null, data: messages });
};
