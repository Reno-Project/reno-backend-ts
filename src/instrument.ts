import "dotenv/config";
import * as Sentry from "@sentry/node";

const isLocal = process.env.IS_LOCAL === "true";

if (process.env.SENTRY_DSN && !isLocal) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    initialScope: {
      tags: {
        service: "ts-server",
      },
    },
  });
}

export default Sentry;
