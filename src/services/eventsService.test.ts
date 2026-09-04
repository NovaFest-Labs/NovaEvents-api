import { describe, it, expect, vi, beforeEach } from "vitest";
import { simulateContractCall } from "../lib/stellar";
import {
  getEventById,
  getTiersByEventId,
  getTicketById,
  getSponsorshipsByEventId,
  getPayoutsByEventId,
  getSponsorShare,
  getAllEvents,
  EventNotFoundError,
  TicketNotFoundError,
  EventsUnavailableError,
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

  it("throws EventNotFoundError when the contract reports the event does not exist", async () => {
    vi.mocked(simulateContractCall).mockRejectedValue(new Error("event not found"));

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

describe("getSponsorshipsByEventId", () => {
  beforeEach(() => {
    vi.mocked(simulateContractCall).mockReset();
  });

  function mockContract(sponsorships: unknown[]) {
    vi.mocked(simulateContractCall).mockImplementation(async (funcName: string) => {
      if (funcName === "get_event") return { organizer: "GABC" };
      if (funcName === "get_sponsorships") return sponsorships;
      throw new Error(`unexpected contract call: ${funcName}`);
    });
  }

  it("returns sponsorships sorted by amount descending", async () => {
    mockContract([
      { sponsor: "GA", amount: 100n },
      { sponsor: "GB", amount: 500n },
      { sponsor: "GC", amount: 300n },
    ]);

    const result = await getSponsorshipsByEventId(0);

    expect(result).toEqual([
      { sponsor: "GB", amount: 500n },
      { sponsor: "GC", amount: 300n },
      { sponsor: "GA", amount: 100n },
    ]);
  });

  it("returns an empty array (not an error) when the event has no sponsors", async () => {
    mockContract([]);

    await expect(getSponsorshipsByEventId(0)).resolves.toEqual([]);
  });

  it("throws EventNotFoundError when the event does not exist", async () => {
    vi.mocked(simulateContractCall).mockImplementation(async (funcName: string) => {
      if (funcName === "get_event") throw new Error("event not found");
      throw new Error(`unexpected contract call: ${funcName}`);
    });

    await expect(getSponsorshipsByEventId(999)).rejects.toBeInstanceOf(EventNotFoundError);
  });

  it("rethrows unrelated errors instead of swallowing them", async () => {
    const rpcFailure = new Error("RPC request timed out");
    vi.mocked(simulateContractCall).mockImplementation(async (funcName: string) => {
      if (funcName === "get_event") return { organizer: "GABC" };
      throw rpcFailure;
    });

    await expect(getSponsorshipsByEventId(0)).rejects.toBe(rpcFailure);
  });
});

describe("getAllEvents", () => {
  beforeEach(() => {
    vi.mocked(simulateContractCall).mockReset();
  });

  it("returns each event merged with its id and tiers", async () => {
    vi.mocked(simulateContractCall).mockImplementation(async (funcName: string, ...args) => {
      if (funcName === "event_count") return 2;
      if (funcName === "get_event") return { name: `Event ${args[0]}` };
      if (funcName === "get_tiers") return [{ name: "General" }];
      throw new Error(`unexpected contract call: ${funcName}`);
    });

    const result = await getAllEvents();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 0, tiers: [{ name: "General" }] });
    expect(result[1]).toMatchObject({ id: 1, tiers: [{ name: "General" }] });
  });

  it("returns an empty array when there are no events", async () => {
    vi.mocked(simulateContractCall).mockImplementation(async (funcName: string) => {
      if (funcName === "event_count") return 0;
      throw new Error(`unexpected contract call: ${funcName}`);
    });

    await expect(getAllEvents()).resolves.toEqual([]);
  });

  it("throws EventsUnavailableError when the contract call fails", async () => {
    vi.mocked(simulateContractCall).mockRejectedValue(new Error("RPC request timed out"));

    await expect(getAllEvents()).rejects.toBeInstanceOf(EventsUnavailableError);
  });
});

describe("getPayoutsByEventId", () => {
  beforeEach(() => {
    vi.mocked(simulateContractCall).mockReset();
  });

  function mockContract(payouts: unknown[]) {
    vi.mocked(simulateContractCall).mockImplementation(async (funcName: string) => {
      if (funcName === "get_event") return { organizer: "GABC" };
      if (funcName === "get_payouts") return payouts;
      throw new Error(`unexpected contract call: ${funcName}`);
    });
  }

  it("returns the payouts for an event", async () => {
    const fakePayouts = [{ recipient: "GA", amount: 500n }];
    mockContract(fakePayouts);

    await expect(getPayoutsByEventId(0)).resolves.toBe(fakePayouts);
  });

  it("returns an empty array (not an error) when the event has no payouts", async () => {
    mockContract([]);

    await expect(getPayoutsByEventId(0)).resolves.toEqual([]);
  });

  it("throws EventNotFoundError when the event does not exist", async () => {
    vi.mocked(simulateContractCall).mockImplementation(async (funcName: string) => {
      if (funcName === "get_event") throw new Error("event not found");
      throw new Error(`unexpected contract call: ${funcName}`);
    });

    await expect(getPayoutsByEventId(999)).rejects.toBeInstanceOf(EventNotFoundError);
  });

  it("rethrows unrelated errors instead of swallowing them", async () => {
    const rpcFailure = new Error("RPC request timed out");
    vi.mocked(simulateContractCall).mockImplementation(async (funcName: string) => {
      if (funcName === "get_event") return { organizer: "GABC" };
      throw rpcFailure;
    });

    await expect(getPayoutsByEventId(0)).rejects.toBe(rpcFailure);
  });
});

describe("getSponsorShare", () => {
  const SPONSOR = "GCVCPLU7JBIOIDZARACNU27LETDUJF4V4HN3KCFYE7T6KHD7SKF7IT5B";

  beforeEach(() => {
    vi.mocked(simulateContractCall).mockReset();
  });

  it("returns the sponsor's share in basis points", async () => {
    vi.mocked(simulateContractCall).mockImplementation(async (funcName: string) => {
      if (funcName === "get_event") return { organizer: "GABC" };
      if (funcName === "get_sponsor_share") return 3000;
      throw new Error(`unexpected contract call: ${funcName}`);
    });

    await expect(getSponsorShare(0, SPONSOR)).resolves.toBe(3000);
  });

  it("throws EventNotFoundError when the event does not exist", async () => {
    vi.mocked(simulateContractCall).mockImplementation(async (funcName: string) => {
      if (funcName === "get_event") throw new Error("event not found");
      throw new Error(`unexpected contract call: ${funcName}`);
    });

    await expect(getSponsorShare(999, SPONSOR)).rejects.toBeInstanceOf(EventNotFoundError);
  });

  it("rethrows unrelated errors instead of swallowing them", async () => {
    const rpcFailure = new Error("RPC request timed out");
    vi.mocked(simulateContractCall).mockImplementation(async (funcName: string) => {
      if (funcName === "get_event") return { organizer: "GABC" };
      throw rpcFailure;
    });

    await expect(getSponsorShare(0, SPONSOR)).rejects.toBe(rpcFailure);
  });
});
