# Multi-stage build for GymBuddy on Google Cloud Run
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build Vite frontend and Bundle Server with esbuild
RUN npm run build

# Production Runtime Image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Install fontconfig + copy bundled TTF fonts into system font directory
# This ensures @resvg/resvg-js can find fonts via loadSystemFonts: true on Alpine Linux
RUN apk add --no-cache fontconfig

COPY --from=builder /app/fonts/*.ttf /usr/share/fonts/truetype/
RUN fc-cache -fv

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/data ./data

# Cloud Run listens on $PORT (defaults to 8080)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

# Start production server
CMD ["node", "dist/server.cjs"]
