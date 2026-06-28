const express = require("express");
const cors = require("cors");
const bot = require("./config/bot");
const setupBotControllers = require("./controllers/bot.controller");
const { downloadsDir } = require("./services/youtube.service");

const app = express();
app.use(express.json());
app.use(cors());

// 1. Exponer la carpeta de descargas para videos largos
app.use('/descargas', express.static(downloadsDir));

// 2. Inicializar los comandos y acciones del bot
setupBotControllers(bot);

// 3. Configurar Telegram Webhook vs Local Polling
if (process.env.BOT_URL) {
    // Si estamos en Producción (Render), usamos Webhook de Telegram hacia una ruta oculta
    const webhookRoute = '/telegram-webhook';
    app.use(bot.webhookCallback(webhookRoute));
    bot.telegram.setWebhook(`${process.env.BOT_URL}${webhookRoute}`);
    console.log("Modo Webhook configurado");
} else {
    // Si estamos en desarrollo (Localhost), usamos Polling
    bot.launch();
    console.log("Modo local (Polling) configurado");
}

// Ruta por defecto para que Render no tire error 404 en el inicio
app.get("/", (req, res) => {
    res.send("¡El backend del Bot está activo! 🤖");
});

// Manejadores de errores de Express
app.use((req, res, next) => {
    res.status(404).json({ message: "Ruta no encontrada" });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: err.message });
});

// Habilitar cierre graceful del bot de telegram
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = app;