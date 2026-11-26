import { crearCrudRouter } from "../crudRouter.js";
import { alcance } from "../../services/alcance.service.js";
import inventarioController from "../../controllers/inventario.controller.js";
import {
  createBienSchema,
  updateBienSchema,
  listarBienSchema,
  createMovimientoSchema,
  listarMovimientoSchema,
  listarPrestamoSchema,
  reporteAnualInventarioSchema,
} from "../../schemas/inventario.schema.js";
import { idParamSchema } from "../../schemas/common.schema.js";
import validatorHandler from "../../middlewares/validatorHandler.js";
import { autorizar } from "../../middlewares/authMiddleware.js";

const validarId = validatorHandler(idParamSchema, "params");

/**
 * /inventario                    CRUD de bienes
 * /inventario/resumen            totales para un tablero
 * /inventario/movimientos        historial general
 * /inventario/prestamos          préstamos (pendientes por defecto)
 * /inventario/:id/movimientos    historial de un bien y registrar movimientos
 */
export default crearCrudRouter({
  modulo: "inventario",
  alcance: alcance.bien,
  controller: inventarioController,
  schemas: { listar: listarBienSchema, crear: createBienSchema, actualizar: updateBienSchema },
  extra: (router) => {
    router.get("/resumen", inventarioController.resumen);
    router.get(
      "/reporte-anual",
      validatorHandler(reporteAnualInventarioSchema, "query"),
      inventarioController.reporteAnual,
    );
    router.get(
      "/movimientos",
      validatorHandler(listarMovimientoSchema, "query"),
      inventarioController.listarMovimientos,
    );
    router.get(
      "/prestamos",
      validatorHandler(listarPrestamoSchema, "query"),
      inventarioController.listarPrestamos,
    );
    router.get(
      "/:id/movimientos",
      validarId,
      validatorHandler(listarMovimientoSchema, "query"),
      inventarioController.listarMovimientosDeBien,
    );
    router.post(
      "/:id/movimientos",
      validarId,
      autorizar("inventario", "escribir", alcance.movimientoBien),
      validatorHandler(createMovimientoSchema, "body"),
      inventarioController.registrarMovimiento,
    );
  },
});
