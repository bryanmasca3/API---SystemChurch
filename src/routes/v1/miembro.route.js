import { crearCrudRouter } from "../crudRouter.js";
import miembroController from "../../controllers/miembro.controller.js";
import {
  createMiembroSchema,
  updateMiembroSchema,
  listarMiembroSchema,
  createEventoSchema,
  eventoParamsSchema,
} from "../../schemas/miembro.schema.js";
import { idParamSchema } from "../../schemas/common.schema.js";
import validatorHandler from "../../middlewares/validatorHandler.js";
import { autorizar } from "../../middlewares/authMiddleware.js";

const validarId = validatorHandler(idParamSchema, "params");

export default crearCrudRouter({
  modulo: "miembros",
  controller: miembroController,
  schemas: {
    listar: listarMiembroSchema,
    crear: createMiembroSchema,
    actualizar: updateMiembroSchema,
  },
  // Historial de membresía: /miembro/:id/historial
  extra: (router) => {
    router.get("/:id/historial", validarId, autorizar("membresia", "leer"), miembroController.historial);
    router.post(
      "/:id/historial",
      validarId,
      autorizar("membresia", "escribir"),
      validatorHandler(createEventoSchema, "body"),
      miembroController.registrarEvento,
    );
    router.delete(
      "/:id/historial/:eventoId",
      validatorHandler(eventoParamsSchema, "params"),
      autorizar("membresia", "escribir"),
      miembroController.deshacerEvento,
    );
  },
});
