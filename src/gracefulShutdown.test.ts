import { describe, it, expect, afterEach } from "vitest";
import http from "http";
import { AddressInfo } from "net";
import express from "express";
import { setupGracefulShutdown } from "./gracefulShutdown";

const PROCESS_EVENTS = ["SIGTERM", "SIGINT", "uncaughtException", "unhandledRejection"] as const;

function get(port: number, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port, path, agent: false }, (res) => {
        res.resume();
        res.on("end", resolve);
      })
      .on("error", reject);
  });
}

describe("setupGracefulShutdown", () => {
  let server: http.Server | null = null;
  const listenersBefore = new Map<string, Function[]>();

  afterEach(async () => {
    // setupGracefulShutdown registers process-level handlers; remove only the
    // ones it added so they can't call process.exit during later tests.
    for (const event of PROCESS_EVENTS) {
      const before = listenersBefore.get(event) ?? [];
      for (const listener of process.listeners(event)) {
        if (!before.includes(listener)) process.removeListener(event, listener as never);
      }
    }
    if (server) await new Promise((r) => server!.close(r));
    server = null;
  });

  it("still counts a request in flight after a concurrent request completes", async () => {
    for (const event of PROCESS_EVENTS) listenersBefore.set(event, [...process.listeners(event)]);

    const app = express();
    server = http.createServer(app);
    const tracker = setupGracefulShutdown({ server, app });

    let releaseSlow!: () => void;
    const slowGate = new Promise<void>((r) => (releaseSlow = r));
    let slowStarted!: () => void;
    const slowHasStarted = new Promise<void>((r) => (slowStarted = r));

    app.get("/slow", async (_req, res) => {
      slowStarted();
      await slowGate;
      res.send("slow");
    });
    app.get("/fast", (_req, res) => {
      res.send("fast");
    });

    await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
    const { port } = server.address() as AddressInfo;

    const slow = get(port, "/slow");
    await slowHasStarted;
    await get(port, "/fast");

    let inFlightAfterFast: number;
    try {
      inFlightAfterFast = tracker.getActiveRequests();
    } finally {
      releaseSlow();
      await slow;
    }

    // Node emits both "finish" and "close" for a completed response. Counting
    // each as a decrement would drop this to 0, letting shutdown exit while
    // /slow is still in flight.
    expect(inFlightAfterFast).toBe(1);
    expect(tracker.getActiveRequests()).toBe(0);
  });

  it("still tracks requests when routes are registered before setupGracefulShutdown is called", async () => {
    // index.ts registers every route and the error handler, THEN creates the
    // server and calls setupGracefulShutdown. If tracking relied on
    // app.use() middleware, it would land after those routes in the stack
    // and never run, since a matched route sends its response and never
    // calls next().
    for (const event of PROCESS_EVENTS) listenersBefore.set(event, [...process.listeners(event)]);

    const app = express();

    let releaseSlow!: () => void;
    const slowGate = new Promise<void>((r) => (releaseSlow = r));
    let slowStarted!: () => void;
    const slowHasStarted = new Promise<void>((r) => (slowStarted = r));

    app.get("/slow", async (_req, res) => {
      slowStarted();
      await slowGate;
      res.send("slow");
    });

    server = http.createServer(app);
    const tracker = setupGracefulShutdown({ server, app });

    await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
    const { port } = server.address() as AddressInfo;

    const slow = get(port, "/slow");
    await slowHasStarted;

    let inFlightDuringSlow: number;
    try {
      inFlightDuringSlow = tracker.getActiveRequests();
    } finally {
      releaseSlow();
      await slow;
    }

    expect(inFlightDuringSlow).toBe(1);
    expect(tracker.getActiveRequests()).toBe(0);
  });
});
