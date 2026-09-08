/**
 * Tests that /health is exempt from the global rate limiter.
 *
 * Rather than importing src/index.ts (which calls process.exit when env vars
 * are absent), we spin up a minimal Express app that mirrors the exact
 * middleware ordering used in production:
 *
 *   app.get("/health", ...)        ← registered BEFORE globalLimiter
 *   app.use(globalLimiter)
 *   app.get("/api/other", ...)     ← subject to the limiter
 *
 * This lets us verify that /health always returns 200 even after the limit
 * has been exhausted, without touching process.env or the real DB/RPC.
 */
import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { globalLimiter } from "../middleware/rateLimiter";

function buildApp() {
  const app = express();

  // /health comes BEFORE the global limiter — mirrors src/index.ts
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(globalLimiter);

  // A regular API route subject to the limiter
  app.get("/api/other", (_req, res) => {
    res.json({ data: "some data" });
  });

  return app;
}

describe("GET /health — rate-limit exemption", () => {
  it("responds 200 after exceeding the global rate limit", async () => {
    const app = buildApp();

    // Exhaust the limit (100 req / 15 min) on the regular route
    const limitRequests = Array.from({ length: 101 }, () =>
      request(app).get("/api/other")
    );
    const limitResults = await Promise.all(limitRequests);

    // At least one request should have been throttled, confirming the limiter works
    expect(limitResults.some((r) => r.status === 429)).toBe(true);

    // /health must still respond 200 — it is not behind the limiter
    const healthRes = await request(app).get("/health");
    expect(healthRes.status).toBe(200);
    expect(healthRes.body).toMatchObject({ status: "ok" });
  });
});
