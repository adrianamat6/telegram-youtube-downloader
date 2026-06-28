const fs = require('fs');
const path = require('path');
const os = require('os');

// --- MOTOR yt-dlp ---
let youtubedl;

const RENDER_YTDLP_PATH = '/usr/local/bin/yt-dlp';

if (fs.existsSync(RENDER_YTDLP_PATH)) {
    const { create } = require('youtube-dl-exec');
    youtubedl = create(RENDER_YTDLP_PATH);
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

// --- COOKIES ---
// En Render, los Secret Files se leen desde /etc/secrets/
// PERO esa carpeta es de solo lectura.
// Por eso copiamos cookies.txt a /tmp/cookies.txt antes de usar yt-dlp.
const SECRET_COOKIES = '/etc/secrets/cookies.txt';
const LOCAL_COOKIES = path.join(process.cwd(), 'cookies.txt');
const TMP_COOKIES = path.join(os.tmpdir(), 'cookies.txt');

function prepareCookiesFile() {
    try {
        // Caso Render: Secret File llamado cookies.txt
        if (fs.existsSync(SECRET_COOKIES)) {
            fs.copyFileSync(SECRET_COOKIES, TMP_COOKIES);

            try {
                fs.chmodSync(TMP_COOKIES, 0o600);
            } catch (e) {
                // No pasa nada si chmod falla en local/Windows
            }

            console.log(`🍪 Cookies de Render copiadas a ${TMP_COOKIES}`);
            return TMP_COOKIES;
        }

        // Caso local: archivo cookies.txt en la raíz del proyecto
        if (fs.existsSync(LOCAL_COOKIES)) {
            fs.copyFileSync(LOCAL_COOKIES, TMP_COOKIES);

            try {
                fs.chmodSync(TMP_COOKIES, 0o600);
            } catch (e) {
                // No pasa nada si chmod falla en local/Windows
            }

            console.log(`🍪 Cookies locales copiadas a ${TMP_COOKIES}`);
            return TMP_COOKIES;
        }

        console.warn("⚠️ No se encontraron cookies. YouTube puede bloquear la descarga.");
        return null;

    } catch (error) {
        console.error("❌ Error preparando cookies:", error.message);
        return null;
    }
}

function findGeneratedFile(baseName, expectedExt) {
    const expectedPath = path.join(downloadsDir, `${baseName}.${expectedExt}`);

    if (fs.existsSync(expectedPath)) {
        return expectedPath;
    }

    const files = fs
        .readdirSync(downloadsDir)
        .filter((file) => file.startsWith(`${baseName}.`));

    if (files.length === 0) {
        throw new Error(`No se encontró el archivo generado para ${baseName}`);
    }

    const preferredFile =
        files.find((file) => file.endsWith(`.${expectedExt}`)) || files[0];

    return path.join(downloadsDir, preferredFile);
}

const downloadMedia = async (videoId, format) => {
    if (!['mp4', 'mp3'].includes(format)) {
        throw new Error(`Formato no soportado: ${format}`);
    }

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const baseName = `${videoId}_${Date.now()}`;
    const outputTemplate = path.join(downloadsDir, `${baseName}.%(ext)s`);

    // MUY IMPORTANTE:
    // yt-dlp nunca debe usar directamente /etc/secrets/cookies.txt
    // Siempre debe usar la copia escribible de /tmp/cookies.txt
    const cookiesPath = prepareCookiesFile();

    const baseOptions = {
        o: outputTemplate,
        noWarnings: true,
        noCacheDir: true,
        retries: 3,
        fragmentRetries: 3,
        socketTimeout: 30,

        ...(cookiesPath && { cookies: cookiesPath }),

        // Ayuda a evitar algunos bloqueos de YouTube
        extractorArgs: 'youtube:player_client=web_embedded',
    };

    const options = format === 'mp4'
        ? {
            ...baseOptions,
            f: 'bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b[ext=mp4]/b',
            mergeOutputFormat: 'mp4',
        }
        : {
            ...baseOptions,
            f: 'bestaudio/best',
            x: true,
            audioFormat: 'mp3',
            audioQuality: 0,
        };

    console.log("⬇️ Descargando:", url);
    console.log("📦 Formato:", format);
    console.log("🍪 yt-dlp usará cookies desde:", cookiesPath || "SIN COOKIES");
    console.log("📁 Plantilla de salida:", outputTemplate);

    try {
        await youtubedl(url, options);
    } catch (error) {
        console.error("❌ Error ejecutando yt-dlp");

        if (error.stderr) {
            console.error("STDERR yt-dlp:", error.stderr);
        }

        if (error.stdout) {
            console.error("STDOUT yt-dlp:", error.stdout);
        }

        throw error;
    }

    const outputPath = findGeneratedFile(baseName, format);
    const outputFilename = path.basename(outputPath);

    const stats = fs.statSync(outputPath);
    const fileSizeInMB = stats.size / (1024 * 1024);

    console.log("✅ Archivo generado:", outputPath);
    console.log("📦 Tamaño MB:", fileSizeInMB.toFixed(2));

    return {
        outputPath,
        outputFilename,
        fileSizeInMB,
    };
};

module.exports = {
    downloadMedia,
    downloadsDir,
};