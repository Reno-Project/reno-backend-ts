import { type Request, type Response, Router } from "express";
import { verifyLeanToken } from "../middleware/auth";
import type { APIResponse } from "../types/utils/api";

const leanWebhookRouter = Router();

leanWebhookRouter.post(
  "/",
  verifyLeanToken,
  (_req: Request, res: Response<APIResponse<{ received: boolean }>>) => {
    return res.status(200).json({ error: null, data: { received: true } });
  }
);

export default leanWebhookRouter;
