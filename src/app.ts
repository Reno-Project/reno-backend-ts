import express, { type NextFunction, type Request, type Response } from "express";
import conversationRouter from "./routes/conversation";
import messageRouter from "./routes/message";

const app = express();

app.use(express.json());

app.get("/", (req: Request, res: Response, _next: NextFunction) => {
  return res.json({
    status: 200,
    message: "Hello, World!"
  });
});

app.use("/conversation", conversationRouter);
app.use("/messages", messageRouter);

export default app;
