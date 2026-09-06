import { Router, Request, Response, NextFunction } from "express";
import { validateEventId } from "../middleware/validateEventId";
import { eventsListLimiter } from "../middleware/rateLimiter";
import { uploadImage } from "../middleware/uploadImage";
import { verifyOrganizer } from "../middleware/verifyOrganizer";
import { isValidStellarAddress, isValidEmail } from "../lib/validation";
import {
  getEventById,
  getEventOrganizerById,
  getEventStatusById,
  getTiersByEventId,
  getTicketCountByEventId,
  getTicketById,
  getSponsorshipsByEventId,
  getPayoutsByEventId,
  getSponsorShare,
  getAllEvents,
  EventsUnavailableError,
} from "../services/eventsService";
import {
  uploadEventImage,
  ImageValidationError,
} from "../services/imageService";
import { sendTicketPurchaseConfirmation } from "../services/notificationService";

const router = Router();

router.get("/", eventsListLimiter, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const events = await getAllEvents();
    res.json(serializeBigInt(events));
  } catch (err) {
    if (err instanceof EventsUnavailableError) {
      res.status(503).json({ error: err.message });
      return;
    }
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
  "/:id/organizer",
  validateEventId,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const organizer = await getEventOrganizerById(id);
      res.json(serializeBigInt(organizer));
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/:id/status",
  validateEventId,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const status = await getEventStatusById(id);
      res.json(serializeBigInt(status));
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
  "/:id/ticket-count",
  validateEventId,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const result = await getTicketCountByEventId(id);
      res.json(serializeBigInt(result));
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
  "/:id/payouts",
  validateEventId,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const payouts = await getPayoutsByEventId(id);
      res.json(serializeBigInt(payouts));
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/:id/sponsors/:address/share",
  validateEventId,
  async (req: Request, res: Response, next: NextFunction) => {
    const address = String(req.params.address);
    if (!isValidStellarAddress(address)) {
      res.status(400).json({ error: "sponsor address is not a valid Stellar address" });
      return;
    }
    try {
      const id = Number(req.params.id);
      const shareBps = await getSponsorShare(id, address);
      res.json({ event_id: id, sponsor: address, share_bps: shareBps });
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
      res
        .status(400)
        .json({ error: "ticket id must be a non-negative integer" });
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

/**
 * POST /api/events/:id/tickets/:ticketId/notify
 *
 * Sends a ticket-purchase confirmation email. Meant to be called by the
 * client right after its on-chain purchase transaction confirms.
 *
 * Body: { "email": string }
 *
 * Always responds 202 once the ticket is confirmed to exist — email
 * delivery is best-effort and its failure must never surface as an error
 * for the (already-succeeded) on-chain purchase it's confirming.
 */
router.post(
  "/:id/tickets/:ticketId/notify",
  validateEventId,
  async (req: Request, res: Response, next: NextFunction) => {
    const ticketId = Number(req.params.ticketId);
    if (!Number.isInteger(ticketId) || ticketId < 0) {
      res
        .status(400)
        .json({ error: "ticket id must be a non-negative integer" });
      return;
    }

    const email = req.body?.email;
    if (typeof email !== "string" || !isValidEmail(email)) {
      res.status(400).json({ error: "a valid email address is required" });
      return;
    }

    try {
      const id = Number(req.params.id);
      const result = await sendTicketPurchaseConfirmation(id, ticketId, email);
      res.status(202).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/events/:id/image
 *
 * Upload a cover image for an event.
 * Expects a multipart/form-data body with a single "image" field.
 *
 * Accepted types : JPEG, PNG, WebP, GIF
 * Max size       : 5 MB
 *
 * Requires proof that the caller controls the event's on-chain organizer
 * wallet — see verifyOrganizer for the required headers.
 *
 * Returns: { url: string } — the public URL of the uploaded image.
 */
router.post(
  "/:id/image",
  validateEventId,
  verifyOrganizer,
  (req: Request, res: Response, next: NextFunction) => {
    // Run multer as a callback so we can forward its errors to errorHandler
    uploadImage(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      res.status(400).json({ error: "No image file provided." });
      return;
    }
    try {
      const id = Number(req.params.id);
      const result = await uploadEventImage(id, req.file);
      res.status(201).json({ url: result.url });
    } catch (err) {
      if (err instanceof ImageValidationError) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }
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
