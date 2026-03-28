# ConfEval Frontend - Production Dockerfile
# Node 22 LTS + Next.js 16

# =============================================================================
# Stage 1: Dependencies
# =============================================================================
FROM node:25-alpine AS deps

WORKDIR /app

# Install libc6-compat for Alpine compatibility
RUN apk add --no-cache libc6-compat


# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci
RUN npm audit fix
RUN npm fund

# =============================================================================
# Stage 2: Builder
# =============================================================================
FROM node:25-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY . .

# Set build-time environment variables
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build
RUN npm audit fix
RUN npm fund
# =============================================================================
# Stage 3: Production Runner
# =============================================================================
FROM node:25-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Install libc6-compat for runtime
RUN apk add --no-cache libc6-compat


# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy the standalone build (includes node_modules, server.js, etc.)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static assets that standalone output does NOT include
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# Start the application
CMD ["node", "server.js"]
