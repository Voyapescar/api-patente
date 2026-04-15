FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

# Saltamos la descarga de Chrome para ahorrar 200MB de download y tiempo
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Copiamos solo lo necesario para el install
COPY package.json ./

# Instalamos solo lo esencial de producción rápidamente
RUN npm install --omit=dev --no-audit --no-fund

# Copiamos el resto del código (server.js)
COPY . .

EXPOSE 8080
CMD ["node", "server.js"]
