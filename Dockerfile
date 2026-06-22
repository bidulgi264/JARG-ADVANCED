FROM node:24-bookworm-slim

WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public

ENV NODE_ENV=production
EXPOSE 10000

CMD ["npm", "start"]
