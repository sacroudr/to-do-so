# syntax=docker/dockerfile:1

# Option d'auto-hebergement du frontend. La cible principale reste Vercel (§6.1).
# Repose sur `output: "standalone"` defini dans next.config.ts.

# ---------- Stage 1 : dependances ----------
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- Stage 2 : build ----------
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Les variables NEXT_PUBLIC_* sont inlinees au BUILD : fournir des valeurs au build.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_BASE_URL
RUN npm run build

# ---------- Stage 3 : runtime ----------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN groupadd --system nodejs && useradd --system --gid nodejs nextjs

# Sortie standalone : serveur minimal + assets.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
