# Stage 1: Build the React + TypeScript Frontend
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Default to relative /api/v1 inside Docker so Nginx proxies requests to utho-backend:8080
# across localhost, WSL2, or any remote cloud server IP/domain without CORS or rebuilds.
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

# Stage 2: Serve static bundle + reverse-proxy /api/v1 via Nginx (HTTP & HTTPS)
FROM nginx:1.27-alpine AS runtime

# Pre-generate fallback SSL certs so Nginx boots cleanly even without volume mounts
RUN mkdir -p /etc/nginx/ssl && \
    apk add --no-cache openssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/privkey.pem \
      -out /etc/nginx/ssl/fullchain.pem \
      -subj "/CN=utho.risvanth.online" && \
    apk del openssl

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80 443

HEALTHCHECK --interval=10s --timeout=4s --start-period=5s --retries=5 \
    CMD wget -qO- http://127.0.0.1:80/healthz >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
