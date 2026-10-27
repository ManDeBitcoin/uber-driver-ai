# Imagen para Umbrel OS y Coolify (build pack Dockerfile, puerto 80, healthcheck /health).

# Etapa 1: Compilar la aplicación React + TypeScript con Vite
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm ci

# Copiar código fuente y compilar bundle de producción
COPY . .
RUN npm run build

# Etapa 2: Servir con Nginx Alpine ultra ligero
FROM nginx:alpine

# Copiar artefactos compilados
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuración de Nginx optimizada para SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
