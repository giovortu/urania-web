FROM node:22-bookworm-slim

# Install system dependencies (build tools for sqlite3 native bindings if needed, curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests first to leverage Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application source code
COPY . .

# Ensure cache directories exist
RUN mkdir -p cache/covers cache/synopsis

# Expose default application port
EXPOSE 3100

ENV NODE_ENV=production
ENV PORT=3100

CMD ["node", "server.js"]
