import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

const TEST_STORE_PATH = path.join(os.tmpdir(), `image-store-test-${process.pid}.json`);
process.env.IMAGE_STORE_PATH = TEST_STORE_PATH;

import {
  setEventImageUrl,
  getEventImageUrl,
  _resetImageStoreCache,
} from "./imageStore";

describe("imageStore", () => {
  beforeEach(() => {
    _resetImageStoreCache();
    fs.rmSync(TEST_STORE_PATH, { force: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_STORE_PATH, { force: true });
  });

  it("returns undefined for an event with no stored image", () => {
    expect(getEventImageUrl(1)).toBeUndefined();
  });

  it("returns the URL after it has been set", () => {
    setEventImageUrl(1, "https://cdn.example/a.png");

    expect(getEventImageUrl(1)).toBe("https://cdn.example/a.png");
  });

  it("replaces the URL on re-upload", () => {
    setEventImageUrl(1, "https://cdn.example/a.png");
    setEventImageUrl(1, "https://cdn.example/b.png");

    expect(getEventImageUrl(1)).toBe("https://cdn.example/b.png");
  });

  it("keeps entries for different events independent", () => {
    setEventImageUrl(1, "https://cdn.example/a.png");
    setEventImageUrl(2, "https://cdn.example/b.png");

    expect(getEventImageUrl(1)).toBe("https://cdn.example/a.png");
    expect(getEventImageUrl(2)).toBe("https://cdn.example/b.png");
  });

  it("persists across a cache reset (simulating a process restart)", () => {
    setEventImageUrl(1, "https://cdn.example/a.png");
    _resetImageStoreCache();

    expect(getEventImageUrl(1)).toBe("https://cdn.example/a.png");
  });
});
