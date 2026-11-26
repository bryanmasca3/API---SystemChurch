import { Router } from "express";
import validatorHandler from "../middlewares/validatorHandler.js";
import { autorizar } from "../middlewares/authMiddleware.js";
import { idParamSchema } from "../schemas/common.schema.js";

/**
 * Router CRUD estándar con permisos según src/config/permisos.js:
 *   GET    /        listar      (permiso "leer";  query validada si se indica `schemas.listar`)
 *   GET    /:id     obtener     (permiso "leer")
 *   POST   /        crear       (permiso "escribir")
 *   PUT    /:id     actualizar  (permiso "escribir")
 *   DELETE /:id     eliminar    (permiso "escribir")
 *
 * @param {string}   opciones.modulo      Clave de PERMISOS.
 * @param {Function} [opciones.alcance]   Resolvedor de departamento para roles que solo
 *                                        escriben en su departamento (ver alcance.service.js).
 * @param {Function} [opciones.extra]     Registra rutas adicionales ANTES de /:id
 *                                        (para que /actual o /resumen no choquen con /:id).
 */
export const crearCrudRouter = ({ modulo, controller, schemas, extra, alcance }) => {
  const router = Router();
  const validarId = validatorHandler(idParamSchema, "params");
  const escribir = autorizar(modulo, "escribir", alcance);

  router.use(autorizar(modulo, "leer"));

  if (extra) extra(router);

  router.get(
    "/",
    ...(schemas.listar ? [validatorHandler(schemas.listar, "query")] : []),
    controller.listar,
  );
  router.get("/:id", validarId, controller.obtener);
  router.post("/", escribir, validatorHandler(schemas.crear, "body"), controller.crear);
  router.put(
    "/:id",
    validarId,
    escribir,
    validatorHandler(schemas.actualizar, "body"),
    controller.actualizar,
  );
  router.delete("/:id", validarId, escribir, controller.eliminar);

  return router;
};
