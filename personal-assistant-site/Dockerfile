FROM node:24-slim

WORKDIR /app

ENV PORT=8787

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

ENV NODE_ENV=production

EXPOSE 8787

CMD ["npm", "start", "--", "-p", "8787", "-H", "0.0.0.0"]
