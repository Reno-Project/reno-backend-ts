import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger";
import conversationRouter from "./routes/conversation";
import messageRouter from "./routes/message";

const app = express();

app.use(cors({
  origin: '*'
}));
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

export default app;
