# -- Build stage --
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev

# -- Production stage --
FROM node:20-alpine
LABEL maintainer="store-platform"

# Install Helm and kubectl via apk
RUN apk add --no-cache helm kubectl openssl

# Security: run as non-root
RUN addgroup -g 1001 -S appgroup && \
  adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

# Copy dependencies
COPY --from=builder /app/node_modules ./node_modules

# Copy source
COPY backend/src/ ./src/
# Copy Helm charts
COPY helm/ ./helm/
RUN ls -laR /app/helm/

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); const req = http.get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1));"

CMD ["node", "src/app.js"]
