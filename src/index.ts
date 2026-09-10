import dotenv from "dotenv";
dotenv.config();

import http from "http";
import net from "net";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import eventsRouter from "./routes/events";
import docsRouter from "./routes/docs";
import { errorHandler } from "./middleware/errorHandler";
import { globalLimiter } from "./middleware/rateLimiter";
import { getAdmin } from "./services/adminService";
import { rpcServer } from "./lib/stellar";
import { checkRpcHealth } from "./lib/rpcHealth";
import { requestLogger } from "./middleware/logger";
import { logger } from "./lib/logger";

// start indexer if enabled
import { startIndexer } from "./services/indexer";

const REQUIRED_ENV = ["STELLAR_RPC_URL", "NOVA_EVENTS_CONTRACT_ID"];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  logger.error({ missing }, `Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());

const startedAt = Date.now();
const RPC_HEALTH_TIMEOUT_MS = 3000;

// Register /health BEFORE the global rate limiter so that load-balancer and
// uptime-monitor probes are never throttled.
app.get("/health", async (_req, res) => {
  const staticFields = {
    version: process.env.npm_package_version ?? "unknown",
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    network: process.env.STELLAR_RPC_URL,
    contractId: process.env.NOVA_EVENTS_CONTRACT_ID,
  };

  const rpcReachable = await checkRpcHealth(rpcServer, RPC_HEALTH_TIMEOUT_MS);
  if (rpcReachable) {
    res.json({ status: "ok", rpcReachable, ...staticFields });
  } else {
    res.status(503).json({ status: "error", rpcReachable, ...staticFields });
  }
});

app.use(globalLimiter);

// request logging middleware — logs method, path, status, and latency
app.use(requestLogger);

app.get("/api/admin", async (_req, res, next) => {
  try {
    const admin = await getAdmin();
    res.json({ admin });
  } catch (err) {
    next(err);
  }
});

app.use("/api/events", eventsRouter);
app.use("/api/docs", docsRouter);
app.use(errorHandler);

// start background indexer (unless disabled)
startIndexer();

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 30_000;

let activeRequests = 0;

// Track in-flight requests so shutdown waits for them to complete.
app.use((req: Request, res: Response, next: NextFunction) => {
  activeRequests++;
  res.on("finish", () => {
    activeRequests = Math.max(0, activeRequests - 1);
  });
  res.on("close", () => {
    activeRequests = Math.max(0, activeRequests - 1);
  });
  next();
});

const server = http.createServer(app);

// Track open sockets so we can force-close them on timeout.
const sockets = new Set<net.Socket>();
server.on("connection", (socket: net.Socket) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
});

let shuttingDown = false;

async function doShutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    logger.info({ signal }, "graceful-shutdown: already in progress, ignoring duplicate signal");
    return;
  }
  shuttingDown = true;
  logger.info({ signal }, "graceful-shutdown: received signal, stopping new connections");

  server.close((err?: Error) => {
    if (err) logger.error({ err }, "graceful-shutdown: server.close error");
  });

  const start = Date.now();
  const interval = 500;
  const check = setInterval(() => {
    logger.info({ activeRequests }, "graceful-shutdown: waiting for in-flight requests");
    if (activeRequests === 0) {
      clearInterval(check);
      finish(0);
    } else if (Date.now() - start >= SHUTDOWN_TIMEOUT_MS) {
      clearInterval(check);
      logger.warn({ count: sockets.size }, "graceful-shutdown: timeout reached, force-closing sockets");
      for (const socket of sockets) {
        try { socket.destroy(); } catch { /* ignore */ }
      }
      finish(1);
    }
  }, interval);

  function finish(code: number): void {
    logger.info({ code }, "graceful-shutdown: exiting");
    setTimeout(() => process.exit(code), 10).unref();
  }
}

process.on("SIGTERM", () => doShutdown("SIGTERM"));
process.on("SIGINT",  () => doShutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  logger.error({ err }, "uncaughtException");
  doShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "unhandledRejection");
});

server.listen(PORT, () => {
  logger.info({ port: PORT }, "NovaEvents API running");
});

export default app;
