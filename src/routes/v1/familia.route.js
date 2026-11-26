import { crearCrudRouter } from "../crudRouter.js";
import familiaController from "../../controllers/familia.controller.js";
import {
  createFamiliaSchema,
  updateFamiliaSchema,
  listarFamiliaSchema,
  integranteFamiliaSchema,
  parentescoSchema,
  integranteParamsFamiliaSchema,
} from "../../schemas/familia.schema.js";
import { idParamSchema } from "../../schemas/common.schema.js";
import validatorHandler from "../../middlewares/validatorHandler.js";
import { autorizar } from "../../middlewares/authMiddleware.js";

const escribir = autorizar("familias", "escribir");
const validarIntegrante = validatorHandler(integranteParamsFamiliaSchema, "params");

/** /familia (CRUD) y /familia/:id/integrantes[/:personaId] */
export default crearCrudRouter({
  modulo: "familias",
  controller: familiaController,
  schemas: { listar: listarFamiliaSchema, crear: createFamiliaSchema, actualizar: updateFamiliaSchema },
  extra: (router) => {
    router.post(
      "/:id/integrantes",
      validatorHandler(idParamSchema, "params"),
      escribir,
      validatorHandler(integranteFamiliaSchema, "body"),
      familiaController.agregarIntegrante,
    );
    router.put(
      "/:id/integrantes/:personaId",
      validarIntegrante,
      escribir,
      validatorHandler(parentescoSchema, "body"),
      familiaController.cambiarParentesco,
    );
    router.delete("/:id/integrantes/:personaId", validarIntegrante, escribir, familiaController.quitarIntegrante);
  },
});
