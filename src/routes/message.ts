import { Router } from "express";
import { createMessage, listMessages } from "../controllers/message";

const messageRouter = Router();

messageRouter.post("/", createMessage);
messageRouter.get("/", listMessages);

export default messageRouter;
