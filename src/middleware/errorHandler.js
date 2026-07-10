/**
 * Central error handling and 404 fallback.
 *
 * Guarantees a consistent JSON error shape `{ error, code, requestId }` and —
 * importantly for security — never leaks stack traces or internal messages for
 * unexpected errors in production. Known errors carry a `status` and `code`;
 * body-parser failures are normalised; everything else becomes a generic 500.
 */
import logger from '../utils/logger.js';
import config from '../config.js';

/**
 * 404 handler for unmatched routes.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export function notFound(req, res) {
  res
    .status(404)
    .json({ error: 'Not found', code: 'not_found', path: req.path, requestId: req.id });
}

/**
 * Map a raw error to a safe { status, code } pair.
 * @param {Error & { status?: number, statusCode?: number, code?: string, type?: string }} err
 */
function classify(err) {
  // Malformed JSON body from express.json().
  if (err.type === 'entity.parse.failed') {
    return { status: 400, code: 'invalid_json' };
  }
  // Payload too large.
  if (err.type === 'entity.too.large' || err.status === 413) {
    return { status: 413, code: 'payload_too_large' };
  }
  const status = Number.isInteger(err.status)
    ? err.status
    : Number.isInteger(err.statusCode)
      ? err.statusCode
      : 500;
  const code = typeof err.code === 'string' && !/^E[A-Z]/.test(err.code) ? err.code : undefined;
  return { status, code: code || (status >= 500 ? 'internal_error' : 'bad_request') };
}

/**
 * Express error-handling middleware (must keep the 4-arg signature).
 * @param {Error & { status?: number }} err
 */
export function errorHandler(err, req, res, _next) {
  const { status, code } = classify(err);

  if (status >= 500) {
    logger.error('Unhandled request error', {
      path: req.path,
      requestId: req.id,
      error: err.message,
    });
  }

  // Client errors (4xx) carry safe, actionable messages. Server errors expose a
  // generic message unless we're explicitly in a non-production environment.
  const message =
    status < 500
      ? err.expose === false
        ? 'Bad request'
        : err.message
      : config.isProduction
        ? 'Internal server error'
        : err.message;

  res.status(status).json({ error: message, code, requestId: req.id });
}

export default { notFound, errorHandler };
