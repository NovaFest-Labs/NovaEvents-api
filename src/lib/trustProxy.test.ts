import { describe, it, expect } from "vitest";
import { resolveTrustProxy } from "./trustProxy";

describe("resolveTrustProxy", () => {
  it("defaults to 1 (trust exactly one hop) when TRUST_PROXY is unset", () => {
    expect(resolveTrustProxy(undefined)).toBe(1);
  });

  it("defaults to 1 when TRUST_PROXY is set but empty", () => {
    expect(resolveTrustProxy("")).toBe(1);
  });

  it("parses a numeric string as a number of hops", () => {
    expect(resolveTrustProxy("2")).toBe(2);
    expect(resolveTrustProxy("0")).toBe(0);
  });

  it('parses "true" and "false" as booleans', () => {
    expect(resolveTrustProxy("true")).toBe(true);
    expect(resolveTrustProxy("false")).toBe(false);
  });

  it("passes through any other value for Express to interpret", () => {
    expect(resolveTrustProxy("loopback")).toBe("loopback");
    expect(resolveTrustProxy("10.0.0.0/8")).toBe("10.0.0.0/8");
  });
});

describe("resolveTrustProxy wired into an Express app", () => {
  it("rate-limits distinct forwarded clients independently once trust proxy is set", async () => {
    // Reproduces the real failure: with trust proxy unset (the default),
    // Express ignores X-Forwarded-For, so every request behind a reverse
    // proxy resolves to the proxy's own address and express-rate-limit
    // pools all real clients into one shared bucket.
    const express = (await import("express")).default;
    const rateLimit = (await import("express-rate-limit")).default;
    const request = (await import("supertest")).default;

    async function buildApp(trustProxy: boolean | number | string) {
      const app = express();
      app.set("trust proxy", trustProxy);
      app.use(rateLimit({ windowMs: 60_000, limit: 2 }));
      app.get("/x", (req, res) => res.json({ ip: req.ip }));
      return app;
    }

    // Unconfigured (trust proxy disabled, Express's real default): two
    // different claimed client IPs still collapse onto the same bucket.
    const unconfigured = await buildApp(false);
    const first = await request(unconfigured).get("/x").set("X-Forwarded-For", "1.1.1.1");
    const second = await request(unconfigured).get("/x").set("X-Forwarded-For", "2.2.2.2");
    expect(first.body.ip).toBe(second.body.ip);

    // Fixed (trust proxy set via resolveTrustProxy's default of 1): each
    // forwarded client gets its own bucket.
    const fixed = await buildApp(resolveTrustProxy(undefined));
    const a = await request(fixed).get("/x").set("X-Forwarded-For", "1.1.1.1");
    const b = await request(fixed).get("/x").set("X-Forwarded-For", "2.2.2.2");
    expect(a.body.ip).not.toBe(b.body.ip);
    expect(a.body.ip).toBe("1.1.1.1");
    expect(b.body.ip).toBe("2.2.2.2");
  });
});
