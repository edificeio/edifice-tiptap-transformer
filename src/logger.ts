import { Express } from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Plain JSON in production (for log aggregation), human-readable in
 * development. Error objects passed as `{ err }` get their stack trace
 * serialized automatically (pino's standard error serializer).
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  serializers: { err: pino.stdSerializers.err },
  // pino writes the level as a number (30, 40, 50...) by default, faster to
  // serialize than a string lookup on every call - override for readability.
  formatters: { level: (label) => ({ level: label }) },
  // Keep the epoch "time" field (sortable, parsed natively by log systems)
  // and add an ISO string alongside it for humans reading the raw JSON.
  timestamp: () =>
    `,"time":${Date.now()},"datetime":"${new Date().toISOString()}"`,
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
});

/**
 * Access log: one concise structured line per request (method, url, status,
 * responseTime, reqId). req.log is a child logger carrying that same reqId,
 * so an error line can be correlated with its access line.
 */
export function initLogger(app: Express): void {
  app.use(
    pinoHttp({
      logger,
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? 'error' : 'info',
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
          contentLength: req.headers['content-length'],
        }),
        // pino wraps a custom serializer around its default one first, so
        // `res`/`req` here are already-serialized plain objects (`res.headers`
        // is a plain object, not `res.getHeaders()`) - not the raw Node objects.
        res: (res) => ({
          statusCode: res.statusCode,
          contentLength: res.headers['content-length'],
        }),
      },
    }),
  );
}
