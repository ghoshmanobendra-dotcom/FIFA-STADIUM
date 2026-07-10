# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# StadiumIQ 2026 — production image
# Small, non-root, reproducible (npm ci from the committed lockfile).
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Install ONLY runtime dependencies.
RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
# Copy the pruned node_modules and the application source.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public

# Run as the built-in unprivileged user.
USER node
EXPOSE 3000

# Container-level liveness probe hitting the app's health endpoint.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
