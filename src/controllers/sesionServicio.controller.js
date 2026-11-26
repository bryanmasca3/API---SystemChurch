import { crearCrudController } from "./base.controller.js";
import SesionServicioService from "../services/sesionServicio.service.js";

const sesionService = new SesionServicioService();

export default {
  ...crearCrudController(sesionService),
  obtener: async (req, res) => res.json(sesionService.conPendientes(await sesionService.obtener(req.params.id))),
  asignarPrograma: async (req, res) => res.json(await sesionService.asignarPrograma(req.params.id, req.body)),
  generar: async (req, res) => res.status(201).json(await sesionService.generar(req.body)),
};
