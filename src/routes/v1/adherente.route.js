import { crearCrudRouter } from "../crudRouter.js";
import adherenteController from "../../controllers/adherente.controller.js";
import {
  createAdherenteSchema,
  updateAdherenteSchema,
  listarAdherenteSchema,
} from "../../schemas/adherente.schema.js";

export default crearCrudRouter({
  modulo: "adherentes",
  controller: adherenteController,
  schemas: {
    listar: listarAdherenteSchema,
    crear: createAdherenteSchema,
    actualizar: updateAdherenteSchema,
  },
});
