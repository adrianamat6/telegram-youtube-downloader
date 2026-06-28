const { Markup } = require('telegraf');
const fs = require('fs');
const { downloadMedia } = require('../services/youtube.service');

// Función de ayuda para extraer el ID de YouTube
function getYoutubeId(url) {
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Inyectamos el bot para configurarle los "listeners"
const setupBotControllers = (bot) => {
    
    // 1. Escuchar cualquier texto (buscando un enlace)
    bot.on('text', async (ctx) => {
        const text = ctx.message.text;
        const videoId = getYoutubeId(text);

        if (videoId) {
            await ctx.reply('🎬 He detectado un enlace de YouTube. ¿Qué quieres hacer?', 
                Markup.inlineKeyboard([
                    Markup.button.callback('📹 Descargar Video (MP4)', `dl_mp4|${videoId}`),
                    Markup.button.callback('🎵 Descargar Audio (MP3)', `dl_mp3|${videoId}`)
                ])
            );
        }
    });

    // 2. Escuchar la pulsación de los botones
    bot.action(/dl_(mp4|mp3)\|(.+)/, async (ctx) => {
        const format = ctx.match[1];
        const videoId = ctx.match[2];
        
        await ctx.answerCbQuery(); // Quita el icono de "cargando" en el botón pulsado
        const statusMsg = await ctx.reply('⏳ Iniciando la descarga... (Puede tardar si es largo)');

        try {
            // Llamamos a nuestro servicio
            const { outputPath, outputFilename, fileSizeInMB } = await downloadMedia(videoId, format);

            if (fileSizeInMB < 49) {
                // Telegram admite hasta 50MB por bot
                await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, '✅ Subiendo archivo directamente a Telegram...');
                
                if (format === 'mp4') {
                    await ctx.replyWithVideo({ source: outputPath });
                } else {
                    await ctx.replyWithAudio({ source: outputPath });
                }
                
                // Borramos el archivo local para no llenar el servidor
                fs.unlinkSync(outputPath);
            } else {
                // Si pesa más de 50MB, enviamos la URL de descarga directa generada por Express
                const botUrl = process.env.BOT_URL || 'http://localhost:3000';
                const downloadUrl = `${botUrl}/descargas/${outputFilename}`;
                
                await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, 
                    `✅ **Archivo procesado**\n\nPesa ${fileSizeInMB.toFixed(2)} MB (Límite de Telegram superado).\n\n👇 **Descárgalo desde tu servidor pulsando aquí:**\n${downloadUrl}`, 
                    { parse_mode: 'Markdown' }
                );
            }

        } catch (error) {
            console.error("Error al descargar:", error);
            await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, '❌ Hubo un error procesando el video.');
        }
    });
};

module.exports = setupBotControllers;