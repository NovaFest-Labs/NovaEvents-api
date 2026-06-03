// TypeScript mirror of the Soroban contract types.
// Amounts are strings because i128 exceeds JavaScript's safe integer range.

export type EventStatus = "Active" | "Ended" | "Cancelled";

export interface Event {
  organizer: string;
  name: string;
  description: string;
  venue: string;
  date_unix: number;
  funding_goal: string;
  balance: string;
  status: EventStatus;
}

export interface TicketTier {
  name: string;
  price: string;
  supply_cap: number;
  tickets_sold: number;
}

export interface Ticket {
  event_id: number;
  tier_index: number;
  owner: string;
  redeemed: boolean;
}

export interface Sponsorship {
  sponsor: string;
  amount: string;
}
