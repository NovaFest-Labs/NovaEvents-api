import http from 'http';
import { Application, Request, Response, NextFunction } from 'express';
import net from 'net';

export interface GracefulOptions {
  server: http.Server;
  app: Application;
  timeoutMs?: number;
  onShutdown?: () => void;
}

export function setupGracefulShutdown(opts: GracefulOptions) {
  const { server, app, timeoutMs = 30_000, onShutdown } = opts;

  let activeRequests = 0;
  
  app.use((req: Request, res: Response, next: NextFunction) => {
    activeRequests++;
    const start = Date.now();
    res.on('finish', () => {
      activeRequests = Math.max(0, activeRequests - 1);
      const duration = Date.now() - start;
      console.debug(`[shutdown] request finished ${req.method} ${req.url} ${duration}ms, activeRequests=${activeRequests}`);
    });

    res.on('close', () => {
      activeRequests = Math.max(0, activeRequests - 1);
      console.debug(`[shutdown] request closed ${req.method} ${req.url}, activeRequests=${activeRequests}`);
    });
    next();
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
