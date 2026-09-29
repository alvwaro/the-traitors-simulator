# API Gateway. Construa a partir da raiz do repositório:
#   docker build -f gateway/Dockerfile .
FROM node:24-alpine AS build
WORKDIR /app
COPY shared/package.json shared/tsconfig.json shared/tsconfig.build.json shared/
COPY shared/src shared/src
COPY gateway/package.json gateway/package-lock.json gateway/
RUN npm ci --prefix gateway --ignore-scripts
COPY gateway/tsconfig.json gateway/tsconfig.build.json gateway/
COPY gateway/src gateway/src
RUN npm run build --prefix gateway \
 && npm prune --omit=dev --prefix gateway

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/shared/package.json shared/
COPY --from=build --chown=node:node /app/shared/dist shared/dist
COPY --from=build --chown=node:node /app/gateway/package.json gateway/
COPY --from=build --chown=node:node /app/gateway/node_modules gateway/node_modules
COPY --from=build --chown=node:node /app/gateway/dist gateway/dist
USER node
WORKDIR /app/gateway
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:8080/health/live || exit 1
CMD ["node", "dist/server.js"]
