/**
 * Route-level tests for POST /api/events/:id/tickets/:ticketId/notify.
 *
 * Mounts the real eventsRouter (not a reimplementation) behind a minimal
 * Express app, mocking ../lib/stellar so importing the router doesn't
 * construct a real Soroban RPC client — the same reason every service-level
 * test in this codebase mocks that module.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../lib/stellar", () => ({ simulateContractCall: vi.fn() }));
vi.mock("../services/notificationService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/notificationService")>();
  return { ...actual, sendTicketPurchaseConfirmation: vi.fn() };
});
// Ticket-owner auth is covered by its own dedicated test file
// (verifyTicketOwner.test.ts) — bypass it here so these tests stay focused
// on the route's own validation and response behavior.
vi.mock("../middleware/verifyTicketOwner", () => ({
  verifyTicketOwner: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { sendTicketPurchaseConfirmation } from "../services/notificationService";
import { TicketNotFoundError } from "../services/eventsService";
import eventsRouter from "./events";
import { errorHandler } from "../middleware/errorHandler";

const mockSend = vi.mocked(sendTicketPurchaseConfirmation);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/events", eventsRouter);
  app.use(errorHandler);
  return app;
}

describe("POST /api/events/:id/tickets/:ticketId/notify", () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it("responds 202 and calls the service with the parsed ids and email", async () => {
    mockSend.mockResolvedValue({ delivered: true });

    const res = await request(buildApp())
      .post("/api/events/1/tickets/5/notify")
      .send({ email: "buyer@example.com" });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ delivered: true });
    expect(mockSend).toHaveBeenCalledWith(1, 5, "buyer@example.com");
  });

  it("rejects a non-numeric ticket id with 400 without calling the service", async () => {
    const res = await request(buildApp())
      .post("/api/events/1/tickets/abc/notify")
      .send({ email: "buyer@example.com" });

    expect(res.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("rejects a missing email with 400 without calling the service", async () => {
    const res = await request(buildApp()).post("/api/events/1/tickets/5/notify").send({});

    expect(res.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("rejects a malformed email with 400 without calling the service", async () => {
    const res = await request(buildApp())
      .post("/api/events/1/tickets/5/notify")
      .send({ email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("responds 404 when the ticket doesn't exist", async () => {
    mockSend.mockRejectedValue(new TicketNotFoundError(1, 999));

    const res = await request(buildApp())
      .post("/api/events/1/tickets/999/notify")
      .send({ email: "buyer@example.com" });

    expect(res.status).toBe(404);
  });
});
