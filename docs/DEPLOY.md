# Deployment Guide

StadiumIQ 2026 is a single **long-running Node.js (Express) server** that also
serves its own static client from `public/`. There is **no build step** and **no
database** — state is in-memory, and static domain data is bundled. That makes
it trivial to host almost anywhere.

## TL;DR — what should I use?

| Platform                                    | Fit                    | Why                                                                                                                              |
| ------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Render / Railway / Fly.io**               | ✅ **Best fit**        | Runs the process as-is; in-memory caches, metrics and rate-limiting all work; persistent `/api/health` health checks.            |
| **Docker (any VM / ECS / Cloud Run / K8s)** | ✅ Best fit            | `Dockerfile` included; portable and reproducible.                                                                                |
| **Vercel**                                  | ⚠️ Works, with caveats | Supported via a serverless adapter (`api/index.js` + `vercel.json`), but it's a **serverless** platform — see the caveats below. |
| **Netlify / GitHub Pages / S3**             | ❌ Not suitable alone  | These serve _static_ files only; the API needs a Node runtime.                                                                   |

**Recommendation:** for a demo or the hackathon submission, use **Render** (free
tier, one file — `render.yaml`) or **Docker**. Use **Vercel** only if you
specifically want it; it runs, but its serverless model doesn't match this
app's in-memory design as cleanly.

---

## Do I need anything else (database, queue, secrets manager)?

**No.** The app has:

- **No database** — venue/knowledge/schedule/emissions/capabilities data is
  static JSON, indexed at startup.
- **No external services** except _optionally_ the Anthropic API.
- **No secrets required to run** — with no API key it runs the deterministic
  offline engine and every feature still works.

The **only** thing a "real" deployment benefits from is an `ANTHROPIC_API_KEY`
to switch from the offline engine to live GenAI. Everything else has sane
defaults.

---

## Environment variables

All are **optional** — the app boots with defaults. Read once at startup in
`src/config.js`.

| Variable               | Default           | Purpose                                                                                                                                   |
| ---------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                 | `3000`            | Port to listen on. Most hosts inject this automatically.                                                                                  |
| `NODE_ENV`             | `development`     | Set to `production` in prod (enables generic error messages, JSON logs).                                                                  |
| `ANTHROPIC_API_KEY`    | _(empty)_         | **The one that matters.** Set it to enable live Claude responses; leave empty to run fully offline. Store as a secret, never in the repo. |
| `AI_MODEL`             | `claude-sonnet-5` | Claude model id. Also valid: `claude-opus-4-8`, `claude-haiku-4-5-20251001`.                                                              |
| `AI_MAX_TOKENS`        | `1024`            | Max tokens per completion.                                                                                                                |
| `CORS_ORIGINS`         | `*`               | Comma-separated allow-list. **Set an explicit list in production** (e.g. `https://stadiumiq.example.com`).                                |
| `RATE_LIMIT_WINDOW_MS` | `60000`           | Rate-limit window (ms).                                                                                                                   |
| `RATE_LIMIT_MAX`       | `60`              | Max requests/window/IP for the whole API.                                                                                                 |
| `RATE_LIMIT_AI_MAX`    | `20`              | Stricter cap for the GenAI endpoints.                                                                                                     |
| `BODY_LIMIT`           | `16kb`            | Max JSON body size.                                                                                                                       |

Minimum production `.env`:

```bash
NODE_ENV=production
ANTHROPIC_API_KEY=sk-ant-...        # optional but recommended
CORS_ORIGINS=https://your-domain.example
```

---

## Option A — Render (recommended, one file)

`render.yaml` is included. Push to GitHub → Render dashboard → **New +** →
**Blueprint** → select the repo. Then add `ANTHROPIC_API_KEY` as a secret env
var (it's declared `sync: false`, so Render prompts for it). Health checks hit
`/api/health` automatically.

## Option B — Docker (portable)

```bash
docker build -t stadiumiq .
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e CORS_ORIGINS=https://your-domain.example \
  stadiumiq
# → http://localhost:3000  (HEALTHCHECK probes /api/health)
```

The image is `node:20-alpine`, runs as the non-root `node` user, installs only
runtime deps via `npm ci`, and has no build step. Works on Cloud Run, ECS/Fargate,
Fly.io, Kubernetes, or any VM.

## Option C — Vercel (serverless, with caveats)

`api/index.js` exports the Express app as a serverless function and `vercel.json`
rewrites all routes to it:

```bash
npm i -g vercel
vercel            # preview
vercel --prod     # production
# set env vars:
vercel env add ANTHROPIC_API_KEY
```

**Caveats on Vercel (important):**

- **In-memory state isn't shared.** The AI cache, route-computation cache,
  `/api/metrics` counters and the rate limiter live per function instance and
  reset on cold starts — so rate limiting is best-effort and metrics are
  per-instance. For real limits/cache on Vercel, back them with Redis
  (e.g. Upstash) via `rate-limit-redis` and a Redis cache adapter.
- **Cold starts** add latency to the first request after idle.
- Static assets are served through the function rather than Vercel's CDN.

None of these affect correctness — the app still works — they just mean a
single always-on Node host fits its design better.

---

## Production checklist

- [ ] `NODE_ENV=production`
- [ ] Explicit `CORS_ORIGINS` (not `*`)
- [ ] `ANTHROPIC_API_KEY` set via the platform's secret store (optional)
- [ ] TLS terminated at the edge/load balancer (the app advertises HSTS)
- [ ] Health check wired to `GET /api/health`
- [ ] Rate limits (`RATE_LIMIT_MAX` / `RATE_LIMIT_AI_MAX`) tuned to expected load
- [ ] (Vercel only) external Redis for shared rate-limit/cache if you need them

See [`SECURITY.md`](../SECURITY.md) for the full hardening checklist.
