const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

// --- CARPETA DE DESCARGAS ---
const downloadsDir = path.join(process.cwd(), 'downloads');

if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}

const downloadMedia = async (videoId, format) => {
    if (!['mp4', 'mp3'].includes(format)) {
        throw new Error(`Formato no soportado: ${format}`);
    }

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const baseName = `${videoId}_${Date.now()}`;
    const outputFilename = `${baseName}.${format}`;
    const outputPath = path.join(downloadsDir, outputFilename);

    console.log("⬇️ Pidiendo enlace a Cobalt API para:", url);

    try {
        // 1. Pedirle a la API gratuita de Cobalt que extraiga el vídeo/audio saltándose el bloqueo
        const apiResponse = await fetch("https://api.cobalt.tools/", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                url: url,
                // Si es mp3, pedimos modo audio. Si no, automático (video)
                downloadMode: format === 'mp3' ? 'audio' : 'auto',
                audioFormat: format === 'mp3' ? 'mp3' : 'best'
            })
        });

        if (!apiResponse.ok) {
            throw new Error(`Error de la API de extracción: ${apiResponse.status}`);
        }

        const data = await apiResponse.json();
        const directDownloadUrl = data.url;

        if (!directDownloadUrl) {
            throw new Error("La API no devolvió un enlace válido.");
        }

        console.log("✅ Enlace directo obtenido. Descargando archivo a disco local...");

        // 2. Descargar el archivo desde el enlace directo hacia nuestra carpeta /downloads
        const fileResponse = await fetch(directDownloadUrl);
        if (!fileResponse.ok) throw new Error(`Error al descargar el archivo: ${fileResponse.status}`);

        const fileStream = fs.createWriteStream(outputPath);
        
        // Usamos pipeline para guardar el archivo eficientemente en disco
        await pipeline(fileResponse.body, fileStream);

        // 3. Calcular el tamaño para saber si Telegram lo aceptará (Límite 50MB)
        const stats = fs.statSync(outputPath);
        const fileSizeInMB = stats.size / (1024 * 1024);

        console.log("✅ Archivo guardado:", outputPath);
        console.log("📦 Tamaño MB:", fileSizeInMB.toFixed(2));

        return {
            outputPath,
            outputFilename,
            fileSizeInMB,
        };

    } catch (error) {
        console.error("❌ Error en el proceso de descarga:", error.message);
        throw error;
    }
};

module.exports = {
    downloadMedia,
    downloadsDir,
};