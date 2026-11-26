import { crearCrudController } from "./base.controller.js";
import AsambleaService from "../services/asamblea.service.js";
import { calcularHabiles, criteriosPorDefecto } from "../services/habiles.service.js";

const asambleaService = new AsambleaService();

export default {
  ...crearCrudController(asambleaService),
  crear: async (req, res) => res.status(201).json(await asambleaService.crear(req.body, req.user.sub)),
  habiles: async (req, res) => res.json(await asambleaService.habiles(req.params.id)),
  congelar: async (req, res) => res.json(await asambleaService.congelar(req.params.id)),
  registrarAsistente: async (req, res) =>
    res.status(201).json(await asambleaService.registrarAsistente(req.params.id, req.body.miembro)),
  quitarAsistente: async (req, res) =>
    res.json(await asambleaService.quitarAsistente(req.params.id, req.params.miembroId)),

  /** GET /asamblea/habiles?fecha=...: quién sería hábil a esa fecha, sin crear una asamblea. */
  consultarHabiles: async (req, res) => {
    const { fecha = new Date(), ...criterios } = req.query;
    res.json(await calcularHabiles(fecha, { ...criteriosPorDefecto(), ...criterios }));
  },
};
