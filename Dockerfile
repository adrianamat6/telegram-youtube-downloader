# Usamos una imagen de Node ligera
FROM node:20-slim

# Instalamos Python, FFmpeg y Curl en el servidor de Render
RUN apt-get update && \
    apt-get install -y ffmpeg python3 curl && \
    rm -rf /var/lib/apt/lists/*

# Instalamos la última versión oficial de yt-dlp a nivel de sistema operativo
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Configuramos la carpeta de trabajo
WORKDIR /app

# Copiamos los archivos de dependencias e instalamos
COPY package*.json ./
# Aquí también ignoramos los scripts para que use el yt-dlp del sistema
RUN npm install

# Copiamos el resto de tu código
COPY . .

# Exponemos el puerto
EXPOSE 3000

# Arrancamos la aplicación
CMD ["node", "index.js"]