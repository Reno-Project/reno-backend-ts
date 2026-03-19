import { type Request, type Response } from "express";
import { QueryTypes } from "sequelize";
import Conversation from "../models/conversation";
import { db as dbConfig } from "../config";
import db from "../utils/db";
import {
  type ConversationDTO,
  type ConversationMemberDTO,
  type ConversationWithMembersDTO,
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
  res: Response<APIResponse<ConversationWithMembersDTO[]>>
) => {
  const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;
  const entityId = typeof req.query.entityId === "string" ? req.query.entityId : undefined;
  const userId = typeof req.query.user_id === "string" ? req.query.user_id : undefined;

  const schema = dbConfig.schema || "dbo";
  const whereClauses: string[] = [];
  const replacements: Record<string, unknown> = {};

  if (userId) {
    whereClauses.push(
      "EXISTS (SELECT 1 FROM OPENJSON(c.members) m2 WHERE m2.value = :userId)"
    );
    replacements.userId = userId;
  }
  if (entityType) {
    whereClauses.push("c.entityType = :entityType");
    replacements.entityType = entityType;
  }
  if (entityId) {
    whereClauses.push("c.entityId = :entityId");
    replacements.entityId = entityId;
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const rows = (await db.query(
    `
      SELECT
        c.id AS conversation_id,
        c.entityType AS conversation_entityType,
        c.entityId AS conversation_entityId,
        c.parentConversationId AS conversation_parentConversationId,
        c.members AS conversation_members,
        c.createdBy AS conversation_createdBy,
        c.createdAt AS conversation_createdAt,
        c.updatedAt AS conversation_updatedAt,
        u.id AS member_user_id,
        u.username AS member_username,
        u.profile_url AS member_profile
      FROM [${schema}].[conversation] c
      OUTER APPLY OPENJSON(c.members) m
      LEFT JOIN [${schema}].[users] u ON u.id = m.value
      ${whereSql}
      ORDER BY c.id DESC
    `,
    { replacements, type: QueryTypes.SELECT }
  )) as Record<string, unknown>[];

  const conversationMap = new Map<number, ConversationWithMembersDTO>();

  for (const row of rows) {
    const conversationId = Number(row.conversation_id);
    if (!conversationMap.has(conversationId)) {
      const base: ConversationWithMembersDTO = {
        id: conversationId,
        entityType: row.conversation_entityType as string | null,
        entityId: row.conversation_entityId as string | null,
        parentConversationId: row.conversation_parentConversationId as number | null,
        members: Array.isArray(row.conversation_members)
          ? (row.conversation_members as unknown[])
          : JSON.parse(String(row.conversation_members ?? "[]")),
        createdBy: String(row.conversation_createdBy),
        members_detail: [],
      };
      if (row.conversation_createdAt !== undefined) {
        base.createdAt = row.conversation_createdAt as string;
      }
      if (row.conversation_updatedAt !== undefined) {
        base.updatedAt = row.conversation_updatedAt as string;
      }
      conversationMap.set(conversationId, base);
    }

    if (row.member_user_id !== null && row.member_user_id !== undefined) {
      const member: ConversationMemberDTO = {
        user_id: String(row.member_user_id),
        username:
          row.member_username !== null && row.member_username !== undefined
            ? String(row.member_username)
            : null,
        profile:
          row.member_profile !== null && row.member_profile !== undefined
            ? String(row.member_profile)
            : null,
      };
      const item = conversationMap.get(conversationId);
      if (item && !item.members_detail.some((m) => m.user_id === member.user_id)) {
        item.members_detail.push(member);
      }
    }
  }

  return res.status(200).json({ error: null, data: Array.from(conversationMap.values()) });
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

  const currentMembers = conversation.get("members")
    ? (JSON.parse(conversation.get("members").replace(/'/g, '"')) as unknown[])
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

  const currentMembers = (conversation.get("members")
    ? (JSON.parse(conversation.get("members").replace(/'/g, '"')) as unknown[])
    : [];
  const filteredMembers = currentMembers
    .map((member) => String(member))
    .filter((member) => member !== String(userId));

  await conversation.update({ members: filteredMembers });
  return res
    .status(200)
    .json({ error: null, data: conversation.toJSON() as ConversationDTO });
};
