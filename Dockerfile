FROM oven/bun:1.3.12 AS builder

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile
RUN bunx prisma generate
RUN bun run build

FROM oven/bun:1.3.12 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app /app

EXPOSE 3000

CMD ["bun", "run", "start"]