/**
 * Vercel serverless entry point.
 *
 * Vercel invokes an exported request handler rather than a long-running
 * `listen()` server. An Express application *is* such a handler, so we build it
 * once per warm instance and export it. Route rewrites in `vercel.json` send
 * every path (API + static client) here.
 *
 * ⚠️ Serverless caveat: in-memory state (the AI/route caches, request metrics
 * and rate-limit counters) lives per instance and is not shared across
 * cold-started functions. For production-grade rate limiting or a shared cache
 * on Vercel, back them with an external store (e.g. Redis). A single always-on
 * Node host (Docker / Render / Fly.io) avoids this entirely.
 */
import { createApp } from '../src/app.js';

export default createApp();
