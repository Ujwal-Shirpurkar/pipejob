import express from "express";
import path from "path";
import cors from "cors";
import type { Request, Response, NextFunction } from "express";
import { ZodError, z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";
import logger from "./logger";
import { LlmNotConfiguredError, LlmRefusalError } from "./llm/client";
import { PipelineError } from "./services/pipeline";
import { ImportError } from "./services/sources/importer";
import jobsRouter from "./routes/jobs";
import agentRouter from "./routes/agent";
import profileRouter from "./routes/profile";
import storiesRouter from "./routes/stories";
import systemRouter from "./routes/system";
import companiesRouter from "./routes/companies";
import webhooksRouter from "./routes/webhooks";

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");

  app.use(cors({ origin: config.clientUrl }));
  app.use(express.json({ limit: "2mb" }));

  app.use("/api/jobs", jobsRouter);
  app.use("/api/agent", agentRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api/stories", storiesRouter);
  app.use("/api/companies", companiesRouter);
  app.use("/api/webhooks", webhooksRouter);
  app.use("/api", systemRouter);

  // Serve static client files
  const clientDist = path.join(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", ts: new Date().toISOString() });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: "Invalid request",
        details: z.flattenError(err).fieldErrors,
      });
      return;
    }
    if (err instanceof PipelineError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err instanceof ImportError) {
      res.status(422).json({ error: err.message });
      return;
    }
    if (err instanceof LlmNotConfiguredError) {
      res.status(503).json({ error: err.message });
      return;
    }
    if (err instanceof LlmRefusalError) {
      res.status(422).json({ error: err.message });
      return;
    }
    if (err instanceof Anthropic.RateLimitError) {
      res.status(429).json({
        error: "Claude API rate limit reached — try again in a moment.",
      });
      return;
    }
    if (err instanceof Anthropic.AuthenticationError) {
      res.status(503).json({
        error: "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.",
      });
      return;
    }
    if (err instanceof Anthropic.APIError) {
      res.status(502).json({ error: `Claude API error: ${err.message}` });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    logger.error({
      action: "unhandled_error",
      error: message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    res.status(500).json({ error: message });
  });

  return app;
}
