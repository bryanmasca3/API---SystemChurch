import { Router } from "express";
import { listarUbigeo, obtenerUbigeo } from "../../controllers/ubigeo.controller.js";
import {
  nivelUbigeoSchema,
  getUbigeoSchema,
  listarUbigeoSchema,
} from "../../schemas/ubigeo.schema.js";
import validatorHandler from "../../middlewares/validatorHandler.js";
import { autorizar } from "../../middlewares/authMiddleware.js";

/** Solo lectura: /ubigeo/:nivel?padre=...  y  /ubigeo/:nivel/:id */
const router = Router();

router.use(autorizar("ubigeo", "leer"));

router.get(
  "/:nivel",
  validatorHandler(nivelUbigeoSchema, "params"),
  validatorHandler(listarUbigeoSchema, "query"),
  listarUbigeo,
);
router.get("/:nivel/:id", validatorHandler(getUbigeoSchema, "params"), obtenerUbigeo);

export default router;
