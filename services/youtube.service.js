const fs = require('fs');
const path = require('path');

// --- MAGIA PARA RENDER ---
let youtubedl;
if (fs.existsSync('/usr/local/bin/yt-dlp')) {
    const { create } = require('youtube-dl-exec');
    youtubedl = create('/usr/local/bin/yt-dlp');
    console.log("🟢 Usando motor yt-dlp de Render");
} else {
    youtubedl = require('youtube-dl-exec');
    console.log("💻 Usando motor yt-dlp local");
}
// -------------------------

// Asegurarnos de que la carpeta de descargas existe en la raíz
const downloadsDir = path.join(process.cwd(), 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}

const downloadMedia = async (videoId, format) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const outputFilename = `${videoId}_${Date.now()}.${format}`;
    const outputPath = path.join(downloadsDir, outputFilename);

    // Ruta donde guardaremos las cookies de forma segura en Render
    const cookiesPath = '/etc/secrets/cookies.txt';
    const hasCookies = fs.existsSync(cookiesPath);

    if (hasCookies) {
        console.log("🍪 Usando archivo de cookies de YouTube para la descarga");
    } else {
        console.log("⚠️ No se han detectado cookies. Podría fallar en Render");
    }

    // Opciones de descarga (con bypass de cookies si existe el archivo)
    const options = format === 'mp4' 
        ? {
            f: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            mergeOutputFormat: 'mp4',
            o: outputPath,
            noWarnings: true,
            extractorArgs: 'youtube:player_client=web_embedded',
            noCacheDir: true,
            ...(hasCookies ? { cookies: cookiesPath } : {}) // Solo añade las cookies si el archivo existe
        }
        : {
            x: true,
            audioFormat: 'mp3',
            o: outputPath,
            noWarnings: true,
            extractorArgs: 'youtube:player_client=web_embedded',
            noCacheDir: true,
            ...(hasCookies ? { cookies: cookiesPath } : {})
        };

    // Ejecutar la descarga
    await youtubedl(url, options);

    // Calcular el peso del archivo
    const stats = fs.statSync(outputPath);
    const fileSizeInMB = stats.size / (1024 * 1024);

    return { outputPath, outputFilename, fileSizeInMB };
};

module.exports = {
    downloadMedia,
    downloadsDir
};