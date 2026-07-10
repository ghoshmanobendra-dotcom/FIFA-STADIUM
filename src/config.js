/**
 * Centralised, validated runtime configuration.
 *
 * Reading environment access through a single module keeps configuration
 * predictable, makes the code easy to test, and ensures secrets are never
 * hard-coded. Values are parsed and coerced once at import time.
 */
import 'dotenv/config';

/**
 * @param {string|undefined} value
 * @param {number} fallback
 */
function toInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const config = Object.freeze({
  port: toInt(process.env.PORT, 3000),
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  ai: Object.freeze({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.AI_MODEL || 'claude-sonnet-5',
    maxTokens: toInt(process.env.AI_MAX_TOKENS, 1024),
    apiUrl: 'https://api.anthropic.com/v1/messages',
    apiVersion: '2023-06-01',
    /** Whether a live model is configured. When false we use the offline engine. */
    get enabled() {
      return this.apiKey.length > 0;
    },
  }),

  cors: Object.freeze({
    origins: (process.env.CORS_ORIGINS || '*')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  }),

  rateLimit: Object.freeze({
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    max: toInt(process.env.RATE_LIMIT_MAX, 60),
    // Stricter budget for GenAI endpoints, which are more expensive to serve.
    aiMax: toInt(process.env.RATE_LIMIT_AI_MAX, 20),
  }),

  // Maximum accepted JSON body size.
  bodyLimit: process.env.BODY_LIMIT || '16kb',
});

export default config;
