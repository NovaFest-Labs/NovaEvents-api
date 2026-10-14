/**
 * Tests for GET /api/events, mounted on a minimal Express app so they stay
 * hermetic: no RPC, DB, or env-var setup required.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../services/eventsService", () => ({
  getAllEvents: vi.fn(),
  getTicketById: vi.fn(),
  getEventById: vi.fn(),
  getEventOrganizerById: vi.fn(),
  getEventStatusById: vi.fn(),
  getTiersByEventId: vi.fn(),
  getTicketCountByEventId: vi.fn(),
  getSponsorshipsByEventId: vi.fn(),
  getPayoutsByEventId: vi.fn(),
  getSponsorShare: vi.fn(),
  EventsUnavailableError: class EventsUnavailableError extends Error {},
}));

vi.mock("../services/notificationService", () => ({
  sendTicketPurchaseConfirmation: vi.fn(),
}));

import { getAllEvents, EventsUnavailableError } from "../services/eventsService";
import eventsRouter from "./events";

const mockGetAllEvents = vi.mocked(getAllEvents);

function buildApp() {
  const app = express();
  app.use("/api/events", eventsRouter);
  return app;
}

describe("GET /api/events", () => {
  beforeEach(() => {
    mockGetAllEvents.mockReset();
  });

  it("returns a fixed 503 message without the underlying RPC error", async () => {
    // EventsUnavailableError's own message embeds the cause, e.g. raw
    // Soroban diagnostics or the RPC host it couldn't reach.
    mockGetAllEvents.mockRejectedValue(
      new EventsUnavailableError(
        "failed to fetch events: Contract call failed: HostError: Error(WasmVm, InvalidAction)"
      )
    );

    const res = await request(buildApp()).get("/api/events");

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "Events index is currently unavailable" });
  });

  it("still lists every event when one has a date past what JavaScript can represent", async () => {
    // create_event accepts any future u64 date_unix; past ~year 275760,
    // new Date(...).toISOString() throws. One such event must not take
    // down the whole list for everyone.
    const event = (id: number, date_unix: bigint) => ({
      id,
      name: `Event ${id}`,
      venue: "Hall",
      date_unix,
      funding_goal: 100n,
      balance: 0n,
      organizer: "GORG",
      tiers: [],
    });
    mockGetAllEvents.mockResolvedValue([
      event(0, 1_800_000_000n),
      event(1, 18_446_744_073_709_551_615n), // u64::MAX
    ]);

    const res = await request(buildApp()).get("/api/events");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].date).toBe("2027-01-15T08:00:00.000Z");
    expect(res.body[1].date).toBeUndefined();
  });
});
