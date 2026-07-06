import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./env.js";
import { errorHandler } from "../middleware/error-handler.js";
import { requestLogger } from "../middleware/request-logger.js";
import { healthRouter } from "../routes/health.routes.js";
import { promptRouter } from "../routes/prompt.routes.js";

export function createHttpServer() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.WEB_ORIGIN ?? true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);

  app.use("/health", healthRouter);
  app.use("/api/prompts", promptRouter);

  app.use(errorHandler);

  return app;
}
