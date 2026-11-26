import { Router } from "express";
import { crearCrudRouter } from "../crudRouter.js";
import { alcance } from "../../services/alcance.service.js";
import { eventoController, calendarioController } from "../../controllers/calendario.controller.js";
import {
  createEventoSchema,
  updateEventoSchema,
  listarEventoSchema,
  calendarioSchema,
  misAsignacionesSchema,
} from "../../schemas/calendario.schema.js";
import validatorHandler from "../../middlewares/validatorHandler.js";
import { autorizar } from "../../middlewares/authMiddleware.js";

/**
 * /calendario                     cultos (con su programa) y eventos entre dos fechas
 * /calendario/mis-asignaciones    cuándo me toca dirigir, predicar o leer
 * /calendario/eventos             vigilias, campañas, retiros... (CRUD)
 */
const router = Router();

router.get("/", autorizar("calendario", "leer"), validatorHandler(calendarioSchema, "query"), calendarioController.ver);
router.get(
  "/mis-asignaciones",
  autorizar("calendario", "leer"),
  validatorHandler(misAsignacionesSchema, "query"),
  calendarioController.misAsignaciones,
);
router.use(
  "/eventos",
  crearCrudRouter({
    modulo: "calendario",
    alcance: alcance.evento,
    controller: eventoController,
    schemas: { listar: listarEventoSchema, crear: createEventoSchema, actualizar: updateEventoSchema },
  }),
);

export default router;
