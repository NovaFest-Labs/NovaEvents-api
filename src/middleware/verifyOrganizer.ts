import { NextFunction, Request, Response } from "express";
import { Keypair } from "@stellar/stellar-sdk";
import { getEventOrganizerById } from "../services/eventsService";

/** Signatures older than this are rejected, so a captured header can't be replayed later. */
export const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

export class OrganizerAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "OrganizerAuthError";
    this.status = status;
  }
}

/**
 * The exact message an organizer must sign (with their Stellar keypair) to
 * prove ownership of an event before uploading its cover image.
 */
export function buildUploadChallengeMessage(eventId: number, timestamp: number): string {
  return `novaevents:upload-image:${eventId}:${timestamp}`;
}

/**
 * Verifies that the caller controls the private key of the event's on-chain
 * organizer address, via a signed challenge passed in request headers:
 *
 *   x-organizer-address:   the organizer's Stellar public key (G...)
 *   x-organizer-timestamp: ms since epoch when the signature was created
 *   x-organizer-signature: base64 ed25519 signature of
 *                          `novaevents:upload-image:<eventId>:<timestamp>`
 *
 * The address is cross-checked against the event's on-chain organizer
 * (get_event) so a valid signature from the wrong wallet is still rejected.
 */
export async function verifyOrganizer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const address = req.header("x-organizer-address");
    const signature = req.header("x-organizer-signature");
    const timestampHeader = req.header("x-organizer-timestamp");

    if (!address || !signature || !timestampHeader) {
      throw new OrganizerAuthError(
        "Missing organizer authentication headers (x-organizer-address, x-organizer-signature, x-organizer-timestamp)."
      );
    }

    const timestamp = Number(timestampHeader);
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > SIGNATURE_MAX_AGE_MS) {
      throw new OrganizerAuthError("Signature timestamp is missing, invalid, or expired.");
    }

    const eventId = Number(req.params.id);
    const { organizer } = await getEventOrganizerById(eventId);

    if (organizer !== address) {
      throw new OrganizerAuthError("Caller is not the organizer of this event.", 403);
    }

    const message = buildUploadChallengeMessage(eventId, timestamp);
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
      throw new OrganizerAuthError("Invalid organizer signature.", 403);
    }

    next();
  } catch (err) {
    if (err instanceof OrganizerAuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
}
