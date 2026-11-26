import { Router } from "express";
import { listarBitacora } from "../../controllers/bitacora.controller.js";
import { listarBitacoraSchema } from "../../schemas/bitacora.schema.js";
import validatorHandler from "../../middlewares/validatorHandler.js";
import { autorizar } from "../../middlewares/authMiddleware.js";

/** Bitácora de auditoría: solo lectura, administradores y pastor. */
const router = Router();

router.get(
  "/",
  autorizar("bitacora", "leer"),
  validatorHandler(listarBitacoraSchema, "query"),
  listarBitacora,
);

export default router;
