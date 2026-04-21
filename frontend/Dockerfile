FROM node:22-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Optional build-time overrides (primarily for offline mode via
# docker-compose.offline.yml). When empty, Vite falls back to the
# values in frontend/.env (if any) and to runtime defaults in the code.
ARG VITE_MAP_PROVIDER=""
ARG VITE_TILE_URL=""
ARG VITE_MAX_ZOOM=""
RUN touch .env.local \
    && { [ -n "$VITE_MAP_PROVIDER" ] && echo "VITE_MAP_PROVIDER=$VITE_MAP_PROVIDER" >> .env.local || :; } \
    && { [ -n "$VITE_TILE_URL" ] && echo "VITE_TILE_URL=$VITE_TILE_URL" >> .env.local || :; } \
    && { [ -n "$VITE_MAX_ZOOM" ] && echo "VITE_MAX_ZOOM=$VITE_MAX_ZOOM" >> .env.local || :; }

RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
