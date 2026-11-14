/**
 * Guards against the OpenAPI spec drifting from what the API actually does.
 * This spec is served live at /api/docs (see src/routes/docs.ts), so a wrong
 * example here isn't just a comment — it's what a real API consumer reads.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parse } from "yaml";

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
