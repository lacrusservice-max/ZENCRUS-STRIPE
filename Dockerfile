# ── Build stage ───────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --legacy-peer-deps

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ── Production stage ──────────────────────────────────────────
FROM node:20-alpine AS runner

RUN addgroup --system nutriai && adduser --system --ingroup nutriai nutriai

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

COPY --from=builder /app/dist ./dist

RUN mkdir -p logs && chown -R nutriai:nutriai /app

USER nutriai

ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/server.js"]
