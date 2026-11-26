import { crearCrudController } from "./base.controller.js";
import PersonaService from "../services/persona.service.js";

const personaService = new PersonaService();

export default {
  ...crearCrudController(personaService),
  resumenDones: async (req, res) => res.json(await personaService.resumenDones()),
};
