FROM ghcr.io/puppeteer/puppeteer:latest

USER root

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar código fuente
COPY . .

# Exponer puerto
EXPOSE 8080

# Comando de inicio
CMD ["node", "server.js"]
