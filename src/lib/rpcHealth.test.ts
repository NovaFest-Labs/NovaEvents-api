import { describe, it, expect, vi } from "vitest";
import { checkRpcHealth } from "./rpcHealth";

function fakeServer(getHealth: () => Promise<unknown>) {
  return { getHealth } as unknown as Parameters<typeof checkRpcHealth>[0];
}

describe("checkRpcHealth", () => {
  it("returns true when the RPC responds within the timeout", async () => {
    const server = fakeServer(() => Promise.resolve({ status: "healthy" }));

    await expect(checkRpcHealth(server, 1000)).resolves.toBe(true);
  });

  it("returns false when the RPC call rejects", async () => {
    const server = fakeServer(() => Promise.reject(new Error("connection refused")));

    await expect(checkRpcHealth(server, 1000)).resolves.toBe(false);
  });

  it("returns false when the RPC call does not settle before the timeout", async () => {
    vi.useFakeTimers();
    const server = fakeServer(() => new Promise(() => {}));

    const resultPromise = checkRpcHealth(server, 50);
    await vi.advanceTimersByTimeAsync(50);

    await expect(resultPromise).resolves.toBe(false);
    vi.useRealTimers();
  });
});
