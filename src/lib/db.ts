import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = process.env.INDEX_DB_PATH || path.join(process.cwd(), "data", "index.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Simple key-value table storing a JSON payload per event id and an updated timestamp
db.exec(`
  CREATE TABLE IF NOT EXISTS events_index (
    id INTEGER PRIMARY KEY,
    payload TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

export default db;
