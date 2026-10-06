import { NextFunction, Request, Response } from "express";

// Only accept plain non-negative decimal integers (e.g. "0", "42").
// Rejects hex ("0x1"), exponential ("1e2"), floats ("1.5"), and negatives.
const DECIMAL_INT_RE = /^\d+$/;

// event_id is a u32 on-chain. An id past this would otherwise reach
// simulateContractCall and fail with a raw "XDR Write Error" leaking out
// as an unhandled 500 instead of a clean 400.
const U32_MAX = 4294967295;

export function validateEventId(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const raw = String(req.params.id);
  if (!DECIMAL_INT_RE.test(raw) || Number(raw) > U32_MAX) {
    res.status(400).json({ error: "event id must be a non-negative integer" });
    return;
  }
  next();
}
