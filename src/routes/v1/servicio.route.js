import { crearCrudRouter } from "../crudRouter.js";
import servicioController from "../../controllers/servicio.controller.js";
import { createServicioSchema, updateServicioSchema } from "../../schemas/servicio.schema.js";

export default crearCrudRouter({
  modulo: "servicios",
  controller: servicioController,
  schemas: { crear: createServicioSchema, actualizar: updateServicioSchema },
});
