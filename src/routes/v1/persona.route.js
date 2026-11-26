import { crearCrudRouter } from "../crudRouter.js";
import personaController from "../../controllers/persona.controller.js";
import {
  createPersonaSchema,
  updatePersonaSchema,
  listarPersonaSchema,
} from "../../schemas/persona.schema.js";

export default crearCrudRouter({
  modulo: "personas",
  controller: personaController,
  schemas: {
    listar: listarPersonaSchema,
    crear: createPersonaSchema,
    actualizar: updatePersonaSchema,
  },
  // Registro de dones, capacidades y profesiones
  extra: (router) => router.get("/dones", personaController.resumenDones),
});
