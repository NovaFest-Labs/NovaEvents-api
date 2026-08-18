import { describe, it, expect, vi, beforeEach } from "vitest";
import { simulateContractCall } from "../lib/stellar";
import {
  getEventById,
  getTiersByEventId,
  getTicketById,
  EventNotFoundError,
  TicketNotFoundError,
} from "./eventsService";

vi.mock("../lib/stellar", () => ({
  simulateContractCall: vi.fn(),
}));

describe("getEventById", () => {
  beforeEach(() => {
    vi.mocked(simulateContractCall).mockReset();
  });

  it("returns the event when the contract call succeeds", async () => {
    const fakeEvent = { organizer: "GABC", name: "Stellar Summit" };
    vi.mocked(simulateContractCall).mockResolvedValue(fakeEvent);

    const result = await getEventById(0);

    expect(result).toBe(fakeEvent);
    expect(simulateContractCall).toHaveBeenCalledWith("get_event", expect.anything());
  });

  it("throws EventNotFoundError when the contract reports the event does not exist", async () => {
    vi.mocked(simulateContractCall).mockRejectedValue(new Error("event not found"));

    await expect(getEventById(999)).rejects.toBeInstanceOf(EventNotFoundError);
  });

  it("rethrows unrelated errors instead of swallowing them", async () => {
    const rpcFailure = new Error("RPC request timed out");
    vi.mocked(simulateContractCall).mockRejectedValue(rpcFailure);

    await expect(getEventById(0)).rejects.toBe(rpcFailure);
  });
});

describe("getTiersByEventId", () => {
  beforeEach(() => {
    vi.mocked(simulateContractCall).mockReset();
  });

  it("returns the tiers when the contract call succeeds", async () => {
    const fakeTiers = [{ name: "General", price: 10_000_000n }];
    vi.mocked(simulateContractCall).mockResolvedValue(fakeTiers);

    const result = await getTiersByEventId(0);

    expect(result).toBe(fakeTiers);
    expect(simulateContractCall).toHaveBeenCalledWith("get_tiers", expect.anything());
  });

  it("throws EventNotFoundError when the contract reports the tiers do not exist", async () => {
    vi.mocked(simulateContractCall).mockRejectedValue(new Error("tiers not found"));

    await expect(getTiersByEventId(999)).rejects.toBeInstanceOf(EventNotFoundError);
  });

  it("rethrows unrelated errors instead of swallowing them", async () => {
    const rpcFailure = new Error("RPC request timed out");
    vi.mocked(simulateContractCall).mockRejectedValue(rpcFailure);

    await expect(getTiersByEventId(0)).rejects.toBe(rpcFailure);
  });
});

describe("getTicketById", () => {
  beforeEach(() => {
    vi.mocked(simulateContractCall).mockReset();
  });

  it("returns the ticket when the contract call succeeds", async () => {
    const fakeTicket = { owner: "GABC", redeemed: false };
    vi.mocked(simulateContractCall).mockResolvedValue(fakeTicket);

    const result = await getTicketById(0, 3);

    expect(result).toBe(fakeTicket);
    expect(simulateContractCall).toHaveBeenCalledWith(
      "get_ticket",
      expect.anything(),
      expect.anything()
    );
  });

  it("throws TicketNotFoundError when the contract reports the ticket does not exist", async () => {
    vi.mocked(simulateContractCall).mockRejectedValue(new Error("ticket not found"));

    await expect(getTicketById(0, 999)).rejects.toBeInstanceOf(TicketNotFoundError);
  });

  it("preserves the requested event and ticket ids on TicketNotFoundError", async () => {
    vi.mocked(simulateContractCall).mockRejectedValue(new Error("ticket not found"));

    await expect(getTicketById(5, 42)).rejects.toMatchObject({ eventId: 5, ticketId: 42 });
  });

  it("rethrows unrelated errors instead of swallowing them", async () => {
    const rpcFailure = new Error("RPC request timed out");
    vi.mocked(simulateContractCall).mockRejectedValue(rpcFailure);

    await expect(getTicketById(0, 0)).rejects.toBe(rpcFailure);
  });
});
