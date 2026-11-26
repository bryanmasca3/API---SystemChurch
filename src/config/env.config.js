import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });

const NODE_ENV = process.env.NODE_ENV || "development";

// Acepta MONGO_URI (nombre actual) o MONGO_URL (nombre usado antes)
const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL;
const JWT_SECRET = process.env.TOKEN_JWT;

const required = { MONGO_URI, TOKEN_JWT: JWT_SECRET };
const missing = Object.entries(required)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length) {
  throw new Error(
    `Faltan variables de entorno obligatorias: ${missing.join(", ")}. Revisa el archivo .env (ver .env.example).`,
  );
}

const splitList = (value) =>
  (value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

export default {
  NODE_ENV,
  IS_PRODUCTION: NODE_ENV === "production",
  PORT: Number(process.env.PORT) || 9000,
  // Zona horaria de la iglesia: define a qué mes pertenece cada movimiento financiero
  ZONA_HORARIA: process.env.ZONA_HORARIA || "America/Lima",
  HOST: process.env.HOST || undefined,
  MONGO_URI,
  TOKEN: {
    JWT: JWT_SECRET,
    EXPIRES_IN: process.env.TOKEN_EXPIRES_IN || "24h",
  },
  BCRYPT_SALT_ROUNDS: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,
  DEFAULT_USER_PASSWORD: process.env.DEFAULT_USER_PASSWORD,
  CORS_ORIGINS: splitList(process.env.CORS_ORIGINS),
  // Administrador inicial: se crea al arrancar solo si no hay ningún administrador activo
  // (los roles y permisos están en src/config/permisos.js)
  ADMIN_INICIAL: {
    NOMBRE: process.env.ADMIN_NOMBRE || "Administrador",
    CORREO: process.env.ADMIN_CORREO,
    CONTRASENA: process.env.ADMIN_CONTRASENA,
  },
  // Número de proxies delante de la app (Render, Nginx...). Vacío = no confiar en X-Forwarded-For
  TRUST_PROXY: process.env.TRUST_PROXY
    ? Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY
    : false,
  // Criterios por defecto para ser miembro hábil en asamblea (se pueden cambiar en cada asamblea)
  HABILES: {
    MESES: Number(process.env.HABILES_MESES) || 6,
    EDAD_MINIMA: Number(process.env.HABILES_EDAD_MINIMA) || 18,
    ASISTENCIA_DOMINICAL_PCT: Number(process.env.HABILES_ASISTENCIA_PCT) || 50,
    SANTA_CENA_PCT: Number(process.env.HABILES_SANTA_CENA_PCT) || 50,
  },
  // Documentación Swagger en /api/docs. Por defecto activa salvo en producción
  SWAGGER_ENABLED: process.env.SWAGGER_ENABLED
    ? process.env.SWAGGER_ENABLED === "true"
    : NODE_ENV !== "production",
  LOGIN: {
    MAX_ATTEMPTS: Number(process.env.LOGIN_MAX_ATTEMPTS) || 5,
    WINDOW_MINUTES: Number(process.env.LOGIN_WINDOW_MINUTES) || 15,
  },
};
