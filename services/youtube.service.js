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
                // Ignorar si chmod falla
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
                // Ignorar si chmod falla
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

function buildBaseOptions(outputTemplate, cookiesPath, extractorArgs) {
    return {
        o: outputTemplate,

        noWarnings: true,
        noCacheDir: true,

        retries: 5,
        fragmentRetries: 5,
        socketTimeout: 30,

        // Cookies: SIEMPRE usamos /tmp/cookies.txt, nunca /etc/secrets directamente
        ...(cookiesPath && { cookies: cookiesPath }),

        // Intentos anti-bloqueo suaves: headers parecidos a navegador real
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        referer: 'https://www.youtube.com/',
        addHeader: [
            'Accept-Language: es-ES,es;q=0.9,en;q=0.8',
            'Origin: https://www.youtube.com'
        ],

        // Cliente de YouTube que probaremos en cada intento
        extractorArgs,
    };
}

function buildOptions(format, baseOptions) {
    if (format === 'mp4') {
        return {
            ...baseOptions,

            // Más permisivo: primero mp4+m4a, luego cualquier video+audio, luego best
            f: 'bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b[ext=mp4]/b',
            mergeOutputFormat: 'mp4',
        };
    }

    return {
        ...baseOptions,

        // Audio
        f: 'bestaudio/best',
        x: true,
        audioFormat: 'mp3',
        audioQuality: 0,
    };
}

function isYoutubeBotError(error) {
    const stderr = error && error.stderr ? String(error.stderr) : '';
    const message = error && error.message ? String(error.message) : '';

    return (
        stderr.includes("Sign in to confirm you’re not a bot") ||
        stderr.includes("Sign in to confirm you're not a bot") ||
        message.includes("Sign in to confirm you’re not a bot") ||
        message.includes("Sign in to confirm you're not a bot")
    );
}

const downloadMedia = async (videoId, format) => {
    if (!['mp4', 'mp3'].includes(format)) {
        throw new Error(`Formato no soportado: ${format}`);
    }

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const baseName = `${videoId}_${Date.now()}`;
    const outputTemplate = path.join(downloadsDir, `${baseName}.%(ext)s`);

    const cookiesPath = prepareCookiesFile();

    console.log("⬇️ Descargando:", url);
    console.log("📦 Formato:", format);
    console.log("🍪 yt-dlp usará cookies desde:", cookiesPath || "SIN COOKIES");
    console.log("📁 Plantilla de salida:", outputTemplate);

    // Probamos varios clientes. Si uno cae por anti-bot, intenta el siguiente.
    const extractorAttempts = [
        'youtube:player_client=android_vr,web_safari,web',
        'youtube:player_client=web_safari,web',
        'youtube:player_client=android_vr',
        'youtube:player_client=web'
    ];

    let lastError = null;

    for (const extractorArgs of extractorAttempts) {
        const baseOptions = buildBaseOptions(outputTemplate, cookiesPath, extractorArgs);
        const options = buildOptions(format, baseOptions);

        console.log("🧪 Probando extractorArgs:", extractorArgs);

        try {
            await youtubedl(url, options);
            lastError = null;
            break;

        } catch (error) {
            lastError = error;

            console.error("❌ Error ejecutando yt-dlp con:", extractorArgs);

            if (error.stderr) {
                console.error("STDERR yt-dlp:", error.stderr);
            }

            if (error.stdout) {
                console.error("STDOUT yt-dlp:", error.stdout);
            }

            // Si es el error anti-bot, probamos el siguiente cliente
            if (isYoutubeBotError(error)) {
                console.warn("⚠️ YouTube ha pedido confirmar que no eres un bot. Probando otro cliente...");
                continue;
            }

            // Si es otro error diferente, no seguimos probando
            throw error;
        }
    }

    if (lastError) {
        console.error("❌ Todos los intentos fallaron.");
        throw lastError;
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