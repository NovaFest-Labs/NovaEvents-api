import { Address, xdr } from "@stellar/stellar-sdk";
import { simulateContractCall } from "../lib/stellar";
import { getEventImageUrl } from "../lib/imageStore";
import db from "../lib/db";

export class EventNotFoundError extends Error {
  constructor(public readonly eventId: number) {
    super(`event ${eventId} not found`);
    this.name = "EventNotFoundError";
  }
}

export class EventsUnavailableError extends Error {
  constructor(cause: unknown) {
    super(
      `failed to fetch events: ${cause instanceof Error ? cause.message : String(cause)}`
    );
    this.name = "EventsUnavailableError";
  }
}

export class TicketNotFoundError extends Error {
  constructor(public readonly eventId: number, public readonly ticketId: number) {
    super(`ticket ${ticketId} not found for event ${eventId}`);
    this.name = "TicketNotFoundError";
  }
}

/** Merges in the event's stored cover image URL, omitting the field when none has been uploaded. */
function withImageUrl(event: unknown, eventId: number): unknown {
  const imageUrl = getEventImageUrl(eventId);
  if (!imageUrl) return event;
  return { ...(event as object), image_url: imageUrl };
}

export async function getEventById(eventId: number): Promise<unknown> {
  try {
    const event = await simulateContractCall("get_event", xdr.ScVal.scvU32(eventId));
    return withImageUrl(event, eventId);
  } catch (err) {
    if (err instanceof Error && err.message.includes("event not found")) {
      throw new EventNotFoundError(eventId);
    }
    throw err;
  }
}

export async function getEventOrganizerById(eventId: number): Promise<{ event_id: number; organizer: unknown }> {
  try {
    const event = await simulateContractCall("get_event", xdr.ScVal.scvU32(eventId));
    const eventObj = event as Record<string, unknown>;
    return {
      event_id: eventId,
      organizer: eventObj.organizer,
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes("event not found")) {
      throw new EventNotFoundError(eventId);
    }
    throw err;
  }
}

export async function getEventStatusById(
  eventId: number
): Promise<{ event_id: number; status: unknown }> {
  const event = (await getEventById(eventId)) as Record<string, unknown>;
  return {
    event_id: eventId,
    status: event.status,
  };
}

export async function getTiersByEventId(eventId: number): Promise<unknown> {
  try {
    return await simulateContractCall("get_tiers", xdr.ScVal.scvU32(eventId));
  } catch (err) {
    if (err instanceof Error && err.message.includes("event not found")) {
      throw new EventNotFoundError(eventId);
    }
    throw err;
  }
}

export async function getTicketById(eventId: number, ticketId: number): Promise<unknown> {
  try {
    return await simulateContractCall(
      "get_ticket",
      xdr.ScVal.scvU32(eventId),
      xdr.ScVal.scvU32(ticketId)
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes("ticket not found")) {
      throw new TicketNotFoundError(eventId, ticketId);
    }
    throw err;
  }
}

export async function getAllEvents(): Promise<Array<Record<string, unknown>>> {
  try {
    const rows = db.prepare("SELECT payload FROM events_index ORDER BY id").all();
    return rows.map((r: any) => JSON.parse(r.payload) as Record<string, unknown>);
  } catch (err) {
    throw new EventsUnavailableError(err);
  }
}

interface Sponsorship {
  sponsor: unknown;
  amount: bigint;
}

export async function getSponsorshipsByEventId(eventId: number): Promise<Sponsorship[]> {
  // get_sponsorships never errors for a nonexistent event (the contract returns an
  // empty list), so existence has to be checked separately via get_event.
  await getEventById(eventId);

  const sponsorships = (await simulateContractCall(
    "get_sponsorships",
    xdr.ScVal.scvU32(eventId)
  )) as Sponsorship[];

  return [...sponsorships].sort((a, b) => (a.amount < b.amount ? 1 : a.amount > b.amount ? -1 : 0));
}

interface Payout {
  recipient: unknown;
  amount: bigint;
}

export async function getPayoutsByEventId(eventId: number): Promise<Payout[]> {
  // get_payouts never errors for a nonexistent event (the contract returns an
  // empty list), so existence has to be checked separately via get_event.
  await getEventById(eventId);

  return (await simulateContractCall(
    "get_payouts",
    xdr.ScVal.scvU32(eventId)
  )) as Payout[];
}

interface TicketTier {
  tickets_sold: number;
}

/** Returns the total number of tickets sold across all tiers of an event. */
export async function getTicketCountByEventId(
  eventId: number
): Promise<{ event_id: number; ticket_count: number }> {
  const tiers = (await getTiersByEventId(eventId)) as TicketTier[];
  const ticket_count = tiers.reduce((sum, tier) => sum + tier.tickets_sold, 0);
  return { event_id: eventId, ticket_count };
}

/** Returns a sponsor's share of an event's total sponsorship, in basis points. */
export async function getSponsorShare(
  eventId: number,
  sponsorAddress: string
): Promise<number> {
  await getEventById(eventId);

  return (await simulateContractCall(
    "get_sponsor_share",
    xdr.ScVal.scvU32(eventId),
    Address.fromString(sponsorAddress).toScVal()
  )) as number;
}
