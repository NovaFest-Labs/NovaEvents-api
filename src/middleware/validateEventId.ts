import { NextFunction, Request, Response } from "express";

// Only accept plain non-negative decimal integers (e.g. "0", "42").
// Rejects hex ("0x1"), exponential ("1e2"), floats ("1.5"), and negatives.
const DECIMAL_INT_RE = /^\d+$/;

export function validateEventId(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!DECIMAL_INT_RE.test(req.params.id)) {
    res.status(400).json({ error: "event id must be a non-negative integer" });
    return;
  }
  next();
}
