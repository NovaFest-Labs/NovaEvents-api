/**
 * Tests that ticket id validation in the events router rejects non-decimal
 * strings such as hex ("0x1") and exponential ("1e2") notation.
 *
 * We mount only the two affected route handlers on a minimal Express app so
 * the tests remain hermetic — no DB, RPC, or env-var setup required.
 */
import { describe, it, expect, vi } from "vitest";
import express, { Request, Response, NextFunction } from "express";
import request from "supertest";

// Stub validateEventId to always pass so we isolate ticket-id validation only
vi.mock("../middleware/validateEventId", () => ({
  validateEventId: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

// Stub the service layer — tests should never hit a real DB
vi.mock("../services/eventsService", () => ({
  getTicketById: vi.fn().mockResolvedValue({ ticket_id: 0 }),
  getAllEvents: vi.fn(),
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

// Stub notification service used by the notify route
vi.mock("../services/notificationService", () => ({
  sendTicketPurchaseConfirmation: vi.fn().mockResolvedValue({ sent: true }),
}));

import eventsRouter from "./events";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/events", eventsRouter);
  return app;
}

describe("GET /api/events/:id/tickets/:ticketId — ticket id validation", () => {
  const app = buildApp();

  it("accepts a plain decimal ticket id", async () => {
    const res = await request(app).get("/api/events/1/tickets/5");
    // 200 means validation passed (service stub returns a ticket object)
    expect(res.status).toBe(200);
  });

  it("rejects hex notation (0x1) with 400", async () => {
    const res = await request(app).get("/api/events/1/tickets/0x1");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ticket id/i);
  });

  it("rejects exponential notation (1e2) with 400", async () => {
    const res = await request(app).get("/api/events/1/tickets/1e2");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ticket id/i);
  });

  it("rejects a float (1.5) with 400", async () => {
    const res = await request(app).get("/api/events/1/tickets/1.5");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ticket id/i);
  });

  it("rejects a negative number (-1) with 400", async () => {
    const res = await request(app).get("/api/events/1/tickets/-1");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ticket id/i);
  });
});

describe("POST /api/events/:id/tickets/:ticketId/notify — ticket id validation", () => {
  const app = buildApp();

  it("accepts a plain decimal ticket id", async () => {
    const res = await request(app)
      .post("/api/events/1/tickets/5/notify")
      .send({ email: "user@example.com" });
    expect(res.status).toBe(202);
  });

  it("rejects hex notation (0x1) with 400", async () => {
    const res = await request(app)
      .post("/api/events/1/tickets/0x1/notify")
      .send({ email: "user@example.com" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ticket id/i);
  });

  it("rejects exponential notation (1e2) with 400", async () => {
    const res = await request(app)
      .post("/api/events/1/tickets/1e2/notify")
      .send({ email: "user@example.com" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ticket id/i);
  });

  it("rejects a float (1.5) with 400", async () => {
    const res = await request(app)
      .post("/api/events/1/tickets/1.5/notify")
      .send({ email: "user@example.com" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ticket id/i);
  });

  it("rejects a negative number (-1) with 400", async () => {
    const res = await request(app)
      .post("/api/events/1/tickets/-1/notify")
      .send({ email: "user@example.com" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ticket id/i);
  });
});
