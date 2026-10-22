FROM node:24-bookworm-slim AS build

WORKDIR /build
COPY package.json ./
COPY app.js index.html styles.css robots.txt ./
COPY assets/ ./assets/
COPY content/event.json ./content/event.json
COPY scripts/build.mjs ./scripts/build.mjs
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
COPY --from=build /build/dist ./dist
COPY package.json ./package.json
COPY scripts/server.mjs ./scripts/server.mjs
COPY api/ ./api/
RUN mkdir -p /data && chown -R node:node /app /data

ENV NODE_ENV=production PORT=4173 DATABASE_PATH=/data/rsvp.sqlite
EXPOSE 4173
USER node
CMD ["npm", "start"]
