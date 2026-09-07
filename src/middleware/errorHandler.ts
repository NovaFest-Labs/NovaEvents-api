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
  logger.error({ err: { message: err.message, stack: (err as any).stack } }, "Unhandled error");

  if (err instanceof EventNotFoundError || err instanceof TicketNotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }

  const status = (err as { status?: number }).status ?? 500;
  res.status(status).json({ error: err.message });
}
