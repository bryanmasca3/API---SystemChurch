import { crearCrudController } from "./base.controller.js";
import InventarioService from "../services/inventario.service.js";

const inventarioService = new InventarioService();

export default {
  ...crearCrudController(inventarioService),

  // El usuario del token queda como quien registró el movimiento inicial
  crear: async (req, res) => {
    res.status(201).json(await inventarioService.crear(req.body, req.user.sub));
  },

  registrarMovimiento: async (req, res) => {
    res
      .status(201)
      .json(await inventarioService.registrarMovimiento(req.params.id, req.body, req.user.sub));
  },

  listarMovimientosDeBien: async (req, res) => {
    res.json(await inventarioService.listarMovimientos(req.params.id, req.query));
  },

  listarMovimientos: async (req, res) => {
    res.json(await inventarioService.movimientos.listar(req.query));
  },

  listarPrestamos: async (req, res) => {
    res.json(await inventarioService.prestamos.listar(req.query));
  },

  reporteAnual: async (req, res) => {
    res.json(await inventarioService.reporteAnual(req.query.anio));
  },

  resumen: async (req, res) => {
    res.json(await inventarioService.resumen());
  },
};
