ARG BUN_VERSION=1.4.4
FROM oven/bun:${BUN_VERSION} AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build


FROM oven/bun:${BUN_VERSION} AS runtime
WORKDIR /app
RUN apt-get update  \
    && apt-get install -y --no-install-recommends ca-certificates ffmpeg  \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    FOYER_DATABASE_PATH=/data/database/foyer.sqlite \
    FOYER_CACHE_PATH=/data/cache

COPY --from=build --chown=bun:bun /app/dist ./dist
COPY --from=build --chown=bun:bun /app/drizzle ./drizzle
COPY --from=build --chown=bun:bun /app/node_modules ./node_modules
RUN mkdir -p /data/database /data/cache && chown -R bun:bun /data
USER bun
EXPOSE 3000


CMD ["bun", "dist/server.js"]
