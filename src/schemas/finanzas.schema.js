import Joi from "joi";
import {
  idGen,
  stringStandard,
  textLong,
  dateGen,
  booleanGen,
  rangoFechas,
  paginacion,
  parcial,
} from "./common.schema.js";
import { TIPOS_FONDO } from "../models/fondo.model.js";
import {
  TIPOS_MOV_FIN,
  CLASES_INGRESO,
  MEDIOS_PAGO,
  TIPOS_COMPROBANTE,
} from "../models/movimientoFinanciero.model.js";
import { PERIODO_REGEX } from "../libs/fechas.js";

const monto = Joi.number().positive().precision(2).max(10_000_000);
const periodo = Joi.string()
  .pattern(PERIODO_REGEX)
  .messages({ "string.pattern.base": "El periodo debe tener formato AAAA-MM (p. ej. 2024-03)" });
const anio = Joi.number().integer().min(2000).max(2100);

// --- Fondos ---
const camposFondo = {
  nombre: stringStandard.required(),
  tipo: Joi.string().valid(...TIPOS_FONDO).required(),
  descripcion: textLong.optional().allow(""),
  departamento: idGen.optional().allow(null),
  entidad: stringStandard.optional().allow(""),
  numero_cuenta: stringStandard.max(40).optional().allow(""),
  saldo_inicial: Joi.number().min(0).precision(2),
  fecha_inicio: dateGen.required(),
  activo: booleanGen.optional(),
};
export const createFondoSchema = Joi.object({
  ...camposFondo,
  saldo_inicial: camposFondo.saldo_inicial.default(0),
});
// Sin valores por defecto: una edición parcial no debe resetear el saldo inicial
export const updateFondoSchema = parcial(Joi.object(camposFondo));
export const listarFondoSchema = Joi.object({
  activo: booleanGen.optional(),
  departamento: idGen.optional(),
});

// --- Categorías ---
export const createCategoriaFinancieraSchema = Joi.object({
  description: stringStandard.required(),
  tipo: Joi.string().valid("ingreso", "egreso").required(),
});
export const updateCategoriaFinancieraSchema = parcial(createCategoriaFinancieraSchema);
export const listarCategoriaFinancieraSchema = Joi.object({
  tipo: Joi.string().valid("ingreso", "egreso").optional(),
});

// --- Movimientos ---
const soloSi = (campo, valor, esquema, { requerido = false } = {}) =>
  esquema.when(campo, {
    is: valor,
    then: requerido ? Joi.required() : Joi.optional(),
    otherwise: Joi.forbidden(),
  });

export const createMovimientoFinancieroSchema = Joi.object({
  tipo: Joi.string().valid(...TIPOS_MOV_FIN).required(),
  fecha: dateGen.max("now").required(),
  monto: monto.required(),
  fondo: idGen.required(),
  fondo_destino: soloSi("tipo", "transferencia", idGen, { requerido: true }),
  clase: soloSi("tipo", "ingreso", Joi.string().valid(...CLASES_INGRESO), { requerido: true }),
  // Ingresos "otro" y egresos llevan categoría
  categoria: idGen.when("tipo", {
    is: "egreso",
    then: Joi.required(),
    otherwise: Joi.when("clase", { is: "otro", then: Joi.required(), otherwise: Joi.forbidden() }),
  }),
  // Solo diezmos (opcional = anónimo). Las ofrendas son siempre anónimas.
  miembro: soloSi("clase", "diezmo", idGen.allow(null)).messages({
    "any.unknown": "Solo los diezmos pueden asociarse a un miembro (las ofrendas son anónimas)",
  }),
  sesion: idGen.optional(),
  medio_pago: Joi.string().valid(...MEDIOS_PAGO).optional(),
  descripcion: textLong.optional().allow(""),
  beneficiario: soloSi("tipo", "egreso", stringStandard.allow("")),
  comprobante: soloSi(
    "tipo",
    "egreso",
    Joi.object({
      tipo: Joi.string().valid(...TIPOS_COMPROBANTE).required(),
      numero: stringStandard.max(40).optional().allow(""),
    }),
  ),
});

export const anularMovimientoSchema = Joi.object({
  motivo: Joi.string().trim().min(5).max(500).required(),
});

export const listarMovimientoFinancieroSchema = Joi.object({
  tipo: Joi.string().valid(...TIPOS_MOV_FIN).optional(),
  clase: Joi.string().valid(...CLASES_INGRESO).optional(),
  fondo: idGen.optional(),
  categoria: idGen.optional(),
  miembro: idGen.optional(),
  sesion: idGen.optional(),
  periodo: periodo.optional(),
  incluir_anulados: booleanGen.default(false),
  ...rangoFechas,
  ...paginacion,
});

// --- Cierres ---
export const cerrarMesSchema = Joi.object({
  periodo: periodo.required(),
  observacion: textLong.optional().allow(""),
});
export const periodoParamSchema = Joi.object({ periodo: periodo.required() });
export const reabrirMesSchema = Joi.object({
  motivo: Joi.string().trim().min(5).max(500).required(),
});

// --- Reportes ---
export const reporteMensualSchema = Joi.object({ periodo: periodo.required() });
export const reporteAnualSchema = Joi.object({ anio: anio.required() });
export const reporteDiezmosSchema = Joi.object({ anio: anio.required(), miembro: idGen.optional() });
