import { crearCrudController } from "./base.controller.js";
import MiembroService from "../services/miembro.service.js";
import MembresiaService from "../services/membresia.service.js";

const miembroService = new MiembroService();
const membresiaService = new MembresiaService();

export default {
  ...crearCrudController(miembroService),
  crear: async (req, res) => res.status(201).json(await miembroService.crear(req.body, req.user.sub)),

  historial: async (req, res) => res.json(await membresiaService.historial(req.params.id)),
  registrarEvento: async (req, res) =>
    res.status(201).json(await membresiaService.registrar(req.params.id, req.body, req.user.sub)),
  deshacerEvento: async (req, res) => {
    await membresiaService.deshacerUltimo(req.params.id, req.params.eventoId);
    res.status(204).end();
  },
};

export const membresiaController = {
  listarEventos: async (req, res) => res.json(await membresiaService.listar(req.query)),
  resumen: async (req, res) => res.json(await membresiaService.resumen(req.query.anio)),
  padron: async (req, res) => res.json(await membresiaService.padron(req.query)),
  crecimiento: async (req, res) => res.json(await membresiaService.crecimiento(req.query)),
};
