FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

# Saltamos la descarga de Chrome porque ya está en la imagen base
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package*.json ./
RUN npm install --only=production

COPY . .

EXPOSE 8080
CMD ["node", "server.js"]
