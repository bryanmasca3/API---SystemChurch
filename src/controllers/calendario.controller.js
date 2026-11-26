import { crearCrudController } from "./base.controller.js";
import { EventoService, calendario, misAsignaciones } from "../services/calendario.service.js";

const eventoService = new EventoService();

export const eventoController = {
  ...crearCrudController(eventoService),
  crear: async (req, res) => res.status(201).json(await eventoService.crear(req.body, req.user.sub)),
};

export const calendarioController = {
  ver: async (req, res) => res.json(await calendario(req.query)),
  misAsignaciones: async (req, res) => res.json(await misAsignaciones(req.user.miembro, req.query)),
};
