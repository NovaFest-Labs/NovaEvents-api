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

  it("returns 200 and the filtered list for a valid organizer address", async () => {
    mockGetAllEvents.mockResolvedValue([]);
    const res = await request(buildApp()).get(
      "/api/events?organizer=GCVCPLU7JBIOIDZARACNU27LETDUJF4V4HN3KCFYE7T6KHD7SKF7IT5B"
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 400 for a malformed organizer address instead of silently returning []", async () => {
    const res = await request(buildApp()).get("/api/events?organizer=GCVCPLU7");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid organizer address" });
    expect(mockGetAllEvents).not.toHaveBeenCalled();
  });

  it("returns 400 for an EVM-style address passed as organizer", async () => {
    const res = await request(buildApp()).get(
      "/api/events?organizer=0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
    );

    expect(res.status).toBe(400);
  });
});
