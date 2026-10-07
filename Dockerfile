FROM node:22-bookworm-slim

# Install system dependencies needed for compiling native modules (sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests first to leverage Docker layer caching
COPY package*.json ./

# Install dependencies and build native bindings from source to avoid GLIBC mismatch with prebuilt binaries
RUN npm install --omit=dev --build-from-source=sqlite3

# Copy application source code
COPY . .

# Ensure cache directories exist
RUN mkdir -p cache/covers cache/synopsis

# Expose default application port
EXPOSE 3100

ENV NODE_ENV=production
ENV PORT=3100

CMD ["node", "server.js"]
