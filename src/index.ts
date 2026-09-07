import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import eventsRouter from "./routes/events";
import { errorHandler } from "./middleware/errorHandler";
import { globalLimiter } from "./middleware/rateLimiter";
import { getAdmin } from "./services/adminService";
import { rpcServer } from "./lib/stellar";
import { checkRpcHealth } from "./lib/rpcHealth";
import { requestLogger } from "./middleware/logger";
import { logger } from "./lib/logger";

// start indexer if enabled
import { startIndexer } from "./services/indexer";

dotenv.config();

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
app.use(globalLimiter);

// request logging middleware — logs method, path, status, and latency
app.use(requestLogger);

const startedAt = Date.now();
const RPC_HEALTH_TIMEOUT_MS = 3000;

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

app.get("/api/admin", async (_req, res, next) => {
  try {
    const admin = await getAdmin();
    res.json({ admin });
  } catch (err) {
    next(err);
  }
});

app.use("/api/events", eventsRouter);
app.use(errorHandler);

// start background indexer (unless disabled)
startIndexer();

app.listen(PORT, () => {
  logger.info({ port: PORT }, `NovaEvents API running`);
});

export default app;
