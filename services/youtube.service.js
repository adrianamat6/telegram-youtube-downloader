const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

// --- CARPETA DE DESCARGAS ---
const downloadsDir = path.join(process.cwd(), 'downloads');

if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}

// Lista de instancias de Cobalt. Si la oficial nos bloquea, probamos las alternativas de la comunidad.
const COBALT_INSTANCES = [
    "https://api.cobalt.tools/",
    "https://cobalt.api.timelessnesses.me/"
];

const downloadMedia = async (videoId, format) => {
    if (!['mp4', 'mp3'].includes(format)) {
        throw new Error(`Formato no soportado: ${format}`);
    }

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const baseName = `${videoId}_${Date.now()}`;
    const outputFilename = `${baseName}.${format}`;
    const outputPath = path.join(downloadsDir, outputFilename);

    console.log(`⬇️ Pidiendo enlace a Cobalt API para: ${url} en formato ${format}`);

    let directDownloadUrl = null;
    let lastError = null;

    // Intentamos extraer el enlace pasando por las distintas instancias de Cobalt
    for (const instance of COBALT_INSTANCES) {
        console.log(`🧪 Probando con la instancia: ${instance}`);
        
        try {
            const apiResponse = await fetch(instance, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    // Engañamos al sistema haciéndonos pasar por un usuario real en Windows
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                },
                body: JSON.stringify({
                    url: url,
                    // Parámetros API v7 (Actual)
                    downloadMode: format === 'mp3' ? 'audio' : 'auto',
                    audioFormat: format === 'mp3' ? 'mp3' : 'best',
                    videoQuality: "1080",
                    
                    // Parámetros API v6 (Por si la instancia espejo usa software más antiguo)
                    isAudioOnly: format === 'mp3',
                    aFormat: format === 'mp3' ? 'mp3' : 'best',
                    vQuality: "1080"
                })
            });

            // Si la API falla, extraemos el texto EXACTO del error
            if (!apiResponse.ok) {
                const errorText = await apiResponse.text();
                throw new Error(`HTTP ${apiResponse.status} - Detalles: ${errorText}`);
            }

            const data = await apiResponse.json();
            
            // Si nos da la URL, salimos del bucle con éxito
            if (data && data.url) {
                directDownloadUrl = data.url;
                console.log(`✅ ¡Éxito con ${instance}!`);
                break; 
            } else {
                throw new Error("La API respondió, pero sin enlace. Respuesta: " + JSON.stringify(data));
            }

        } catch (error) {
            console.warn(`⚠️ Falló la instancia ${instance}: ${error.message}`);
            lastError = error;
        }
    }

    // Si fallaron TODAS las instancias, tiramos el error para que avise a Telegram
    if (!directDownloadUrl) {
        throw new Error(`Todas las instancias de Cobalt fallaron. Último error: ${lastError?.message}`);
    }

    console.log("✅ Iniciando descarga del archivo a disco local...");

    try {
        // Descargamos el archivo real desde la URL obtenida (añadiendo también el User-Agent)
        const fileResponse = await fetch(directDownloadUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        
        if (!fileResponse.ok) {
            throw new Error(`Error HTTP ${fileResponse.status} al descargar el archivo físico.`);
        }

        // Lo guardamos en Render
        const fileStream = fs.createWriteStream(outputPath);
        await pipeline(fileResponse.body, fileStream);

        const stats = fs.statSync(outputPath);
        const fileSizeInMB = stats.size / (1024 * 1024);

        console.log("✅ Archivo guardado correctamente:", outputPath);
        console.log("📦 Tamaño MB:", fileSizeInMB.toFixed(2));

        return {
            outputPath,
            outputFilename,
            fileSizeInMB,
        };

    } catch (error) {
        console.error("❌ Error en la descarga del archivo físico:", error.message);
        throw error;
    }
};

module.exports = {
    downloadMedia,
    downloadsDir,
};