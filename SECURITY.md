# Security Policy

StadiumIQ 2026 is designed to run in a public-facing, high-traffic venue
context, so security is treated as a first-class requirement rather than an
afterthought.

## Reporting a vulnerability

If you discover a vulnerability, please open a private security advisory or
email the maintainers rather than filing a public issue. We aim to acknowledge
reports within 72 hours.

## Controls implemented in this codebase

| Area                    | Control                                                                                                                                                                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Transport / headers** | `helmet` sets a strict Content-Security-Policy (no inline scripts), HSTS with preload, `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy`, and a restrictive `Permissions-Policy`. `X-Powered-By` is disabled.                |
| **Input validation**    | Every request field is validated and bounded (type, length, range, enum, array size) before reaching a service — see `src/middleware/validate.js`.                                                                                                                |
| **Body limits**         | JSON bodies are capped (default 16 KB); oversized payloads return `413`.                                                                                                                                                                                          |
| **Content-type**        | Mutating requests must be `application/json`, otherwise `415`.                                                                                                                                                                                                    |
| **Rate limiting**       | Two tiers: a general per-IP limit for the whole API and a stricter limit for the more expensive GenAI endpoints (`src/middleware/security.js`).                                                                                                                   |
| **Prompt-injection**    | All free-text is sanitised before being placed in a model prompt (`src/utils/sanitize.js`): control characters stripped, instruction-override phrases neutralised, length capped. User text is always sent in the user role, never merged into the system prompt. |
| **Error handling**      | A single error handler returns a consistent `{ error, code, requestId }` shape and never leaks stack traces or internal messages for `5xx` in production.                                                                                                         |
| **Secrets**             | No secrets are committed. Configuration is read from environment variables; `.env` is git-ignored and `.env.example` documents the required keys.                                                                                                                 |
| **Dependency surface**  | Minimal runtime dependencies (6), all pinned by caret range; `npm audit` runs in CI.                                                                                                                                                                              |
| **Traceability**        | Every request is assigned an `X-Request-Id` (honoured if supplied) for correlation across logs and error responses.                                                                                                                                               |

## Secure configuration checklist for deployment

- Set `NODE_ENV=production` (enables generic error messages).
- Set an explicit `CORS_ORIGINS` allow-list (never `*` in production).
- Provide `ANTHROPIC_API_KEY` via a secret manager, not the image or repo.
- Terminate TLS at the edge; HSTS is already advertised by the app.
- Tune `RATE_LIMIT_MAX` / `RATE_LIMIT_AI_MAX` to expected traffic.
