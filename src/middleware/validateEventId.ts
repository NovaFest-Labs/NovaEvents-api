import { NextFunction, Request, Response } from "express";
import { isValidU32Id } from "../lib/validation";

export function validateEventId(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!isValidU32Id(String(req.params.id))) {
    res.status(400).json({ error: "event id must be a non-negative integer" });
    return;
  }
  next();
}
