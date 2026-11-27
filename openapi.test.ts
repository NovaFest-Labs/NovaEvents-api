/**
 * Guards against the OpenAPI spec drifting from what the API actually does.
 * This spec is served live at /api/docs (see src/routes/docs.ts), so a wrong
 * example here isn't just a comment — it's what a real API consumer reads.
 */
import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import { parse } from "yaml";
import express from "express";
import request from "supertest";
import { Request, Response } from "express";
import { eventsListLimiter } from "./src/middleware/rateLimiter";

// verifyOrganizer.ts imports eventsService.ts, which imports lib/stellar,
// which constructs a real Soroban RPC client at module load time — mock it
// the same way every other test touching that chain does.
vi.mock("./src/lib/stellar", () => ({ simulateContractCall: vi.fn() }));
import { verifyOrganizer } from "./src/middleware/verifyOrganizer";
import { getAdmin } from "./src/services/adminService";
import { simulateContractCall } from "./src/lib/stellar";

const spec = parse(fs.readFileSync(path.join(__dirname, "openapi.yaml"), "utf-8")) as Record<
  string,
  unknown
>;

function get(obj: unknown, pathStr: string): unknown {
  return pathStr
    .split(".")
    .reduce((acc: unknown, key) => (acc as Record<string, unknown>)?.[key], obj);
}

describe("openapi.yaml matches validateEventId's actual behavior", () => {
  // event_id is a u32 and validateEventId (src/middleware/validateEventId.ts)
  // accepts 0 — see "calls next() for a plain zero" in validateEventId.test.ts.
  it("documents the EventId path parameter as non-negative, not positive", () => {
    expect(get(spec, "components.parameters.EventId.schema.minimum")).toBe(0);
    expect(get(spec, "components.parameters.EventId.description")).toMatch(
      /non-negative integer/
    );
  });

  it("documents the shared InvalidEventId response with the real error message", () => {
    expect(get(spec, "components.responses.InvalidEventId.description")).toMatch(
      /non-negative integer/
    );
    expect(get(spec, "components.responses.InvalidEventId.content.application/json.example.error")).toBe(
      "event id must be a non-negative integer"
    );
  });

  it("documents the inline invalidEventId examples with the real error message", () => {
    const paths = spec.paths as Record<string, Record<string, unknown>>;

    for (const [routePath, route] of Object.entries(paths)) {
      const invalidEventIdExample = get(
        route,
        "get.responses.400.content.application/json.examples.invalidEventId.value.error"
      );
      if (invalidEventIdExample !== undefined) {
        expect(invalidEventIdExample, `in ${routePath}`).toBe(
          "event id must be a non-negative integer"
        );
      }
    }
  });
});

describe("openapi.yaml documents GET /api/admin's actual response shape", () => {
  it("matches getAdmin() returning a plain address string, not an object", async () => {
    vi.mocked(simulateContractCall).mockResolvedValue(
      "GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234"
    );

    const admin = await getAdmin();
    expect(typeof admin).toBe("string");

    expect(get(spec, "paths./api/admin.get.responses.200.content.application/json.schema.properties.admin.type")).toBe(
      "string"
    );
  });
});

describe("openapi.yaml documents GET /api/events's actual rate-limit response", () => {
  it("matches the real 429 body from eventsListLimiter", async () => {
    const app = express();
    app.get("/events", eventsListLimiter, (_req, res) => res.json([]));

    const requests = Array.from({ length: 21 }, () => request(app).get("/events"));
    const results = await Promise.all(requests);
    const throttled = results.find((r) => r.status === 429);

    expect(throttled, "none of the 21 requests were throttled").toBeDefined();
    expect(throttled!.body.error).toBe(
      get(spec, "paths./api/events.get.responses.429.content.application/json.example.error")
    );
  });
});

describe("openapi.yaml files the expired-timestamp example under verifyOrganizer's real status code", () => {
  it("verifyOrganizer actually returns 401, not 403, for an expired timestamp", async () => {
    // The check happens before any contract lookup, so no service mocking
    // beyond lib/stellar (above) is needed.
    const req = {
      params: { id: "1" },
      header(name: string) {
        const headers: Record<string, string> = {
          "x-organizer-address": "GA".padEnd(56, "A"),
          "x-organizer-signature": "deadbeef",
          "x-organizer-timestamp": String(Date.now() - 10 * 60 * 1000), // 10 min old
        };
        return headers[name.toLowerCase()];
      },
    } as unknown as Request;
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
    } as unknown as Response & { statusCode: number; body: unknown };

    await verifyOrganizer(req, res, vi.fn());

    expect(res.statusCode).toBe(401);
    expect(
      get(
        spec,
        "paths./api/events/{id}/image.post.responses.401.content.application/json.examples.expired.value.error"
      )
    ).toBe((res.body as { error: string }).error);
    // And NOT filed under 403, where this example used to incorrectly live.
    expect(
      get(
        spec,
        "paths./api/events/{id}/image.post.responses.403.content.application/json.examples.expired"
      )
    ).toBeUndefined();
  });
});
