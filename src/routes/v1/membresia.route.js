import { Router } from "express";
import { membresiaController } from "../../controllers/miembro.controller.js";
import {
  listarEventosSchema,
  resumenMembresiaSchema,
  padronSchema,
  crecimientoSchema,
} from "../../schemas/miembro.schema.js";
import validatorHandler from "../../middlewares/validatorHandler.js";
import { autorizar } from "../../middlewares/authMiddleware.js";

/** Movimiento de la membresía en toda la iglesia (el historial de uno está en /miembro/:id/historial). */
const router = Router();

router.use(autorizar("membresia", "leer"));
router.get("/eventos", validatorHandler(listarEventosSchema, "query"), membresiaController.listarEventos);
router.get("/resumen", validatorHandler(resumenMembresiaSchema, "query"), membresiaController.resumen);
router.get("/padron", validatorHandler(padronSchema, "query"), membresiaController.padron);
router.get("/crecimiento", validatorHandler(crecimientoSchema, "query"), membresiaController.crecimiento);

export default router;
