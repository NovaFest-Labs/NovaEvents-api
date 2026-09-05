import { describe, it, expect, vi, beforeEach } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { Request, Response } from "express";

vi.mock("../services/eventsService", () => ({
  getEventOrganizerById: vi.fn(),
}));

import { getEventOrganizerById } from "../services/eventsService";
import { verifyOrganizer, buildUploadChallengeMessage } from "./verifyOrganizer";

const mockGetEventOrganizerById = vi.mocked(getEventOrganizerById);

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
  address?: string;
  signature?: string;
  timestamp?: string;
}): Request {
  const headers: Record<string, string> = {};
  if (overrides.address) headers["x-organizer-address"] = overrides.address;
  if (overrides.signature) headers["x-organizer-signature"] = overrides.signature;
  if (overrides.timestamp) headers["x-organizer-timestamp"] = overrides.timestamp;

  return {
    params: { id: overrides.eventId ?? "1" },
    header(name: string) {
      return headers[name.toLowerCase()];
    },
  } as unknown as Request;
}

describe("verifyOrganizer", () => {
  beforeEach(() => {
    mockGetEventOrganizerById.mockReset();
  });

  it("calls next() when the signature is valid and matches the on-chain organizer", async () => {
    const keypair = Keypair.random();
    const eventId = 1;
    const timestamp = Date.now();
    const message = buildUploadChallengeMessage(eventId, timestamp);
    const signature = keypair.sign(Buffer.from(message)).toString("base64");

    mockGetEventOrganizerById.mockResolvedValue({
      event_id: eventId,
      organizer: keypair.publicKey(),
    });

    const req = fakeReq({
      eventId: String(eventId),
      address: keypair.publicKey(),
      signature,
      timestamp: String(timestamp),
    });
    const res = fakeRes();
    const next = vi.fn();

    await verifyOrganizer(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(0);
  });

  it("rejects with 403 when the signer is not the event's organizer", async () => {
    const signer = Keypair.random();
    const actualOrganizer = Keypair.random();
    const eventId = 1;
    const timestamp = Date.now();
    const message = buildUploadChallengeMessage(eventId, timestamp);
    const signature = signer.sign(Buffer.from(message)).toString("base64");

    mockGetEventOrganizerById.mockResolvedValue({
      event_id: eventId,
      organizer: actualOrganizer.publicKey(),
    });

    const req = fakeReq({
      eventId: String(eventId),
      address: signer.publicKey(),
      signature,
      timestamp: String(timestamp),
    });
    const res = fakeRes();
    const next = vi.fn();

    await verifyOrganizer(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("rejects with 401 when required headers are missing", async () => {
    const req = fakeReq({ eventId: "1" });
    const res = fakeRes();
    const next = vi.fn();

    await verifyOrganizer(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(mockGetEventOrganizerById).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the signature timestamp has expired", async () => {
    const keypair = Keypair.random();
    const eventId = 1;
    const timestamp = Date.now() - 10 * 60 * 1000; // 10 minutes old
    const message = buildUploadChallengeMessage(eventId, timestamp);
    const signature = keypair.sign(Buffer.from(message)).toString("base64");

    mockGetEventOrganizerById.mockResolvedValue({
      event_id: eventId,
      organizer: keypair.publicKey(),
    });

    const req = fakeReq({
      eventId: String(eventId),
      address: keypair.publicKey(),
      signature,
      timestamp: String(timestamp),
    });
    const res = fakeRes();
    const next = vi.fn();

    await verifyOrganizer(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("rejects with 403 when the signature does not match the message", async () => {
    const keypair = Keypair.random();
    const eventId = 1;
    const timestamp = Date.now();
    const wrongMessage = buildUploadChallengeMessage(999, timestamp);
    const signature = keypair.sign(Buffer.from(wrongMessage)).toString("base64");

    mockGetEventOrganizerById.mockResolvedValue({
      event_id: eventId,
      organizer: keypair.publicKey(),
    });

    const req = fakeReq({
      eventId: String(eventId),
      address: keypair.publicKey(),
      signature,
      timestamp: String(timestamp),
    });
    const res = fakeRes();
    const next = vi.fn();

    await verifyOrganizer(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});
