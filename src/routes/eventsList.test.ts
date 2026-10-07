/**
 * Tests organizer query validation on GET /api/events.
 * The service layer is stubbed so the tests stay hermetic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../services/eventsService", () => ({
  getAllEvents: vi.fn(),
  getEventById: vi.fn(),
  getEventOrganizerById: vi.fn(),
  getEventStatusById: vi.fn(),
  getTiersByEventId: vi.fn(),
  getTicketCountByEventId: vi.fn(),
  getSponsorshipsByEventId: vi.fn(),
  getPayoutsByEventId: vi.fn(),
  getSponsorShare: vi.fn(),
  getTicketById: vi.fn(),
  EventsUnavailableError: class EventsUnavailableError extends Error {},
}));

vi.mock("../services/notificationService", () => ({
  sendTicketPurchaseConfirmation: vi.fn(),
}));

import eventsRouter from "./events";
import { getAllEvents } from "../services/eventsService";

const VALID_ADDRESS = "GCVCPLU7JBIOIDZARACNU27LETDUJF4V4HN3KCFYE7T6KHD7SKF7IT5B";

function buildApp() {
  const app = express();
  app.use("/api/events", eventsRouter);
  return app;
}

describe("GET /api/events?organizer=", () => {
  beforeEach(() => {
    vi.mocked(getAllEvents).mockReset().mockResolvedValue([]);
  });

  it("returns 200 and [] for a valid organizer with no events", async () => {
    const res = await request(buildApp()).get(`/api/events?organizer=${VALID_ADDRESS}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 400 for a malformed organizer address", async () => {
    const res = await request(buildApp()).get("/api/events?organizer=GCVCPLU7");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid organizer/i);
    expect(getAllEvents).not.toHaveBeenCalled();
  });

  it("returns 400 for an EVM-style address", async () => {
    const res = await request(buildApp()).get(
      "/api/events?organizer=0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
    );
    expect(res.status).toBe(400);
  });
});
