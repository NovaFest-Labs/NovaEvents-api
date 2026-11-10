import http from 'http';
import { Application } from 'express';
import net from 'net';

export interface GracefulOptions {
  server: http.Server;
  app: Application;
  timeoutMs?: number;
  onShutdown?: () => void;
}

export function setupGracefulShutdown(opts: GracefulOptions) {
  const { server, timeoutMs = 30_000, onShutdown } = opts;

  let activeRequests = 0;

  // Tracked on the raw http.Server via its 'request' event rather than an
  // Express app.use() middleware. index.ts creates the server and calls
  // this function after every route and the error handler are already
  // registered, so a middleware added here would land at the end of the
  // Express stack and never run: a matched route sends its response and
  // never calls next(). The server's 'request' event fires for every
  // request no matter when or where Express middleware is registered.
  server.on('request', (req: http.IncomingMessage, res: http.ServerResponse) => {
    activeRequests++;
    const start = Date.now();
    // Node emits both 'finish' and 'close' for a normally completed response
    // (only 'close' for an aborted one), so count whichever fires first.
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      activeRequests--;
      const duration = Date.now() - start;
      console.debug(`[shutdown] request done ${req.method} ${req.url} ${duration}ms, activeRequests=${activeRequests}`);
    };
    res.on('finish', release);
    res.on('close', release);
  });

  const sockets = new Set<net.Socket>();
  server.on('connection', (socket: net.Socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  let shuttingDown = false;

  function log(...args: any[]) {
    console.info('[graceful-shutdown]', ...args);
  }

  async function doShutdown(signal: string) {
    if (shuttingDown) {
      log(`already shutting down (signal=${signal}), ignoring duplicate signal`);
      return;
    }
    shuttingDown = true;

    const startedAt = new Date().toISOString();
    log(`${startedAt} - Received ${signal}. Starting graceful shutdown.`);
    log('Stopping server from accepting new connections.');

    server.close((err?: Error) => {
      if (err) {
        console.error('[graceful-shutdown] server.close error:', err);
      } else {
        console.info('[graceful-shutdown] server.close callback called — server stopped accepting new connections.');
      }
    });

    const forceTimeout = Math.max(1000, timeoutMs);

    const start = Date.now();
    const interval = 500;
    const check = setInterval(() => {
      log(`waiting for active requests to finish: activeRequests=${activeRequests}`);
      if (activeRequests === 0) {
        clearInterval(check);
        finishShutdown(0);
      } else if (Date.now() - start >= forceTimeout) {
        clearInterval(check);
        log(`timeout reached (${forceTimeout}ms). Force-closing ${sockets.size} sockets.`);
        for (const socket of sockets) {
          try {
            socket.destroy();
          } catch (err) {
            console.error('[graceful-shutdown] error destroying socket', err);
          }
        }
        finishShutdown(1);
      }
    }, interval);

    server.on('close', () => {
      log('server close event fired');
    });

    function finishShutdown(exitCode: number) {
      try {
        if (onShutdown) {
          try {
            onShutdown();
          } catch (err) {
            console.error('[graceful-shutdown] onShutdown hook error', err);
          }
        }
        log('shutdown complete. Exiting with code', exitCode);
      } finally {
        setTimeout(() => {
          process.exit(exitCode);
        }, 10).unref();
      }
    }
  }

  process.on('SIGTERM', () => doShutdown('SIGTERM'));
  process.on('SIGINT', () => doShutdown('SIGINT'));

  // Optional: treat uncaughtException as fatal and try to shutdown
  process.on('uncaughtException', (err) => {
    console.error('[graceful-shutdown] uncaughtException', err);
    doShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[graceful-shutdown] unhandledRejection', reason);
  });
  
  return {
    getActiveRequests: () => activeRequests,
    getSocketCount: () => sockets.size,
  };
}
