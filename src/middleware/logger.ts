import pinoHttp from "pino-http";
import { logger } from "../lib/logger";

export const requestLogger = pinoHttp({
  logger,
  customLogLevel: function (res, err) {
    // pino-http passes the response object and optional error
    if ((res && (res as any).statusCode >= 500) || err) return "error";
    if (res && (res as any).statusCode >= 400) return "warn";
    return "info";
  },
  customProps: function (req, res) {
    return {
      method: req.method,
      path: (req as any).originalUrl || req.url,
    };
  },
});
