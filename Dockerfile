FROM oven/bun:1.4.0 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/tv/package.json apps/tv/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1.4.0-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
VOLUME ["/app/data", "/media"]
EXPOSE 3000
CMD ["bun", "dist/server.js"]
