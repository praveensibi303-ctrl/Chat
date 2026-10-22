FROM node:18-alpine

WORKDIR /app

COPY server/package*.json ./
RUN npm ci --production

COPY server/ ./

EXPOSE 3001
CMD ["node", "index.js"]
