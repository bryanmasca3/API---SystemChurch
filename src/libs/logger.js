import config from "../config/env.config.js";

const timestamp = () => new Date().toISOString();
const EN_PRUEBAS = config.NODE_ENV === "test";
const nada = () => {};

/**
 * Logger centralizado: permite cambiar a winston/pino sin tocar el resto del código.
 * En pruebas (NODE_ENV=test) solo se muestran los errores.
 */
const logger = {
  info: EN_PRUEBAS ? nada : (...args) => console.log(`[${timestamp()}] INFO`, ...args),
  warn: EN_PRUEBAS ? nada : (...args) => console.warn(`[${timestamp()}] WARN`, ...args),
  error: (...args) => console.error(`[${timestamp()}] ERROR`, ...args),
  debug: config.IS_PRODUCTION || EN_PRUEBAS ? nada : (...args) => console.debug(`[${timestamp()}] DEBUG`, ...args),
};

export default logger;
