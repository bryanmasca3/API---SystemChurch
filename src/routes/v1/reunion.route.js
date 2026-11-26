import { crearCrudRouter } from "../crudRouter.js";
import { alcance } from "../../services/alcance.service.js";
import reunionController from "../../controllers/reunion.controller.js";
import {
  createReunionSchema,
  updateReunionSchema,
  listarReunionSchema,
  createAsistenteSchema,
  asistenteParamsSchema,
} from "../../schemas/reunion.schema.js";
import { idParamSchema } from "../../schemas/common.schema.js";
import validatorHandler from "../../middlewares/validatorHandler.js";
import { autorizar } from "../../middlewares/authMiddleware.js";

const validarId = validatorHandler(idParamSchema, "params");
const escribirAsistentes = autorizar("reuniones", "escribir", alcance.asistentesReunion);

export default crearCrudRouter({
  modulo: "reuniones",
  alcance: alcance.reunion,
  controller: reunionController,
  schemas: {
    listar: listarReunionSchema,
    crear: createReunionSchema,
    actualizar: updateReunionSchema,
  },
  // Asistentes: /reunion/:id/asistentes
  extra: (router) => {
    router.get("/:id/asistentes", validarId, reunionController.listarAsistentes);
    router.post(
      "/:id/asistentes",
      validarId,
      escribirAsistentes,
      validatorHandler(createAsistenteSchema, "body"),
      reunionController.agregarAsistente,
    );
    router.delete(
      "/:id/asistentes/:asistenteId",
      validatorHandler(asistenteParamsSchema, "params"),
      escribirAsistentes,
      reunionController.quitarAsistente,
    );
  },
});
