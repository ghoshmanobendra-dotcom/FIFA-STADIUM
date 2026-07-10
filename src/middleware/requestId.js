/**
 * Attach a unique request id to every request and echo it in the response.
 *
 * Correlating logs and client reports by a single id is essential for
 * operating a live system. Uses the platform crypto UUID — no dependency.
 */
import { randomUUID } from 'node:crypto';

/**
 * Express middleware to attach a unique request UUID to every request.
 * @param {import('express').Request & { id?: string }} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && incoming.length <= 100 ? incoming : randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  next();
}

export default requestId;
