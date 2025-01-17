FROM nginx:alpine

# Copia la configuración personalizada de Nginx
COPY conf.d /etc/nginx/conf.d

# Asegúrate de que los permisos sean correctos
RUN chmod -R 644 /etc/nginx/conf.d
