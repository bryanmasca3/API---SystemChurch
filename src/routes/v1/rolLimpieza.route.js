import { crearCrudRouter } from "../crudRouter.js";
import rolLimpiezaController from "../../controllers/rolLimpieza.controller.js";
import {
  createRolLimpiezaSchema,
  updateRolLimpiezaSchema,
  listarRolLimpiezaSchema,
} from "../../schemas/rolLimpieza.schema.js";

export default crearCrudRouter({
  modulo: "rolLimpieza",
  controller: rolLimpiezaController,
  schemas: {
    listar: listarRolLimpiezaSchema,
    crear: createRolLimpiezaSchema,
    actualizar: updateRolLimpiezaSchema,
  },
  // Próximo turno de limpieza
  extra: (router) => router.get("/actual", rolLimpiezaController.obtenerActual),
});
