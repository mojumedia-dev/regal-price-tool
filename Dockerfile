FROM node:20-slim

# Install build tools for native modules + Chromium dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
  build-essential \
  python3 \
  ca-certificates \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils \
  wget \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --ignore-scripts
RUN npm rebuild better-sqlite3 --build-from-source
COPY . .

# Create db directory
RUN mkdir -p db

ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
