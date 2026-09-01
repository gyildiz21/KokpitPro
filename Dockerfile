FROM node:20-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY arayuz-onizleme.html ./
COPY kokpit ./kokpit
COPY scripts ./scripts
RUN npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    KOKPIT_DEPLOYMENT_MODE=cloud \
    KOKPIT_DATA_DIR=/data

WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/arayuz-onizleme.html ./arayuz-onizleme.html
COPY --from=build /app/kokpit/ui/map-flow.tsx ./kokpit/ui/map-flow.tsx

RUN mkdir -p /data && chown -R node:node /app /data
USER node

EXPOSE 4173
CMD ["node", "dist/server.js"]
