import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger";
import conversationRouter from "./routes/conversation";
import messageRouter from "./routes/message";
import approvalSubmissionRouter from "./routes/approvalSubmission";
import leanWebhookRouter from "./routes/leanWebhook";
import { isReno } from "./middleware/auth";

const app = express();

app.use(cors({
  origin: "*",
  methods: ['GET', 'POST', 'PUT', 'DELETE','OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'language', 'lean-signature'],
  credentials: true
}));

app.use("/webhooks/lean", express.raw({ type: "*/*" }), leanWebhookRouter);
app.use(express.json());
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/", (req: Request, res: Response, _next: NextFunction) => {
  return res.json({
    status: 200,
    message: "Hello, World!"
  });
});

app.use("/conversation", conversationRouter);
app.use("/messages", messageRouter);
app.use("/approval-submissions", approvalSubmissionRouter);
app.get("/health", isReno, (_req: Request, res: Response) => {
  return res.json({
    error: null,
    data: {
      message: "Health route ready"
    }
  });
});

export default app;
