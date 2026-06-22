FROM node:24-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-slim AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8787
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app ./

EXPOSE 8787

CMD ["npm", "run", "start", "--", "-p", "8787", "-H", "0.0.0.0"]
