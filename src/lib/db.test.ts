import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

const TEST_DB_PATH = path.join(os.tmpdir(), `novaevents-db-test-${process.pid}.db`);
process.env.INDEX_DB_PATH = TEST_DB_PATH;

import { getDb, _resetDbForTests } from "./db";

describe("getDb", () => {
  beforeEach(() => {
    _resetDbForTests();
    fs.rmSync(TEST_DB_PATH, { force: true });
  });

  afterEach(() => {
    _resetDbForTests();
    fs.rmSync(TEST_DB_PATH, { force: true });
  });

  it("creates the events_index table on first use", () => {
    process.env.INDEX_DB_PATH = TEST_DB_PATH;
    const db = getDb();

    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='events_index'")
      .get();

    expect(row).toBeTruthy();
  });

  it("reuses the same connection on subsequent calls", () => {
    process.env.INDEX_DB_PATH = TEST_DB_PATH;
    expect(getDb()).toBe(getDb());
  });

  it("throws a clear error instead of an unwrapped stack trace when the directory can't be created", () => {
    // A regular file can't have a subdirectory created "inside" it, so
    // pointing INDEX_DB_PATH through one reliably reproduces a real
    // mkdir failure (ENOTDIR) without needing special permissions.
    const blockerFile = path.join(os.tmpdir(), `novaevents-db-blocker-${process.pid}`);
    fs.writeFileSync(blockerFile, "not a directory");
    process.env.INDEX_DB_PATH = path.join(blockerFile, "nested", "index.db");

    try {
      expect(() => getDb()).toThrow(/failed to create the index database directory/i);
    } finally {
      fs.rmSync(blockerFile, { force: true });
    }
  });
});
