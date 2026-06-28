const http = require("node:http");
const app = require("./app");
require("dotenv").config();

const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en el puerto ${PORT}`);
});

server.on("error", (error) => {
    console.error("Error en el servidor:", error);
});