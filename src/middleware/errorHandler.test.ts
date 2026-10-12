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

  it("hides an unexpected error's message behind a generic 500", () => {
    // Unexpected errors carry internals: raw Soroban simulation diagnostics
    // ("Contract call failed: ..."), AWS SDK errors naming the S3 bucket and
    // endpoint, Stellar SDK XDR errors. None of that is for the client.
    const res = fakeRes();
    errorHandler(
      new Error("Contract call failed: HostError: Error(WasmVm, InvalidAction)"),
      {} as never,
      res,
      vi.fn()
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });

  it("hides the message of an error that carries a 5xx status of its own", () => {
    const err = Object.assign(new Error("upstream S3 bucket nova-prod-images unreachable"), {
      status: 502,
    });
    const res = fakeRes();
    errorHandler(err, {} as never, res, vi.fn());

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ error: "Internal server error" });
  });

  it("still logs the original message of a hidden 500", () => {
    errorHandler(new Error("boom"), {} as never, fakeRes(), vi.fn());

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.objectContaining({ message: "boom" }) }),
      expect.any(String)
    );
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
