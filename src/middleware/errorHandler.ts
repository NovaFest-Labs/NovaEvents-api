import { NextFunction, Request, Response } from "express";
import { EventNotFoundError, TicketNotFoundError } from "../services/eventsService";
import { logger } from "../lib/logger";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log structured error with stack when available
  logger.error({ err: { message: err.message, stack: err.stack } }, "Unhandled error");

  if (err instanceof EventNotFoundError || err instanceof TicketNotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }

  const status = (err as { status?: number }).status ?? 500;
  // 4xx messages are written for the client; 5xx ones carry internals (raw
  // RPC diagnostics, S3/AWS errors), which are logged above but not returned.
  const message = status >= 500 ? "Internal server error" : err.message;
  res.status(status).json({ error: message });
}
