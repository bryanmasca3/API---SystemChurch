import http from "http";
import config from "./config/env.config.js";
import app from "./app.js";
import { connectDB, disconnectDB } from "./libs/mongoose.js";
import logger from "./libs/logger.js";
import { usuarioService } from "./controllers/usuario.controller.js";

// Primero la BD, luego se aceptan peticiones
await connectDB();
await usuarioService.asegurarAdminInicial();

const server = http.createServer(app);

server.listen(config.PORT, config.HOST, () => {
  logger.info(`Servidor en el puerto ${config.PORT} (${config.NODE_ENV})`);
});

// Cierre ordenado (Render/Heroku envían SIGTERM al redeployar)
const apagar = (senal) => {
  logger.info(`${senal} recibido, cerrando servidor...`);
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on("SIGTERM", () => apagar("SIGTERM"));
process.on("SIGINT", () => apagar("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error("Promesa rechazada sin manejar:", reason);
});
