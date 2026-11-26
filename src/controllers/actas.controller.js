import {
  BautismoService,
  MatrimonioService,
  DisciplinaService,
  DedicacionService,
} from "../services/actas.service.js";

/** Controlador de un libro de actas: sin DELETE (las actas se anulan). */
const crearActasController = (service) => ({
  listar: async (req, res) => res.json(await service.listar(req.query)),
  obtener: async (req, res) => res.json(await service.obtener(req.params.id)),
  crear: async (req, res) => res.status(201).json(await service.crear(req.body, req.user.sub)),
  actualizar: async (req, res) => res.json(await service.actualizar(req.params.id, req.body)),
  anular: async (req, res) => res.json(await service.anular(req.params.id, req.body.motivo, req.user.sub)),
});

const disciplinaService = new DisciplinaService();

export const bautismoController = crearActasController(new BautismoService());
export const matrimonioController = crearActasController(new MatrimonioService());
export const dedicacionController = crearActasController(new DedicacionService());
export const disciplinaController = {
  ...crearActasController(disciplinaService),
  restaurar: async (req, res) => res.json(await disciplinaService.restaurar(req.params.id, req.body, req.user.sub)),
};
