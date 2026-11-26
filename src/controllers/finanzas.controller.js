import { crearCrudController } from "./base.controller.js";
import FondoService from "../services/fondo.service.js";
import CategoriaFinancieraService from "../services/categoriaFinanciera.service.js";
import MovimientoFinancieroService from "../services/movimientoFinanciero.service.js";
import CierreService from "../services/cierre.service.js";
import ReporteFinancieroService from "../services/reporteFinanciero.service.js";

const fondoService = new FondoService();
const movimientoService = new MovimientoFinancieroService();
const cierreService = new CierreService();
const reporteService = new ReporteFinancieroService();

// req.alcance: null = acceso completo; { departamentos } = solo los fondos de su departamento
export const fondoController = {
  ...crearCrudController(fondoService),
  listar: async (req, res) => res.json(await fondoService.listar(req.query, req.alcance)),
  obtener: async (req, res) => res.json(await fondoService.obtener(req.params.id, req.alcance)),
};

export const categoriaFinancieraController = crearCrudController(new CategoriaFinancieraService());

export const movimientoFinancieroController = {
  listar: async (req, res) => res.json(await movimientoService.listar(req.query, req.alcance)),
  obtener: async (req, res) => res.json(await movimientoService.obtener(req.params.id, req.alcance)),
  crear: async (req, res) => res.status(201).json(await movimientoService.crear(req.body, req.user.sub)),
  anular: async (req, res) =>
    res.json(await movimientoService.anular(req.params.id, req.body.motivo, req.user.sub)),
};

export const cierreController = {
  listar: async (req, res) => res.json(await cierreService.listar()),
  obtener: async (req, res) => res.json(await cierreService.obtener(req.params.periodo)),
  cerrar: async (req, res) =>
    res.status(201).json(await cierreService.cerrar(req.body.periodo, req.body.observacion, req.user.sub)),
  reabrir: async (req, res) => res.json(await cierreService.reabrir(req.params.periodo, req.body.motivo)),
};

export const reporteController = {
  mensual: async (req, res) => res.json(await reporteService.mensual(req.query.periodo, req.alcance)),
  anual: async (req, res) => res.json(await reporteService.anual(req.query.anio, req.alcance)),
  diezmos: async (req, res) => res.json(await reporteService.diezmos(req.query.anio, req.query.miembro)),
};
