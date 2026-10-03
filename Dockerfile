FROM node:22-alpine

WORKDIR /app

# Install production dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy application source
COPY tsconfig.json ./
COPY src/ ./src/

ENV NODE_ENV=production

# Start stdio MCP server for Glama introspection and local Docker execution
ENTRYPOINT ["node", "--experimental-strip-types", "src/stdio.ts"]
