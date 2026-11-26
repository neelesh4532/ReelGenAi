FROM node:24-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# FFmpeg renders the videos; Liberation fonts stand in for Arial in the burned-in captions
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg fonts-liberation ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

RUN mkdir -p storage && chown -R node:node /app
USER node

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]