import { Router, Request, Response } from "express";

const router = Router();

// GET /api/events
// TODO: query Stellar RPC and index all events from the contract
router.get("/", async (_req: Request, res: Response) => {
  res.status(501).json({ message: "not implemented" });
});

// GET /api/events/:id
// TODO: call contract get_event(id)
router.get("/:id", async (req: Request, res: Response) => {
  res.status(501).json({ message: "not implemented", id: req.params.id });
});

// GET /api/events/:id/tiers
// TODO: call contract get_tiers(id)
router.get("/:id/tiers", async (req: Request, res: Response) => {
  res.status(501).json({ message: "not implemented", id: req.params.id });
});

// GET /api/events/:id/sponsorships
// TODO: call contract get_sponsorships(id)
router.get("/:id/sponsorships", async (req: Request, res: Response) => {
  res.status(501).json({ message: "not implemented", id: req.params.id });
});

// GET /api/events/:id/tickets/:ticketId
// TODO: call contract get_ticket(id, ticketId)
router.get("/:id/tickets/:ticketId", async (req: Request, res: Response) => {
  res.status(501).json({
    message: "not implemented",
    id: req.params.id,
    ticketId: req.params.ticketId,
  });
});

export default router;
