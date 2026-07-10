/**
 * Reusable security middleware: layered rate limiting and content-type
 * enforcement.
 *
 * Two rate-limit tiers are exposed — a general one for all API traffic and a
 * stricter one for the GenAI endpoints, which cost more to serve and are the
 * more attractive abuse target. Keeping these here (rather than inline in the
 * app) makes the policy explicit, testable and easy to tune.
 */
import rateLimit from 'express-rate-limit';
import config from '../config.js';

/**
 * Build a rate limiter with the shared window and a JSON error body carrying a
 * machine-readable code.
 * @param {number} max
 * @param {string} code
 * @returns {import('express-rate-limit').RateLimitRequestHandler}
 */
function makeLimiter(max, code) {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // Skip limiting entirely in the test environment for determinism.
    skip: () => config.isTest,
    handler: (req, res) =>
      res.status(429).json({
        error: 'Too many requests, please slow down.',
        code,
        requestId: req.id,
      }),
  });
}

/** General limiter for the whole API surface. */
export const generalLimiter = makeLimiter(config.rateLimit.max, 'rate_limited');

/** Stricter limiter for expensive generative endpoints. */
export const aiLimiter = makeLimiter(config.rateLimit.aiMax, 'ai_rate_limited');

/**
 * Reject mutating requests that are not JSON. A body-carrying POST must declare
 * `application/json`; anything else is a 415. This narrows the attack surface
 * and prevents accidental form/multipart parsing.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requireJson(req, res, next) {
  if (req.method === 'POST' && !req.is('application/json')) {
    return res.status(415).json({
      error: 'Content-Type must be application/json',
      code: 'unsupported_media_type',
      requestId: req.id,
    });
  }
  next();
}

export default { generalLimiter, aiLimiter, requireJson };
