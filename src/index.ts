import "dotenv/config";
import Logger from "./utils/logger";
import { port } from "./config";
import app from "./app";
import db from "./utils/db";

const startServer = async () => {
  try {
    await db.authenticate();
    Logger.info("Database connection established");

    app
      .listen(port, () => {
        Logger.info(`server running on port : ${port}`);
      })
      .on("error", (e: Error) => Logger.error(e));
  } catch (error) {
    Logger.error(error as Error);
    process.exit(1);
  }
};

startServer();
