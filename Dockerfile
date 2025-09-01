# Step 1: Build Stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Step 2: Production Stage
FROM node:18-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Copy only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy the built application from the builder stage
COPY --from=builder --chown=nodeuser:nodejs /app /app

# Change ownership of the app directory
RUN chown -R nodeuser:nodejs /app

# Switch to non-root user
USER nodeuser

# Expose the application port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:5000/health', (res) => { res.statusCode === 200 ? process.exit(0) : process.exit(1); }).on('error', () => process.exit(1));"

# Start the application with dumb-init for proper signal handling
CMD ["dumb-init", "node", "src/index.js"]