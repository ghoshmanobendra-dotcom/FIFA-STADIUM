# Contributing

Thanks for your interest in StadiumIQ 2026! This project keeps a deliberately
small toolchain.

## Prerequisites

- Node.js 20+ (see `.nvmrc`)

## Setup

```bash
npm install
cp .env.example .env   # optional; leave ANTHROPIC_API_KEY blank to run offline
npm run dev            # auto-reloading server on http://localhost:3000
```

## Quality gates

Before opening a PR, run the full gate:

```bash
npm run check          # eslint + prettier --check + unit/integration tests
npm run test:e2e       # browser E2E + axe-core accessibility (needs Chromium)
```

Individual commands:

| Command                 | What it does                                              |
| ----------------------- | --------------------------------------------------------- |
| `npm test`              | Unit + integration tests (browserless, no API key needed) |
| `npm run lint`          | ESLint (flat config, recommended + custom rules)          |
| `npm run lint:fix`      | Auto-fix lint issues                                      |
| `npm run format`        | Prettier write                                            |
| `npm run test:coverage` | Tests with coverage report                                |
| `npm run test:e2e`      | E2E + accessibility (axe-core) in headless Chromium       |

## Conventions

- **ES modules** everywhere; Node built-ins prefixed `node:`.
- **Services stay pure** — the only module that makes network calls is
  `src/services/aiService.js`. New generative features must supply a
  deterministic `fallback` so the app keeps working offline.
- **Validate at the edge** — all request input goes through
  `src/middleware/validate.js`; never trust `req.body`/`req.query` directly.
- **Every feature ships tests** — a unit test for the service and, where it has
  a UI surface, coverage in the E2E suite.
- Keep the client **framework-free and CSP-safe** (no inline scripts, no
  external origins).
