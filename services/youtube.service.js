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

    // Opciones de descarga que incluyen el truco del reproductor incrustado para burlar el antibot
    const options = format === 'mp4' 
        ? {
            f: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            mergeOutputFormat: 'mp4',
            o: outputPath,
            noWarnings: true,
            extractorArgs: 'youtube:player_client=web_embedded', // El truco mágico de bypass
            noCacheDir: true // Evita que se queden cacheados bloqueos
        }
        : {
            x: true,
            audioFormat: 'mp3',
            o: outputPath,
            noWarnings: true,
            extractorArgs: 'youtube:player_client=web_embedded', // El truco mágico de bypass
            noCacheDir: true
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