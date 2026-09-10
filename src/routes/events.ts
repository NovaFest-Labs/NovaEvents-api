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

router.get("/", eventsListLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizer =
      typeof req.query.organizer === "string" ? req.query.organizer : undefined;
    const events = await getAllEvents();
    const filtered = organizer
      ? events.filter((e) => (e as Record<string, unknown>).organizer === organizer)
      : events;
    res.json(serializeBigInt(filtered.map(toEventSummary)));
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
      const [event, tiers, sponsorships] = await Promise.all([
        getEventById(id),
        getTiersByEventId(id),
        getSponsorshipsByEventId(id),
      ]);
      res.json(
        serializeBigInt(
          toEventDetail(
            id,
            event as Record<string, unknown>,
            tiers as Array<Record<string, unknown>>,
            sponsorships as Array<{ sponsor: unknown; amount: unknown }>
          )
        )
      );
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
    if (!/^\d+$/.test(String(req.params.ticketId))) {
      res
        .status(400)
        .json({ error: "ticket id must be a non-negative integer" });
      return;
    }
    const ticketId = Number(req.params.ticketId);
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
    if (!/^\d+$/.test(String(req.params.ticketId))) {
      res
        .status(400)
        .json({ error: "ticket id must be a non-negative integer" });
      return;
    }
    const ticketId = Number(req.params.ticketId);

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

function normalizeStatus(status: unknown): string {
  if (Array.isArray(status) && typeof status[0] === "string") return status[0];
  return typeof status === "string" ? status : String(status);
}

function toDateIso(dateUnix: unknown): string {
  const seconds = Number(dateUnix);
  return new Date(seconds * 1000).toISOString();
}

/**
 * Maps a raw on-chain event (as returned by getAllEvents, keyed by the
 * contract's own field names) to the summary view the events list and
 * organizer dashboard expect.
 */
function toEventSummary(raw: unknown): Record<string, unknown> {
  const event = raw as Record<string, unknown>;
  const tiers = (event.tiers as Array<{ tickets_sold?: number }>) ?? [];
  return {
    id: event.id,
    name: event.name,
    venue: event.venue,
    date: toDateIso(event.date_unix),
    funding_goal: event.funding_goal,
    current_balance: event.balance,
    tier_count: tiers.length,
    tickets_sold: tiers.reduce((sum, t) => sum + (t.tickets_sold ?? 0), 0),
    organizer: event.organizer,
  };
}

/**
 * Maps a raw on-chain event + tiers + sponsorships to the detail view the
 * event detail page expects.
 */
function toEventDetail(
  id: number,
  event: Record<string, unknown>,
  tiers: Array<Record<string, unknown>>,
  sponsorships: Array<{ sponsor: unknown; amount: unknown }>
): Record<string, unknown> {
  return {
    id,
    name: event.name,
    description: event.description,
    venue: event.venue,
    date: toDateIso(event.date_unix),
    organizer_address: event.organizer,
    funding_goal: event.funding_goal,
    current_balance: event.balance,
    status: normalizeStatus(event.status),
    image_url: event.image_url,
    tiers: tiers.map((tier, i) => ({
      id: String(i),
      name: tier.name,
      price: tier.price,
      supply_cap: tier.supply_cap,
      tickets_sold: tier.tickets_sold,
    })),
    sponsorships: sponsorships.map((s) => ({
      sponsor_address: s.sponsor,
      amount: s.amount,
    })),
  };
}

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
