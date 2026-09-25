import { describe, it, expect, vi, beforeEach } from "vitest";
import { Response } from "express";

vi.mock("../lib/logger", () => ({ logger: { error: vi.fn() } }));
// eventsService.ts (for EventNotFoundError/TicketNotFoundError) transitively
// imports lib/stellar, which constructs a real Soroban RPC client at module
// load time — mock it the same way every other test touching that chain does.
vi.mock("../lib/stellar", () => ({ simulateContractCall: vi.fn() }));

import { logger } from "../lib/logger";
import { EventNotFoundError, TicketNotFoundError } from "../services/eventsService";
import { errorHandler } from "./errorHandler";

const mockLoggerError = vi.mocked(logger.error);

function fakeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe("errorHandler", () => {
  beforeEach(() => {
    mockLoggerError.mockReset();
  });

  it("maps a generic Error to 500 with its message", () => {
    const res = fakeRes();
    errorHandler(new Error("boom"), {} as never, res, vi.fn());

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "boom" });
  });

  it("respects a custom status property on the error, e.g. an auth error", () => {
    const err = Object.assign(new Error("forbidden"), { status: 403 });
    const res = fakeRes();
    errorHandler(err, {} as never, res, vi.fn());

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "forbidden" });
  });

  it("maps EventNotFoundError to 404", () => {
    const res = fakeRes();
    errorHandler(new EventNotFoundError(1), {} as never, res, vi.fn());

    expect(res.statusCode).toBe(404);
  });

  it("maps TicketNotFoundError to 404", () => {
    const res = fakeRes();
    errorHandler(new TicketNotFoundError(1, 5), {} as never, res, vi.fn());

    expect(res.statusCode).toBe(404);
  });

  it("logs every error via the shared logger", () => {
    const res = fakeRes();
    errorHandler(new Error("boom"), {} as never, res, vi.fn());

    expect(mockLoggerError).toHaveBeenCalledOnce();
  });
});
