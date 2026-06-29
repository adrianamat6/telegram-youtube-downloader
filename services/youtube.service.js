const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

// --- CARPETA DE DESCARGAS ---
const downloadsDir = path.join(process.cwd(), 'downloads');

if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}

// 🧠 MAGIA: Función que busca servidores vivos de la comunidad en tiempo real
async function getCobaltInstances() {
    try {
        console.log("🔍 Buscando servidores Cobalt disponibles en la comunidad...");
        const response = await fetch("https://instances.cobalt.best/api/instances.json");
        const data = await response.json();
        
        // Filtramos solo los servidores que están online (y descartamos el oficial que pide API key)
        const activeInstances = data
            .filter(inst => inst.apiOnline === true && !inst.url.includes("api.cobalt.tools"))
            .map(inst => inst.url);
            
        return activeInstances;
    } catch (e) {
        console.warn("⚠️ No se pudo cargar la lista dinámica. Usando servidores de respaldo.");
        return [
            "https://cobalt.canine.tools",
            "https://cobalt.meowing.de",
            "https://co.wuk.sh"
        ];
    }
}

const downloadMedia = async (videoId, format) => {
    if (!['mp4', 'mp3'].includes(format)) {
        throw new Error(`Formato no soportado: ${format}`);
    }

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const baseName = `${videoId}_${Date.now()}`;
    const outputFilename = `${baseName}.${format}`;
    const outputPath = path.join(downloadsDir, outputFilename);

    console.log(`⬇️ Procesando video: ${videoId} en formato ${format}`);

    // Obtenemos los servidores frescos
    const instances = await getCobaltInstances();
    let directDownloadUrl = null;
    let lastError = null;

    // Probamos suerte con los servidores de la comunidad uno por uno
    for (const instance of instances) {
        console.log(`🧪 Intentando extraer con: ${instance}`);
        
        try {
            const apiResponse = await fetch(`${instance}/`, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                },
                body: JSON.stringify({
                    url: url,
                    downloadMode: format === 'mp3' ? 'audio' : 'auto',
                    audioFormat: format === 'mp3' ? 'mp3' : 'best',
                    videoQuality: "1080"
                })
            });

            if (!apiResponse.ok) {
                throw new Error(`HTTP ${apiResponse.status}`);
            }

            const data = await apiResponse.json();
            
            // Si nos da la URL, cortamos el bucle (¡Éxito!)
            if (data && data.url) {
                directDownloadUrl = data.url;
                console.log(`✅ ¡Enlace obtenido gracias a ${instance}!`);
                break; 
            }

        } catch (error) {
            console.warn(`⚠️ Servidor ${instance} ocupado o caído. Pasando al siguiente...`);
            lastError = error;
        }
    }

    if (!directDownloadUrl) {
        throw new Error(`Todos los servidores públicos están bloqueados en este momento. Intenta más tarde.`);
    }

    console.log("📥 Iniciando descarga del archivo físico a tu servidor Render...");

    try {
        const fileResponse = await fetch(directDownloadUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        
        if (!fileResponse.ok) {
            throw new Error(`Error HTTP ${fileResponse.status} al descargar el archivo.`);
        }

        const fileStream = fs.createWriteStream(outputPath);
        
        // Node 18+: Descargar el stream de la web directo al disco
        await pipeline(Readable.fromWeb(fileResponse.body), fileStream);

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