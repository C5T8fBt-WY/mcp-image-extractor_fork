FROM node:18-alpine

# Install dependencies for sharp image processing
RUN apk add --no-cache python3 make g++ vips-dev

WORKDIR /app

# Copy package.json and package-lock.json first for better caching
COPY package*.json ./

# Install TypeScript globally
RUN npm install -g typescript

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies for smaller image
RUN npm prune --production

# MCP_HTTP_PORT: set to enable HTTP/SSE transport (required for SSH remote use).
# Leave unset to use stdio transport (default, for local npx/node invocation).
ENV MCP_HTTP_PORT=3100
ENV MAX_IMAGE_SIZE=10485760
ENV ALLOWED_DOMAINS=""

# Start the server using stdio
RUN chown -R node:node /app
USER node
EXPOSE 3100
CMD ["node", "dist/index.js"]