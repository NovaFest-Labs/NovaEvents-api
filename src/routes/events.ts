import { NextFunction, Router, Request, Response } from "express";
import { validateEventId } from "../middleware/validateEventId";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  res.status(501).json({ message: "not implemented" });
});

router.get(
  "/:id",
  validateEventId,
  async (req: Request, res: Response) => {
    res.status(501).json({ message: "not implemented", id: req.params.id });
  }
);

router.get(
  "/:id/tiers",
  validateEventId,
  async (req: Request, res: Response) => {
    res.status(501).json({ message: "not implemented", id: req.params.id });
  }
);

router.get(
  "/:id/sponsorships",
  validateEventId,
  async (req: Request, res: Response) => {
    res.status(501).json({ message: "not implemented", id: req.params.id });
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

export default router;
