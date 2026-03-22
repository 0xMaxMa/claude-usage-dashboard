FROM node:22-alpine

# Install build deps for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 13737

CMD ["node", "server.mjs"]
