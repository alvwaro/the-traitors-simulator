# Site (build estático do Vite) servido pelo Nginx, que repassa /api ao gateway. Construa a partir da raiz:
#   docker build -f frontend/Dockerfile .
FROM node:26-alpine AS build
WORKDIR /app
COPY shared/package.json shared/tsconfig.json shared/
COPY shared/src shared/src
COPY frontend/package.json frontend/package-lock.json frontend/
RUN npm ci --prefix frontend --ignore-scripts
COPY frontend/index.html frontend/tsconfig.json frontend/vite.config.ts frontend/
COPY frontend/public frontend/public
COPY frontend/src frontend/src
RUN npm run build --prefix frontend

# Nginx sem privilégios de root (escuta na 8080).
FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
