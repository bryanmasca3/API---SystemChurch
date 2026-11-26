import {
  VisitaService,
  CasoService,
  PeticionService,
  SeguimientoService,
  alertasInasistencia,
  resumenPastoral,
} from "../services/pastoral.service.js";

/** CRUD que pasa el usuario al servicio (para filtrar lo confidencial y registrar autoría). */
const crudConUsuario = (service) => ({
  listar: async (req, res) => res.json(await service.listar(req.query, req.user)),
  obtener: async (req, res) => res.json(await service.obtener(req.params.id, req.user)),
  crear: async (req, res) => res.status(201).json(await service.crear(req.body, req.user)),
  actualizar: async (req, res) => res.json(await service.actualizar(req.params.id, req.body, req.user)),
  eliminar: async (req, res) => {
    await service.eliminar(req.params.id, req.user);
    res.status(204).end();
  },
});

const casoService = new CasoService();
const seguimientoService = new SeguimientoService();

export const visitaController = crudConUsuario(new VisitaService());
export const peticionController = crudConUsuario(new PeticionService());

export const casoController = {
  ...crudConUsuario(casoService),
  obtener: async (req, res) => res.json(await casoService.obtener(req.params.id)),
  actualizar: async (req, res) => res.json(await casoService.actualizar(req.params.id, req.body)),
  eliminar: async (req, res) => {
    await casoService.eliminar(req.params.id);
    res.status(204).end();
  },
  agregarAyuda: async (req, res) =>
    res.status(201).json(await casoService.agregarAyuda(req.params.id, req.body, req.user)),
  quitarAyuda: async (req, res) => res.json(await casoService.quitarAyuda(req.params.id, req.params.ayudaId)),
};

export const seguimientoController = {
  ...crudConUsuario(seguimientoService),
  obtener: async (req, res) => res.json(await seguimientoService.obtener(req.params.id)),
  actualizar: async (req, res) => res.json(await seguimientoService.actualizar(req.params.id, req.body)),
  eliminar: async (req, res) => {
    await seguimientoService.eliminar(req.params.id);
    res.status(204).end();
  },
  registrarAvance: async (req, res) =>
    res.status(201).json(await seguimientoService.registrarAvance(req.params.id, req.body, req.user)),
};

export const alertasController = async (req, res) => res.json(await alertasInasistencia(req.query));
export const resumenController = async (req, res) => res.json(await resumenPastoral(req.user));
