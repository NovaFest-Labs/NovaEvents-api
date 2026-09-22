/**
 * Tests the notify-route-specific limiter in isolation, mirroring the
 * approach in src/routes/health.test.ts: a minimal Express app rather than
 * importing src/index.ts, which calls process.exit when env vars are absent.
 */
import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { notifyLimiter } from "./rateLimiter";

function buildApp() {
  const app = express();

  app.post("/notify", notifyLimiter, (_req, res) => {
    res.status(202).json({ delivered: true });
  });

  // A separate route with no limiter, to confirm notifyLimiter is scoped to
  // its own route and doesn't throttle unrelated endpoints.
  app.get("/other", (_req, res) => {
    res.json({ data: "some data" });
  });

  return app;
}

describe("notifyLimiter", () => {
  it("throttles repeated requests to the notify route", async () => {
    const app = buildApp();

    const requests = Array.from({ length: 11 }, () => request(app).post("/notify"));
    const results = await Promise.all(requests);

    expect(results.some((r) => r.status === 429)).toBe(true);
  });

  it("does not throttle a different route", async () => {
    const app = buildApp();

    const requests = Array.from({ length: 11 }, () => request(app).post("/notify"));
    await Promise.all(requests);

    const otherRes = await request(app).get("/other");
    expect(otherRes.status).toBe(200);
  });
});
