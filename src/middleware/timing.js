/**
 * Lightweight request-timing instrumentation.
 *
 * Records how many requests the API has served and their cumulative latency so
 * `/api/metrics` can expose an average — enough to observe efficiency in a demo
 * without pulling in a metrics library or adding per-request allocation beyond
 * a single high-resolution timestamp.
 */
export const httpMetrics = {
  requests: 0,
  totalMs: 0,
  get avgMs() {
    return this.requests ? Number((this.totalMs / this.requests).toFixed(2)) : 0;
  },
};

/**
 * Express middleware to record request execution time.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function timing(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    httpMetrics.requests++;
    httpMetrics.totalMs += ms;
  });
  next();
}

export default timing;
