import crypto from "crypto";
import { type NextFunction, type Request, type Response } from "express";
import { QueryTypes } from "sequelize";
import { db as dbConfig } from "../config";
import { messages } from "../config/messages";
import { leanWebhookSecret } from "../config";
import { verify } from "../services/jwt.service";
import { verifyUser } from "../services/user.service";
import type { JwtPayload } from "../types/auth";
import type { APIResponse } from "../types/utils/api";
import { getAllContractorRoles } from "../utils/roles";
import Logger from "../utils/logger";
import db from "../utils/db";

type AuthResponse = Response<APIResponse<null>>;

function sendAuthError(res: AuthResponse, status: number, message: string) {
  return res.status(status).json({ error: { message }, data: null });
}

async function authenticate(
  req: Request,
  res: AuthResponse,
  role: string | false = false
): Promise<JwtPayload | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    sendAuthError(res, 403, messages.HEADER_NOT_FOUND);
    return null;
  }

  const token = authHeader.split("Bearer ")[1];
  if (!token) {
    sendAuthError(res, 404, messages.TOKEN_NOT_FOUND);
    return null;
  }

  const payload = verify(token);
  if (!payload) {
    sendAuthError(res, 403, messages.PAYLOAD_NOT_FOUND);
    return null;
  }

  const isValid = await verifyUser(payload, role);
  if (!isValid) {
    sendAuthError(res, 403, messages.ACTION_NOT_ALLOWED);
    return null;
  }

  return payload;
}

function requireRole(role: string) {
  return async (req: Request, res: AuthResponse, next: NextFunction) => {
    const payload = await authenticate(req, res, role);
    if (!payload) {
      return;
    }
    req.user = payload;
    next();
  };
}

export const verifyToken = async (req: Request, res: AuthResponse, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return sendAuthError(res, 403, messages.HEADER_NOT_FOUND);
  }

  const token = authHeader.split("Bearer ")[1];
  if (!token) {
    return sendAuthError(res, 404, messages.TOKEN_NOT_FOUND);
  }

  const payload = verify(token);
  if (!payload) {
    return sendAuthError(res, 403, messages.PAYLOAD_NOT_FOUND);
  }

  const isValid = await verifyUser(payload, payload.role);
  if (!isValid) {
    return sendAuthError(res, 403, messages.PAYLOAD_NOT_FOUND);
  }

  req.user = payload;
  next();
};

export const isReno = requireRole("reno");
export const isHomeOwner = requireRole("home_owner");
export const isContractor = async (req: Request, res: AuthResponse, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return sendAuthError(res, 403, messages.HEADER_NOT_FOUND);
  }

  const token = authHeader.split("Bearer ")[1];
  if (!token) {
    return sendAuthError(res, 404, messages.TOKEN_NOT_FOUND);
  }

  const payload = verify(token);
  if (!payload) {
    return sendAuthError(res, 403, messages.PAYLOAD_NOT_FOUND);
  }

  const isValid = await verifyUser(payload, payload.role);
  if (!isValid) {
    return sendAuthError(res, 403, messages.ACTION_NOT_ALLOWED);
  }

  req.user = payload;
  next();
};
export const isProjectmanager = requireRole("project_manager");
export const isPartner = requireRole("partner");

export const isRenoAdmin = async (req: Request, res: AuthResponse, next: NextFunction) => {
  try {
    const payload = await authenticate(req, res, "reno");
    if (!payload) {
      return;
    }

    const schema = dbConfig.schema || "dbo";
    const rows = (await db.query(
      `SELECT TOP 1 r.name
       FROM [${schema}].[user_roles] ur
       INNER JOIN [${schema}].[roles] r ON r.id = ur.role_id
       WHERE ur.user_id = :user_id
         AND UPPER(r.name) IN ('RENO_ADMIN', 'RENO_SUPER_ADMIN')`,
      {
        replacements: { user_id: payload.id },
        type: QueryTypes.SELECT,
      }
    )) as Array<{ name: string }>;

    if (!rows || rows.length === 0) {
      return sendAuthError(res, 403, messages.ACTION_NOT_ALLOWED);
    }

    req.user = payload;
    next();
  } catch (error) {
    Logger.error(error);
    const message = error instanceof Error ? error.message : "Something went wrong";
    return res.status(500).json({ error: { message }, data: null });
  }
};

export const isAuthorized = async (req: Request, res: AuthResponse, next: NextFunction) => {
  try {
    if (!req.user) {
      return sendAuthError(res, 403, messages.PAYLOAD_NOT_FOUND);
    }

    const { id, role } = req.user;
    const assign_id =
      req.params?.assign_id !== undefined
        ? req.params.assign_id
        : (req.body as { assign_id?: string | number })?.assign_id;

    const contractorRoles = await getAllContractorRoles();
    if (contractorRoles.includes(role)) {
      if (id == assign_id) {
        next();
        return;
      }
      throw new Error("You are not allowed to access this resource");
    }

    if (role === "reno" || role === "admin") {
      next();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return res.status(401).json({ error: { message }, data: null });
  }
};

export const verifyLeanToken = async (req: Request, res: AuthResponse, next: NextFunction) => {
  try {
    const leanSignature = req.headers["lean-signature"];
    if (!leanSignature) {
      return sendAuthError(res, 400, messages.HEADER_NOT_FOUND);
    }

    if (!leanWebhookSecret) {
      return res.status(500).json({ error: { message: "Lean webhook secret not configured" }, data: null });
    }

    const body = req.body;
    if (!Buffer.isBuffer(body)) {
      return sendAuthError(res, 400, messages.INVALID_HEADER_SIGN);
    }

    const computedHmac = crypto
      .createHmac("sha512", leanWebhookSecret)
      .update(body)
      .digest("hex");

    const signature = Array.isArray(leanSignature) ? leanSignature[0] : leanSignature;
    const provided = signature?.split("sha512=")[1];
    if (computedHmac !== provided) {
      return sendAuthError(res, 401, messages.INVALID_HEADER_SIGN);
    }

    req.body = JSON.parse(body.toString()) as Record<string, unknown>;
    next();
  } catch (error) {
    Logger.error(error);
    const message = error instanceof Error ? error.message : "Something went wrong";
    return res.status(500).json({ error: { message }, data: null });
  }
};
