/**
 * Express application factory.
 *
 * Assembles security middleware (headers, CORS, layered rate limiting,
 * content-type enforcement, bounded bodies), static hosting for the accessible
 * web client, the JSON API, and centralised error handling. Exported as a
 * factory so tests can spin up an isolated instance.
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import config from './config.js';
import apiRouter from './routes/index.js';
import { requestId } from './middleware/requestId.js';
import { timing } from './middleware/timing.js';
import { generalLimiter, aiLimiter, requireJson } from './middleware/security.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

/** Generative endpoints get the stricter rate-limit tier. */
const AI_PATHS = [
  '/api/concierge',
  '/api/navigate',
  '/api/translate',
  '/api/sustainability/footprint',
  '/api/incident',
  '/api/announce',
  '/api/briefing',
  '/api/plan',
  '/api/crowd',
];

export function createApp() {
  const app = express();

  // Trust the first proxy hop so rate-limiting sees real client IPs behind a
  // load balancer, without trusting the whole chain.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.disable('etag'); // API responses are dynamic; avoid stale 304s.

  // Correlate every request/response with an id and time each request.
  app.use(requestId);
  app.use(timing);

  // Compress responses (JSON + static assets) when the client supports it.
  app.use(compression());

  // --- Security headers ---------------------------------------------------
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      referrerPolicy: { policy: 'no-referrer' },
      hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
    }),
  );

  // Lock down powerful browser features we never use.
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    next();
  });

  // --- CORS ---------------------------------------------------------------
  const allowAll = config.cors.origins.includes('*');
  app.use(
    cors({
      origin: allowAll ? true : config.cors.origins,
      methods: ['GET', 'POST'],
      maxAge: 600,
    }),
  );

  // --- Body parsing (bounded to mitigate payload-based abuse) -------------
  app.use(express.json({ limit: config.bodyLimit }));

  // --- Rate limiting ------------------------------------------------------
  app.use('/api', generalLimiter);
  app.use(AI_PATHS, aiLimiter);

  // --- Content-type enforcement for mutating requests ---------------------
  app.use('/api', requireJson);

  // --- API ----------------------------------------------------------------
  app.use('/api', apiRouter);

  // --- Static accessible web client ---------------------------------------
  app.use(
    express.static(publicDir, {
      extensions: ['html'],
      maxAge: '1h',
      setHeaders: (res, path) => {
        // The SPA shell should always be revalidated so deploys take effect.
        if (path.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );

  // --- Fallbacks ----------------------------------------------------------
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
