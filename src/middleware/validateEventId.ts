import { NextFunction, Request, Response } from "express";

export function validateEventId(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 0) {
    res.status(400).json({ error: "event id must be a non-negative integer" });
    return;
  }
  next();
}
