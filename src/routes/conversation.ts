import { Router } from "express";
import {
  createConversation,
  deleteConversation,
  getConversation,
  getConversationHealth,
  joinConversation,
  leaveConversation,
  markConversationRead,
  listConversations,
  updateConversation,
} from "../controllers/conversation";

const conversationRouter = Router();

conversationRouter.get("/health", getConversationHealth);
conversationRouter.post("/", createConversation);
conversationRouter.get("/", listConversations);
conversationRouter.get("/:id", getConversation);
conversationRouter.patch("/:id", updateConversation);
conversationRouter.delete("/:id", deleteConversation);
conversationRouter.post("/:id/join", joinConversation);
conversationRouter.post("/:id/leave", leaveConversation);
conversationRouter.post("/:id/read", markConversationRead);

export default conversationRouter;
