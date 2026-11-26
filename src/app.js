import express from "express";
import cors from "cors";
import helmet from "helmet";
import Boom from "@hapi/boom";
import routes from "./routes/index.js";
import config from "./config/env.config.js";
import {
  notFoundPageHandler,
  logErrors,
  syntaxErrorHandler,
  ormErrorHandler,
  boomErrorHandler,
  errorHandler,
} from "./middlewares/errorHandler.js";

const app = express();

// Necesario detrás de un proxy (Render, Nginx...) para que req.ip sea la IP real
app.set("trust proxy", config.TRUST_PROXY);
app.disable("x-powered-by");

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  helmet({
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      // Peticiones sin Origin (Postman, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (config.CORS_ORIGINS.includes(origin)) return callback(null, true);
      callback(Boom.forbidden(`Origen no permitido por CORS: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Servidor funcionando" });
});

// Documentación interactiva: /api/docs (UI) y /api/docs.json (especificación OpenAPI)
if (config.SWAGGER_ENABLED) {
  const [{ default: swaggerUi }, { swaggerSpec }] = await Promise.all([
    import("swagger-ui-express"),
    import("./libs/swagger.js"),
  ]);
  // La UI usa estilos/imágenes inline: se relaja la CSP solo en esta ruta
  const cspDocs = helmet.contentSecurityPolicy({
    directives: {
      "img-src": ["'self'", "data:", "https:"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "upgrade-insecure-requests": null,
    },
  });
  app.get("/api/docs.json", (req, res) => res.json(swaggerSpec));
  app.use(
    "/api/docs",
    cspDocs,
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: "IEP API - Docs",
      swaggerOptions: { persistAuthorization: true, docExpansion: "none", filter: true },
    }),
  );
}

app.use("/api", routes);

app.use(notFoundPageHandler);

app.use(logErrors);
app.use(syntaxErrorHandler);
app.use(ormErrorHandler);
app.use(boomErrorHandler);
app.use(errorHandler);

export default app;
