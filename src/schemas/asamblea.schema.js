import Joi from "joi";
import { idGen, stringStandard, textLong, dateGen, rangoFechas, paginacion, parcial } from "./common.schema.js";
import { TIPOS_ASAMBLEA } from "../models/asamblea.model.js";

const porcentaje = Joi.number().min(0).max(100);
const criterios = Joi.object({
  meses: Joi.number().integer().min(1).max(36),
  edad_minima: Joi.number().integer().min(0).max(30),
  asistencia_dominical_pct: porcentaje,
  santa_cena_pct: porcentaje,
});

const campos = {
  fecha: dateGen.required(),
  tipo: Joi.string().valid(...TIPOS_ASAMBLEA).required(),
  lugar: stringStandard.optional().allow(""),
  agenda: textLong.optional().allow(""),
  acta_numero: stringStandard.max(60).optional().allow(""),
  observacion: textLong.optional().allow(""),
  // Opcional: si no se envía se usan los criterios por defecto (6 meses, 18 años, 50%, 50%)
  criterios: criterios.optional(),
};

export const createAsambleaSchema = Joi.object(campos);
export const updateAsambleaSchema = parcial(Joi.object(campos));
export const listarAsambleaSchema = Joi.object({
  tipo: Joi.string().valid(...TIPOS_ASAMBLEA).optional(),
  ...rangoFechas,
  ...paginacion,
});
export const asistenteAsambleaSchema = Joi.object({ miembro: idGen.required() });
export const asistenteAsambleaParamsSchema = Joi.object({ id: idGen.required(), miembroId: idGen.required() });

// Consulta libre de hábiles a una fecha (sin crear asamblea)
export const consultaHabilesSchema = Joi.object({
  fecha: dateGen.optional(),
  meses: Joi.number().integer().min(1).max(36).optional(),
  edad_minima: Joi.number().integer().min(0).max(30).optional(),
  asistencia_dominical_pct: porcentaje.optional(),
  santa_cena_pct: porcentaje.optional(),
});
