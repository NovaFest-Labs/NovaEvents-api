import { xdr } from "@stellar/stellar-sdk";
import { simulateContractCall } from "../lib/stellar";

export class EventNotFoundError extends Error {
  constructor(public readonly eventId: number) {
    super(`event ${eventId} not found`);
    this.name = "EventNotFoundError";
  }
}

export class TicketNotFoundError extends Error {
  constructor(public readonly eventId: number, public readonly ticketId: number) {
    super(`ticket ${ticketId} not found for event ${eventId}`);
    this.name = "TicketNotFoundError";
  }
}

export async function getEventById(eventId: number): Promise<unknown> {
  try {
    return await simulateContractCall("get_event", xdr.ScVal.scvU32(eventId));
  } catch (err) {
    if (err instanceof Error && err.message.includes("event not found")) {
      throw new EventNotFoundError(eventId);
    }
    throw err;
  }
}

export async function getTiersByEventId(eventId: number): Promise<unknown> {
  try {
    return await simulateContractCall("get_tiers", xdr.ScVal.scvU32(eventId));
  } catch (err) {
    if (err instanceof Error && err.message.includes("tiers not found")) {
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
