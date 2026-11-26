import { crearCrudController } from "./base.controller.js";
import ReunionService from "../services/reunion.service.js";

const reunionService = new ReunionService();

export default {
  ...crearCrudController(reunionService),

  listarAsistentes: async (req, res) => {
    res.json(await reunionService.listarAsistentes(req.params.id));
  },

  agregarAsistente: async (req, res) => {
    res.status(201).json(await reunionService.agregarAsistente(req.params.id, req.body));
  },

  quitarAsistente: async (req, res) => {
    await reunionService.quitarAsistente(req.params.id, req.params.asistenteId);
    res.status(204).end();
  },
};
