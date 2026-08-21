import { Router, Request, Response, NextFunction } from "express";
import { xdr } from "@stellar/stellar-sdk";
import { simulateContractCall } from "../lib/stellar";
import { validateEventId } from "../middleware/validateEventId";
import {
  getEventById,
  getTiersByEventId,
  getTicketById,
  getSponsorshipsByEventId,
} from "../services/eventsService";

const router = Router();

router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const count = (await simulateContractCall("event_count")) as number;
    const events = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        simulateContractCall("get_event", xdr.ScVal.scvU32(i)).then((e) => ({
          id: i,
          ...(e as object),
        }))
      )
    );
    res.json(serializeBigInt(events));
  } catch (err) {
    next(err);
  }
});

router.get(
  "/:id",
  validateEventId,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const event = await getEventById(id);
      res.json(serializeBigInt(event));
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/:id/tiers",
  validateEventId,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const tiers = await getTiersByEventId(id);
      res.json(serializeBigInt(tiers));
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/:id/sponsorships",
  validateEventId,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const sponsorships = await getSponsorshipsByEventId(id);
      res.json(serializeBigInt(sponsorships));
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/:id/tickets/:ticketId",
  validateEventId,
  async (req: Request, res: Response, next: NextFunction) => {
    const ticketId = Number(req.params.ticketId);
    if (!Number.isInteger(ticketId) || ticketId < 0) {
      res.status(400).json({ error: "ticket id must be a non-negative integer" });
      return;
    }
    try {
      const id = Number(req.params.id);
      const ticket = await getTicketById(id, ticketId);
      res.json(serializeBigInt(ticket));
    } catch (err) {
      next(err);
    }
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
