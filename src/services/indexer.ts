import { getDb } from "../lib/db";
import { xdr } from "@stellar/stellar-sdk";
import { simulateContractCall } from "../lib/stellar";
import { logger } from "../lib/logger";
import type Database from "better-sqlite3";

const DEFAULT_INTERVAL = Number(process.env.INDEX_SYNC_INTERVAL_MS) || 30000;

function safeStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
}

export async function runIndexOnce(): Promise<void> {
  try {
    const count = (await simulateContractCall("event_count")) as number;
    let upsertStmt: Database.Statement<[number, string, number]> | null = null;
    for (let id = 0; id < count; id++) {
      try {
        const [event, tiers] = await Promise.all([
          simulateContractCall("get_event", xdr.ScVal.scvU32(id)),
          simulateContractCall("get_tiers", xdr.ScVal.scvU32(id)),
        ]);
        const payload = { id, ...(event as object), tiers };
        const json = safeStringify(payload);
        if (!upsertStmt) {
          upsertStmt = getDb().prepare(
            "INSERT INTO events_index (id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at"
          );
        }
        upsertStmt.run(id, json, Date.now());
      } catch (err) {
        // If a single event fails to index, skip it but continue indexing others
        logger.error({ id, err }, "failed to index event");
      }
    }
  } catch (err) {
    logger.error({ err }, "failed to run indexer");
    throw err;
  }
}

let intervalHandle: NodeJS.Timeout | null = null;

export function startIndexer(): void {
  if (process.env.INDEXER_DISABLED && (process.env.INDEXER_DISABLED === "1" || process.env.INDEXER_DISABLED.toLowerCase() === "true")) {
    logger.info("indexer disabled by INDEXER_DISABLED");
    return;
  }

  // run immediately
  runIndexOnce().catch(() => {});

  // then poll
  const ms = DEFAULT_INTERVAL;
  intervalHandle = setInterval(() => {
    runIndexOnce().catch(() => {});
  }, ms);
  logger.info({ intervalMs: ms }, "indexer started");
}

export function stopIndexer(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
