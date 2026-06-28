const fs = require('fs');
const path = require('path');

// --- MOTOR yt-dlp ---
let youtubedl;
if (fs.existsSync('/usr/local/bin/yt-dlp')) {
    const { create } = require('youtube-dl-exec');
    youtubedl = create('/usr/local/bin/yt-dlp');
    console.log("🟢 Usando motor yt-dlp de Render");
} else {
    youtubedl = require('youtube-dl-exec');
    console.log("💻 Usando motor yt-dlp local");
}

// --- CARPETA DE DESCARGAS ---
const downloadsDir = path.join(process.cwd(), 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}

// --- COOKIES: copiarlas a /tmp/ para que yt-dlp pueda escribir ---
const SECRET_COOKIES = '/etc/secrets/cookies.txt';
const TMP_COOKIES = '/tmp/cookies.txt';

let cookiesPath = null;

if (fs.existsSync(SECRET_COOKIES)) {
    fs.copyFileSync(SECRET_COOKIES, TMP_COOKIES); // Copia a /tmp/ (tiene escritura)
    cookiesPath = TMP_COOKIES;
    console.log("🍪 Cookies copiadas a /tmp/ y listas para usar");
} else if (fs.existsSync(path.join(process.cwd(), 'cookies.txt'))) {
    cookiesPath = path.join(process.cwd(), 'cookies.txt');
    console.log("🍪 Usando cookies locales del proyecto");
} else {
    console.warn("⚠️ No se encontraron cookies. YouTube puede bloquear las descargas.");
}

const downloadMedia = async (videoId, format) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const outputFilename = `${videoId}_${Date.now()}.${format}`;
    const outputPath = path.join(downloadsDir, outputFilename);

    // Recopiar cookies en cada descarga por si se actualizan
    if (fs.existsSync(SECRET_COOKIES)) {
        fs.copyFileSync(SECRET_COOKIES, TMP_COOKIES);
    }

    const baseOptions = {
        o: outputPath,
        noWarnings: true,
        noCacheDir: true,
        // Formato más permisivo: acepta lo que haya disponible
        ...(cookiesPath && { cookies: cookiesPath })
    };

    const options = format === 'mp4'
        ? {
            ...baseOptions,
            // Formato más permisivo para evitar "not available"
            f: 'bestvideo+bestaudio/best',
            mergeOutputFormat: 'mp4',
        }
        : {
            ...baseOptions,
            x: true,
            audioFormat: 'mp3',
        };

    await youtubedl(url, options);

    const stats = fs.statSync(outputPath);
    const fileSizeInMB = stats.size / (1024 * 1024);

    return { outputPath, outputFilename, fileSizeInMB };
};

module.exports = {
    downloadMedia,
    downloadsDir
};