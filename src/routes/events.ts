import { Router, Request, Response, NextFunction } from "express";
import { xdr } from "@stellar/stellar-sdk";
import { simulateContractCall } from "../lib/stellar";
import { validateEventId } from "../middleware/validateEventId";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  res.status(501).json({ message: "not implemented" });
});

router.get(
  "/:id",
  validateEventId,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const event = await simulateContractCall(
        "get_event",
        xdr.ScVal.scvU32(id)
      );
      res.json(serializeBigInt(event));
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("event not found")) {
        res.status(404).json({ error: "event not found" });
      } else {
        next(err);
      }
    }
  }
);

router.get(
  "/:id/tiers",
  validateEventId,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const tiers = await simulateContractCall(
        "get_tiers",
        xdr.ScVal.scvU32(id)
      );
      res.json(serializeBigInt(tiers));
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("tiers not found")) {
        res.status(404).json({ error: "event not found" });
      } else {
        next(err);
      }
    }
  }
);

router.get(
  "/:id/sponsorships",
  validateEventId,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const sponsorships = await simulateContractCall(
        "get_sponsorships",
        xdr.ScVal.scvU32(id)
      );
      res.json(serializeBigInt(sponsorships));
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/:id/tickets/:ticketId",
  validateEventId,
  async (req: Request, res: Response) => {
    res.status(501).json({
      message: "not implemented",
      id: req.params.id,
      ticketId: req.params.ticketId,
    });
  }
);

function serializeBigInt(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializeBigInt);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        serializeBigInt(v),
      ])
    );
  }
  return value;
}

export default router;
