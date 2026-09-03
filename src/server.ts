import http from 'http';
import app from './app';
import { setupGracefulShutdown } from './gracefulShutdown';

const PORT = Number(process.env.PORT || 3000);

const server = http.createServer(app);

setupGracefulShutdown({
  server,
  app,
  timeoutMs: Number(process.env.SHUTDOWN_TIMEOUT_MS) || 30_000,
  onShutdown: () => {
    // optional: flush metrics, close DB pools, etc
    /* flush logics can happen here,
    db.close().catch(err => console.error('db close error', err));
    */
  },
});

server.listen(PORT, () => {
  console.info(`[startup] Listening on port ${PORT}`);
});
