import { crearCrudRouter } from "../crudRouter.js";
import { alcance } from "../../services/alcance.service.js";
import departamentoController from "../../controllers/departamento.controller.js";
import {
  createDepartamentoSchema,
  updateDepartamentoSchema,
  createIntegranteSchema,
  updateIntegranteSchema,
  integranteParamsSchema,
  createInscripcionSchema,
  updateInscripcionSchema,
  listarInscripcionSchema,
  inscripcionParamsSchema,
} from "../../schemas/departamento.schema.js";
import { idParamSchema } from "../../schemas/common.schema.js";
import validatorHandler from "../../middlewares/validatorHandler.js";
import { autorizar } from "../../middlewares/authMiddleware.js";

const validarId = validatorHandler(idParamSchema, "params");
const validarIntegrante = validatorHandler(integranteParamsSchema, "params");
// Integrantes: secretaría/administración, o el líder del propio departamento
const escribirIntegrantes = autorizar("integrantes", "escribir", alcance.integrantes);

export default crearCrudRouter({
  modulo: "departamentos",
  controller: departamentoController,
  schemas: { crear: createDepartamentoSchema, actualizar: updateDepartamentoSchema },
  // Integrantes: /departamento/:id/integrantes
  extra: (router) => {
    router.get("/:id/integrantes", validarId, departamentoController.listarIntegrantes);
    router.post(
      "/:id/integrantes",
      validarId,
      escribirIntegrantes,
      validatorHandler(createIntegranteSchema, "body"),
      departamentoController.agregarIntegrante,
    );
    router.put(
      "/:id/integrantes/:integranteId",
      validarIntegrante,
      escribirIntegrantes,
      validatorHandler(updateIntegranteSchema, "body"),
      departamentoController.actualizarIntegrante,
    );
    router.delete(
      "/:id/integrantes/:integranteId",
      validarIntegrante,
      escribirIntegrantes,
      departamentoController.quitarIntegrante,
    );

    // Inscritos (niños, adolescentes, jóvenes; miembros o no): mismo permiso que integrantes
    const validarInscripcion = validatorHandler(inscripcionParamsSchema, "params");
    router.get(
      "/:id/inscritos",
      validarId,
      validatorHandler(listarInscripcionSchema, "query"),
      departamentoController.listarInscritos,
    );
    router.post(
      "/:id/inscritos",
      validarId,
      escribirIntegrantes,
      validatorHandler(createInscripcionSchema, "body"),
      departamentoController.inscribir,
    );
    router.put(
      "/:id/inscritos/:inscripcionId",
      validarInscripcion,
      escribirIntegrantes,
      validatorHandler(updateInscripcionSchema, "body"),
      departamentoController.actualizarInscripcion,
    );
    router.delete(
      "/:id/inscritos/:inscripcionId",
      validarInscripcion,
      escribirIntegrantes,
      departamentoController.eliminarInscripcion,
    );
  },
});
