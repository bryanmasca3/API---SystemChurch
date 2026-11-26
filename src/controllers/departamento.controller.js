import { crearCrudController } from "./base.controller.js";
import DepartamentoService from "../services/departamento.service.js";
import InscripcionService from "../services/inscripcion.service.js";

const departamentoService = new DepartamentoService();
const inscripcionService = new InscripcionService();

export default {
  ...crearCrudController(departamentoService),

  listarIntegrantes: async (req, res) => {
    res.json(await departamentoService.listarIntegrantes(req.params.id));
  },

  agregarIntegrante: async (req, res) => {
    res.status(201).json(await departamentoService.agregarIntegrante(req.params.id, req.body));
  },

  actualizarIntegrante: async (req, res) => {
    const { id, integranteId } = req.params;
    res.json(await departamentoService.actualizarIntegrante(id, integranteId, req.body));
  },

  listarInscritos: async (req, res) => {
    res.json(await inscripcionService.listarDe(req.params.id, req.query));
  },
  inscribir: async (req, res) => {
    res.status(201).json(await inscripcionService.inscribir(req.params.id, req.body));
  },
  actualizarInscripcion: async (req, res) => {
    res.json(await inscripcionService.actualizarDe(req.params.id, req.params.inscripcionId, req.body));
  },
  eliminarInscripcion: async (req, res) => {
    await inscripcionService.eliminarDe(req.params.id, req.params.inscripcionId);
    res.status(204).end();
  },

  quitarIntegrante: async (req, res) => {
    const { id, integranteId } = req.params;
    await departamentoService.quitarIntegrante(id, integranteId);
    res.status(204).end();
  },
};
