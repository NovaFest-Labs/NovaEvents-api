import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// Resolved lazily (not at module load) so tests can point it at a temp
// path via INDEX_DB_PATH before the connection is first opened.
function dbPath(): string {
  return process.env.INDEX_DB_PATH || path.join(process.cwd(), "data", "index.db");
}

let db: Database.Database | null = null;

function openDb(): Database.Database {
  const target = dbPath();
  const dir = path.dirname(target);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    throw new Error(
      `Failed to create the index database directory at "${dir}": ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  const instance = new Database(target);

  // Simple key-value table storing a JSON payload per event id and an updated timestamp
  instance.exec(`
    CREATE TABLE IF NOT EXISTS events_index (
      id INTEGER PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  return instance;
}

/** Returns the shared database connection, opening it on first use. */
export function getDb(): Database.Database {
  if (!db) db = openDb();
  return db;
}

/** Test-only: clears the cached connection so the next getDb() reopens it. */
export function _resetDbForTests(): void {
  db?.close();
  db = null;
}
