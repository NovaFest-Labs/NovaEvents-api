import { NextFunction, Request, Response } from "express";
import { Keypair } from "@stellar/stellar-sdk";
import { getTicketById } from "../services/eventsService";

/** Signatures older than this are rejected, so a captured header can't be replayed later. */
export const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

export class TicketOwnerAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "TicketOwnerAuthError";
    this.status = status;
  }
}

/**
 * The exact message a ticket owner must sign (with their Stellar keypair) to
 * prove ownership before requesting a purchase-confirmation notification.
 */
export function buildNotifyChallengeMessage(
  eventId: number,
  ticketId: number,
  timestamp: number
): string {
  return `novaevents:notify:${eventId}:${ticketId}:${timestamp}`;
}

/**
 * Verifies that the caller controls the private key of the ticket's on-chain
 * owner, via a signed challenge passed in request headers:
 *
 *   x-owner-address:   the owner's Stellar public key (G...)
 *   x-owner-timestamp: ms since epoch when the signature was created
 *   x-owner-signature: base64 ed25519 signature of
 *                      `novaevents:notify:<eventId>:<ticketId>:<timestamp>`
 *
 * The address is cross-checked against the ticket's on-chain owner
 * (get_ticket) so a valid signature from the wrong wallet is still rejected.
 *
 * A non-numeric ticketId is passed through to next() unauthenticated —
 * the route's own id validation rejects it with a clearer 400 before this
 * middleware's failure mode would otherwise apply.
 */
export async function verifyTicketOwner(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ticketId = Number(req.params.ticketId);
    if (!/^\d+$/.test(String(req.params.ticketId))) {
      next();
      return;
    }

    const address = req.header("x-owner-address");
    const signature = req.header("x-owner-signature");
    const timestampHeader = req.header("x-owner-timestamp");

    if (!address || !signature || !timestampHeader) {
      throw new TicketOwnerAuthError(
        "Missing ticket-owner authentication headers (x-owner-address, x-owner-signature, x-owner-timestamp)."
      );
    }

    const timestamp = Number(timestampHeader);
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > SIGNATURE_MAX_AGE_MS) {
      throw new TicketOwnerAuthError("Signature timestamp is missing, invalid, or expired.");
    }

    const eventId = Number(req.params.id);
    const ticket = (await getTicketById(eventId, ticketId)) as { owner: string };

    if (ticket.owner !== address) {
      throw new TicketOwnerAuthError("Caller is not the owner of this ticket.", 403);
    }

    const message = buildNotifyChallengeMessage(eventId, ticketId, timestamp);
    let verified: boolean;
    try {
      verified = Keypair.fromPublicKey(address).verify(
        Buffer.from(message),
        Buffer.from(signature, "base64")
      );
    } catch {
      verified = false;
    }

    if (!verified) {
      throw new TicketOwnerAuthError("Invalid ticket-owner signature.", 403);
    }

    next();
  } catch (err) {
    if (err instanceof TicketOwnerAuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
}
