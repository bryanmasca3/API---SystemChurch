import { Router } from "express";
import Boom from "@hapi/boom";
import { crearCrudRouter } from "../crudRouter.js";
import {
  fondoController,
  categoriaFinancieraController,
  movimientoFinancieroController,
  cierreController,
  reporteController,
} from "../../controllers/finanzas.controller.js";
import {
  createFondoSchema,
  updateFondoSchema,
  listarFondoSchema,
  createCategoriaFinancieraSchema,
  updateCategoriaFinancieraSchema,
  listarCategoriaFinancieraSchema,
  createMovimientoFinancieroSchema,
  anularMovimientoSchema,
  listarMovimientoFinancieroSchema,
  cerrarMesSchema,
  periodoParamSchema,
  reabrirMesSchema,
  reporteMensualSchema,
  reporteAnualSchema,
  reporteDiezmosSchema,
} from "../../schemas/finanzas.schema.js";
import { idParamSchema } from "../../schemas/common.schema.js";
import validatorHandler from "../../middlewares/validatorHandler.js";
import { autorizar } from "../../middlewares/authMiddleware.js";

/**
 * /finanzas/fondos        caja, banco, misiones, fondos de departamento (con saldo)
 * /finanzas/categorias    categorías de ingresos "otros" y de egresos
 * /finanzas/movimientos   ingresos, egresos y transferencias (inmutables; se anulan)
 * /finanzas/cierres       cierre mensual
 * /finanzas/reportes      informe mensual, anual y diezmos
 */
const router = Router();
const leer = autorizar("finanzas", "leer");
const escribir = autorizar("finanzas", "escribir");
const validarId = validatorHandler(idParamSchema, "params");
const validarPeriodo = validatorHandler(periodoParamSchema, "params");

router.use(
  "/fondos",
  crearCrudRouter({
    modulo: "finanzas",
    controller: fondoController,
    schemas: { listar: listarFondoSchema, crear: createFondoSchema, actualizar: updateFondoSchema },
  }),
);

router.use(
  "/categorias",
  crearCrudRouter({
    modulo: "finanzas",
    controller: categoriaFinancieraController,
    schemas: {
      listar: listarCategoriaFinancieraSchema,
      crear: createCategoriaFinancieraSchema,
      actualizar: updateCategoriaFinancieraSchema,
    },
  }),
);

// Movimientos: sin PUT ni DELETE (se anulan)
router.get(
  "/movimientos",
  leer,
  validatorHandler(listarMovimientoFinancieroSchema, "query"),
  movimientoFinancieroController.listar,
);
router.get("/movimientos/:id", validarId, leer, movimientoFinancieroController.obtener);
router.post(
  "/movimientos",
  escribir,
  validatorHandler(createMovimientoFinancieroSchema, "body"),
  movimientoFinancieroController.crear,
);
router.post(
  "/movimientos/:id/anular",
  validarId,
  escribir,
  validatorHandler(anularMovimientoSchema, "body"),
  movimientoFinancieroController.anular,
);

// Cierres mensuales: contienen los saldos de todos los fondos, así que exigen acceso completo
const accesoCompleto = (req, res, next) =>
  req.alcance ? next(Boom.forbidden("Solo puedes consultar el fondo de tu departamento")) : next();
router.get("/cierres", leer, accesoCompleto, cierreController.listar);
router.get("/cierres/:periodo", validarPeriodo, leer, accesoCompleto, cierreController.obtener);
router.post("/cierres", escribir, validatorHandler(cerrarMesSchema, "body"), cierreController.cerrar);
router.post(
  "/cierres/:periodo/reabrir",
  validarPeriodo,
  autorizar("cierresReabrir", "escribir"),
  validatorHandler(reabrirMesSchema, "body"),
  cierreController.reabrir,
);

// Reportes
router.get("/reportes/mensual", leer, validatorHandler(reporteMensualSchema, "query"), reporteController.mensual);
router.get("/reportes/anual", leer, validatorHandler(reporteAnualSchema, "query"), reporteController.anual);
router.get(
  "/reportes/diezmos",
  autorizar("diezmos", "leer"),
  validatorHandler(reporteDiezmosSchema, "query"),
  reporteController.diezmos,
);

export default router;
