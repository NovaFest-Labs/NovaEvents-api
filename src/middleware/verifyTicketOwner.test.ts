import { describe, it, expect, vi, beforeEach } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { Request, Response } from "express";

vi.mock("../services/eventsService", () => ({
  getTicketById: vi.fn(),
}));

import { getTicketById } from "../services/eventsService";
import { verifyTicketOwner, buildNotifyChallengeMessage } from "./verifyTicketOwner";

const mockGetTicketById = vi.mocked(getTicketById);

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

function fakeReq(overrides: {
  eventId?: string;
  ticketId?: string;
  address?: string;
  signature?: string;
  timestamp?: string;
}): Request {
  const headers: Record<string, string> = {};
  if (overrides.address) headers["x-owner-address"] = overrides.address;
  if (overrides.signature) headers["x-owner-signature"] = overrides.signature;
  if (overrides.timestamp) headers["x-owner-timestamp"] = overrides.timestamp;

  return {
    params: { id: overrides.eventId ?? "1", ticketId: overrides.ticketId ?? "5" },
    header(name: string) {
      return headers[name.toLowerCase()];
    },
  } as unknown as Request;
}

describe("verifyTicketOwner", () => {
  beforeEach(() => {
    mockGetTicketById.mockReset();
  });

  it("calls next() when the signature is valid and matches the ticket's on-chain owner", async () => {
    const keypair = Keypair.random();
    const eventId = 1;
    const ticketId = 5;
    const timestamp = Date.now();
    const message = buildNotifyChallengeMessage(eventId, ticketId, timestamp);
    const signature = keypair.sign(Buffer.from(message)).toString("base64");

    mockGetTicketById.mockResolvedValue({
      event_id: eventId,
      tier_index: 0,
      owner: keypair.publicKey(),
      redeemed: false,
    });

    const req = fakeReq({
      eventId: String(eventId),
      ticketId: String(ticketId),
      address: keypair.publicKey(),
      signature,
      timestamp: String(timestamp),
    });
    const res = fakeRes();
    const next = vi.fn();

    await verifyTicketOwner(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(0);
  });

  it("rejects with 403 when the signer is not the ticket's owner", async () => {
    const signer = Keypair.random();
    const actualOwner = Keypair.random();
    const eventId = 1;
    const ticketId = 5;
    const timestamp = Date.now();
    const message = buildNotifyChallengeMessage(eventId, ticketId, timestamp);
    const signature = signer.sign(Buffer.from(message)).toString("base64");

    mockGetTicketById.mockResolvedValue({
      event_id: eventId,
      tier_index: 0,
      owner: actualOwner.publicKey(),
      redeemed: false,
    });

    const req = fakeReq({
      eventId: String(eventId),
      ticketId: String(ticketId),
      address: signer.publicKey(),
      signature,
      timestamp: String(timestamp),
    });
    const res = fakeRes();
    const next = vi.fn();

    await verifyTicketOwner(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("rejects with 401 when required headers are missing", async () => {
    const req = fakeReq({ eventId: "1", ticketId: "5" });
    const res = fakeRes();
    const next = vi.fn();

    await verifyTicketOwner(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(mockGetTicketById).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the signature timestamp has expired", async () => {
    const keypair = Keypair.random();
    const eventId = 1;
    const ticketId = 5;
    const timestamp = Date.now() - 10 * 60 * 1000; // 10 minutes old
    const message = buildNotifyChallengeMessage(eventId, ticketId, timestamp);
    const signature = keypair.sign(Buffer.from(message)).toString("base64");

    mockGetTicketById.mockResolvedValue({
      event_id: eventId,
      tier_index: 0,
      owner: keypair.publicKey(),
      redeemed: false,
    });

    const req = fakeReq({
      eventId: String(eventId),
      ticketId: String(ticketId),
      address: keypair.publicKey(),
      signature,
      timestamp: String(timestamp),
    });
    const res = fakeRes();
    const next = vi.fn();

    await verifyTicketOwner(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("rejects with 403 when the signature does not match the message", async () => {
    const keypair = Keypair.random();
    const eventId = 1;
    const ticketId = 5;
    const timestamp = Date.now();
    const wrongMessage = buildNotifyChallengeMessage(eventId, 999, timestamp);
    const signature = keypair.sign(Buffer.from(wrongMessage)).toString("base64");

    mockGetTicketById.mockResolvedValue({
      event_id: eventId,
      tier_index: 0,
      owner: keypair.publicKey(),
      redeemed: false,
    });

    const req = fakeReq({
      eventId: String(eventId),
      ticketId: String(ticketId),
      address: keypair.publicKey(),
      signature,
      timestamp: String(timestamp),
    });
    const res = fakeRes();
    const next = vi.fn();

    await verifyTicketOwner(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("defers to downstream validation for a non-numeric ticket id instead of looking it up", async () => {
    const req = fakeReq({ eventId: "1", ticketId: "abc" });
    const res = fakeRes();
    const next = vi.fn();

    await verifyTicketOwner(req, res, next);

    expect(mockGetTicketById).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });
});
