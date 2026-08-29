import { NextFunction, Request, Response } from 'express';

/**
 * Instruments every request's response time in milliseconds, logged to
 * the console and exposed via an `X-Response-Time-Ms` header for
 * programmatic/client-side visibility.
 */
export function requestTimer(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - startedAt;
    const elapsedMs = Number(elapsedNs) / 1_000_000;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${elapsedMs.toFixed(2)}ms`,
    );
  });

  next();
}

/** Sets X-Response-Time-Ms before headers are flushed. */
export function responseTimeHeader(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();
  const originalWriteHead = res.writeHead.bind(res);

  res.writeHead = ((...args: Parameters<typeof res.writeHead>) => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    if (!res.headersSent) {
      res.setHeader('X-Response-Time-Ms', elapsedMs.toFixed(2));
    }
    return originalWriteHead(...args);
  }) as typeof res.writeHead;

  next();
}
