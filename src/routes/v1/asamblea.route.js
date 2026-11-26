import { crearCrudRouter } from "../crudRouter.js";
import asambleaController from "../../controllers/asamblea.controller.js";
import {
  createAsambleaSchema,
  updateAsambleaSchema,
  listarAsambleaSchema,
  asistenteAsambleaSchema,
  asistenteAsambleaParamsSchema,
  consultaHabilesSchema,
} from "../../schemas/asamblea.schema.js";
import { idParamSchema } from "../../schemas/common.schema.js";
import validatorHandler from "../../middlewares/validatorHandler.js";
import { autorizar } from "../../middlewares/authMiddleware.js";

const validarId = validatorHandler(idParamSchema, "params");
const escribir = autorizar("asambleas", "escribir");

/**
 * /asamblea                          CRUD (con quórum calculado)
 * /asamblea/habiles?fecha=           consulta libre de miembros hábiles
 * /asamblea/:id/habiles              padrón de hábiles de esa asamblea (con motivos)
 * /asamblea/:id/habiles/congelar     fija el padrón
 * /asamblea/:id/asistentes           registrar / quitar asistentes
 */
export default crearCrudRouter({
  modulo: "asambleas",
  controller: asambleaController,
  schemas: { listar: listarAsambleaSchema, crear: createAsambleaSchema, actualizar: updateAsambleaSchema },
  extra: (router) => {
    router.get("/habiles", validatorHandler(consultaHabilesSchema, "query"), asambleaController.consultarHabiles);
    router.get("/:id/habiles", validarId, asambleaController.habiles);
    router.post("/:id/habiles/congelar", validarId, escribir, asambleaController.congelar);
    router.post(
      "/:id/asistentes",
      validarId,
      escribir,
      validatorHandler(asistenteAsambleaSchema, "body"),
      asambleaController.registrarAsistente,
    );
    router.delete(
      "/:id/asistentes/:miembroId",
      validatorHandler(asistenteAsambleaParamsSchema, "params"),
      escribir,
      asambleaController.quitarAsistente,
    );
  },
});
