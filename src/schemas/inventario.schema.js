import Joi from "joi";
import {
  idGen,
  stringStandard,
  textLong,
  dateGen,
  rangoFechas,
  paginacion,
  parcial,
} from "./common.schema.js";
import { ESTADOS_BIEN } from "../models/bien.model.js";
import { TIPOS_MOVIMIENTO } from "../models/movimientoInventario.model.js";

// --- Bien ---
const camposBien = {
  codigo: stringStandard.max(30).optional(),
  nombre: stringStandard.required(),
  descripcion: textLong.optional().allow(""),
  categoria: idGen.required(),
  estado: Joi.string().valid(...ESTADOS_BIEN).optional(),
  ubicacion: stringStandard.optional().allow(""),
  departamento: idGen.optional().allow(null),
  encargado: idGen.optional().allow(null),
  fecha_adquisicion: dateGen.max("now").optional(),
  valor: Joi.number().min(0).precision(2).optional(),
  observacion: textLong.optional().allow(""),
};

export const createBienSchema = Joi.object({
  ...camposBien,
  // Cantidad inicial: se registra como un movimiento de "entrada"
  cantidad: Joi.number().integer().min(0).default(0),
});

// La cantidad solo cambia con movimientos (entrada, baja, préstamo, devolución)
const soloPorMovimientos = Joi.any()
  .forbidden()
  .messages({
    "any.unknown":
      "La cantidad no se edita directamente: registra un movimiento en POST /inventario/:id/movimientos",
  });
export const updateBienSchema = parcial(Joi.object(camposBien)).keys({
  cantidad: soloPorMovimientos,
  cantidad_prestada: soloPorMovimientos,
});

export const listarBienSchema = Joi.object({
  buscar: Joi.string().trim().max(100).optional(),
  categoria: idGen.optional(),
  departamento: idGen.optional(),
  encargado: idGen.optional(),
  estado: Joi.string().valid(...ESTADOS_BIEN).optional(),
  prestados: Joi.boolean().optional(),
  ...paginacion,
});

// --- Movimientos ---
export const createMovimientoSchema = Joi.object({
  tipo: Joi.string().valid(...TIPOS_MOVIMIENTO).required(),
  cantidad: Joi.number().integer().min(1).required(),
  fecha: dateGen.max("now").optional(),
  motivo: textLong.optional().allow(""),
  // Préstamo: obligatoria (quién se lo lleva). Entrada/devolución: opcional
  persona: idGen.when("tipo", {
    is: "prestamo",
    then: Joi.required(),
    otherwise: Joi.when("tipo", { is: "baja", then: Joi.forbidden(), otherwise: Joi.optional() }),
  }),
  fecha_devolucion_prevista: dateGen.when("tipo", {
    is: "prestamo",
    then: Joi.optional(),
    otherwise: Joi.forbidden(),
  }),
  // Devolución: el préstamo que se devuelve
  prestamo: idGen.when("tipo", { is: "devolucion", then: Joi.required(), otherwise: Joi.forbidden() }),
});

export const listarMovimientoSchema = Joi.object({
  tipo: Joi.string().valid(...TIPOS_MOVIMIENTO).optional(),
  persona: idGen.optional(),
  bien: idGen.optional(),
  ...rangoFechas,
  ...paginacion,
});

export const reporteAnualInventarioSchema = Joi.object({
  anio: Joi.number().integer().min(2000).max(2100).required(),
});

export const listarPrestamoSchema = Joi.object({
  estado: Joi.string().valid("pendiente", "vencido", "devuelto", "todos").default("pendiente"),
  persona: idGen.optional(),
  bien: idGen.optional(),
  ...paginacion,
});
