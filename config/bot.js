const { Telegraf } = require('telegraf');
require('dotenv').config();

// Inicializamos el bot con el token
const bot = new Telegraf(process.env.BOT_TOKEN);

module.exports = bot;