import fs from "fs";
import path from "path";

/**
 * Lightweight local JSON store mapping event_id -> cover image URL.
 *
 * This stands in for the "index events into a local database" scope
 * mentioned in the README until a real database is introduced — at that
 * point this file can be swapped out without touching its callers.
 */

// Resolved lazily (not at module load) so tests can point it at a temp
// file via IMAGE_STORE_PATH after this module has already been imported.
function storePath(): string {
  return process.env.IMAGE_STORE_PATH ?? path.join(process.cwd(), "data", "event-images.json");
}

let cache: Record<string, string> | null = null;

function load(): Record<string, string> {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(storePath(), "utf-8")) as Record<string, string>;
  } catch {
    cache = {};
  }
  return cache;
}

function persist(data: Record<string, string>): void {
  const target = storePath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(data, null, 2));
}

/** Stores (or replaces) the cover image URL for an event. */
export function setEventImageUrl(eventId: number, url: string): void {
  const data = load();
  data[String(eventId)] = url;
  persist(data);
}

/** Returns the cover image URL for an event, or undefined if none was uploaded. */
export function getEventImageUrl(eventId: number): string | undefined {
  return load()[String(eventId)];
}

/** Test-only: clears the in-memory cache so the store re-reads from disk. */
export function _resetImageStoreCache(): void {
  cache = null;
}
