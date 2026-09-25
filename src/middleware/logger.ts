import pinoHttp from "pino-http";
import { Request, Response } from "express";
import { logger } from "../lib/logger";

export const requestLogger = pinoHttp<Request, Response>({
  logger,
  customLogLevel: function (res, err) {
    // pino-http passes the response object and optional error
    const statusCode = res?.statusCode ?? 0;
    if (statusCode >= 500 || err) return "error";
    if (statusCode >= 400) return "warn";
    return "info";
  },
  customProps: function (req) {
    return {
      method: req.method,
      path: req.originalUrl || req.url,
    };
  },
});
