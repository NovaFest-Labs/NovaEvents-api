import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../lib/stellar", () => ({ simulateContractCall: vi.fn() }));
vi.mock("../lib/db", () => ({ getDb: vi.fn() }));
vi.mock("../lib/logger", () => ({ logger: { error: vi.fn(), info: vi.fn() } }));

import { simulateContractCall } from "../lib/stellar";
import { getDb } from "../lib/db";
import { logger } from "../lib/logger";
import { runIndexOnce, startIndexer, stopIndexer } from "./indexer";

const mockSimulateContractCall = vi.mocked(simulateContractCall);
const mockGetDb = vi.mocked(getDb);
const mockLoggerError = vi.mocked(logger.error);
const mockLoggerInfo = vi.mocked(logger.info);

function fakeStmt() {
  return { run: vi.fn() };
}

describe("runIndexOnce", () => {
  beforeEach(() => {
    mockSimulateContractCall.mockReset();
    mockGetDb.mockReset();
    mockLoggerError.mockReset();
    mockLoggerInfo.mockReset();
  });

  it("prepares the insert statement only once, even when indexing multiple events", async () => {
    const prepare = vi.fn().mockReturnValue(fakeStmt());
    mockGetDb.mockReturnValue({ prepare } as never);

    mockSimulateContractCall.mockImplementation(async (fn: string) => {
      if (fn === "event_count") return 3;
      if (fn === "get_event") return { name: "Event" };
      if (fn === "get_tiers") return [];
      throw new Error(`unexpected call: ${fn}`);
    });

    await runIndexOnce();

    expect(prepare).toHaveBeenCalledOnce();
  });

  it("runs the prepared statement once per event", async () => {
    const stmt = fakeStmt();
    mockGetDb.mockReturnValue({ prepare: vi.fn().mockReturnValue(stmt) } as never);

    mockSimulateContractCall.mockImplementation(async (fn: string) => {
      if (fn === "event_count") return 2;
      if (fn === "get_event") return { name: "Event" };
      if (fn === "get_tiers") return [];
      throw new Error(`unexpected call: ${fn}`);
    });

    await runIndexOnce();

    expect(stmt.run).toHaveBeenCalledTimes(2);
  });

  it("never touches the database when there are no events to index", async () => {
    mockSimulateContractCall.mockImplementation(async (fn: string) => {
      if (fn === "event_count") return 0;
      throw new Error(`unexpected call: ${fn}`);
    });

    await runIndexOnce();

    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it("skips a failing event but still indexes the rest", async () => {
    const stmt = fakeStmt();
    mockGetDb.mockReturnValue({ prepare: vi.fn().mockReturnValue(stmt) } as never);

    let getEventCalls = 0;
    mockSimulateContractCall.mockImplementation(async (fn: string) => {
      if (fn === "event_count") return 2;
      if (fn === "get_event") {
        getEventCalls += 1;
        if (getEventCalls === 1) throw new Error("rpc blip on event 0");
        return { name: "Event" };
      }
      if (fn === "get_tiers") return [];
      throw new Error(`unexpected call: ${fn}`);
    });

    await expect(runIndexOnce()).resolves.not.toThrow();
    expect(stmt.run).toHaveBeenCalledTimes(1);
    expect(mockLoggerError).toHaveBeenCalledOnce();
  });

  it("rethrows when the outer event_count call fails", async () => {
    mockSimulateContractCall.mockRejectedValue(new Error("rpc down"));

    await expect(runIndexOnce()).rejects.toThrow("rpc down");
    expect(mockGetDb).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledOnce();
  });
});

describe("startIndexer", () => {
  beforeEach(() => {
    mockLoggerInfo.mockReset();
    stopIndexer();
  });

  afterEach(() => {
    stopIndexer();
    delete process.env.INDEXER_DISABLED;
  });

  it("logs via the shared logger instead of console when disabled", () => {
    process.env.INDEXER_DISABLED = "1";

    startIndexer();

    expect(mockLoggerInfo).toHaveBeenCalledOnce();
  });
});
