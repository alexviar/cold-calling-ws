# Usa una imagen base de Node.js optimizada para producción
FROM node:20-alpine AS builder

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos necesarios para la construcción
COPY package.json package-lock.json ./

# Instala las dependencias, incluyendo las de desarrollo
RUN npm install --production=false

# Copia el resto de los archivos del proyecto
COPY . .

# Compila el proyecto TypeScript a JavaScript
RUN npm run build

# Usa una imagen base más ligera para producción
FROM node:20-alpine

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Instala FFmpeg
RUN apk add --no-cache ffmpeg

# Copia solo los archivos necesarios desde el builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Expone el puerto en el que correrá la aplicación
EXPOSE 3000

# Comando para ejecutar la aplicación
CMD ["node", "dist/index.js"]
