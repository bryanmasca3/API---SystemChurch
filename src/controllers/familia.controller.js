import { crearCrudController } from "./base.controller.js";
import FamiliaService from "../services/familia.service.js";

const familiaService = new FamiliaService();

export default {
  ...crearCrudController(familiaService),
  agregarIntegrante: async (req, res) =>
    res.status(201).json(await familiaService.agregarIntegrante(req.params.id, req.body)),
  cambiarParentesco: async (req, res) =>
    res.json(await familiaService.cambiarParentesco(req.params.id, req.params.personaId, req.body.parentesco)),
  quitarIntegrante: async (req, res) =>
    res.json(await familiaService.quitarIntegrante(req.params.id, req.params.personaId)),
};
