FROM node:18-alpine

# workdir
WORKDIR /usr/src/app

# copiar solo package.json y package-lock.json de la carpeta backend
COPY backend/package*.json ./ 

# instalar dependencias de producción
RUN npm ci --only=production

# copiar el resto del backend
COPY backend/ ./

# asegúrate de usar PORT desde env
ENV PORT=3000
EXPOSE 3000

CMD ["node", "index.js"]