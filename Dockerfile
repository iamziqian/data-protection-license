# Data Protection Platform - Multi-stage Docker Build
# Optimized for production deployment with security best practices

FROM node:18-alpine AS base

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S dataprotection && \
    adduser -S dataprotection -u 1001 -G dataprotection

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install dependencies stage
FROM base AS dependencies

# Install all dependencies
RUN npm ci --only=production && npm cache clean --force

# Development dependencies for building
FROM base AS dev-dependencies
RUN npm ci && npm cache clean --force

# Build stage
FROM dev-dependencies AS build

# Copy source code
COPY . .

# Run linting and tests
RUN npm run lint
RUN npm run test

# Build application (if applicable)
RUN npm run build 2>/dev/null || echo "No build script found, skipping..."

# Production stage
FROM base AS production

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy production dependencies
COPY --from=dependencies /app/node_modules ./node_modules

# Copy built application
COPY --from=build /app/src ./src
COPY --from=build /app/database ./database
COPY --from=build /app/examples ./examples
COPY --from=build /app/package*.json ./

# Create necessary directories
RUN mkdir -p logs deployments temp && \
    chown -R dataprotection:dataprotection /app

# Switch to non-root user
USER dataprotection

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "const http = require('http'); \
    const options = { hostname: 'localhost', port: process.env.PORT || 3000, path: '/health', timeout: 5000 }; \
    const req = http.request(options, (res) => { \
        if (res.statusCode === 200) process.exit(0); else process.exit(1); \
    }); \
    req.on('error', () => process.exit(1)); \
    req.on('timeout', () => { req.destroy(); process.exit(1); }); \
    req.end();"

# Expose port
EXPOSE 3000

# Add metadata labels
LABEL maintainer="Data Protection Platform Team" \
      version="1.0.0" \
      description="Machine-readable licensing protocol for data protection" \
      org.opencontainers.image.title="Data Protection Platform" \
      org.opencontainers.image.description="Cryptographic license validation with cross-platform deployment" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.created="2023-12-01T00:00:00Z" \
      org.opencontainers.image.revision="main" \
      org.opencontainers.image.licenses="MIT"

# Start application with dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/api/validation-server.js"]

# Multi-service Dockerfile for different components
# To build specific services:
# 
# Main API:
# docker build -t data-protection-api .
# 
# Compliance Monitor:
# docker build -t data-protection-monitor --target production .
# docker run data-protection-monitor node src/monitoring/compliance-monitor.js
# 
# CLI Tool:
# docker build -t data-protection-cli --target production .
# docker run data-protection-cli node src/index.js generate --type do-not-train
#
# Development:
# docker build -t data-protection-dev --target dev-dependencies .
# docker run -v $(pwd):/app data-protection-dev npm run dev
