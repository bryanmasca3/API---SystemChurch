import { crearCrudRouter } from "../crudRouter.js";
import oficialController from "../../controllers/oficial.controller.js";
import { createOficialSchema, updateOficialSchema, listarOficialSchema } from "../../schemas/oficial.schema.js";

/** /oficial (periodos de pastores, ancianos y diáconos) y /oficial/consistorio (composición actual) */
export default crearCrudRouter({
  modulo: "oficiales",
  controller: oficialController,
  schemas: { listar: listarOficialSchema, crear: createOficialSchema, actualizar: updateOficialSchema },
  extra: (router) => router.get("/consistorio", oficialController.consistorio),
});
