# API e worker (a mesma imagem; o worker só muda o comando). Construa a partir da raiz do repositório:
#   docker build -f backend/Dockerfile .
FROM node:24-alpine AS build
WORKDIR /app
COPY shared/package.json shared/tsconfig.json shared/tsconfig.build.json shared/
COPY shared/src shared/src
COPY backend/package.json backend/package-lock.json backend/
RUN npm ci --prefix backend --ignore-scripts
COPY backend/tsconfig.json backend/
COPY backend/src backend/src
RUN npm run build --prefix backend \
 && npm prune --omit=dev --prefix backend

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/shared/package.json shared/
COPY --from=build --chown=node:node /app/shared/dist shared/dist
COPY --from=build --chown=node:node /app/backend/package.json backend/
COPY --from=build --chown=node:node /app/backend/node_modules backend/node_modules
COPY --from=build --chown=node:node /app/backend/dist backend/dist
# As migrações são .sql: o compilador não as copia para o dist.
COPY --chown=node:node backend/src/infrastructure/database/migrations backend/dist/infrastructure/database/migrations
USER node
WORKDIR /app/backend
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:3000/health/live || exit 1
CMD ["node", "dist/main/server.js"]
