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

export const createReunionSchema = Joi.object({
  subject: stringStandard.required(),
  description: textLong.required(),
  typemeeting: idGen.required(),
  departament: idGen.required(),
  observacion: textLong.optional().allow(""),
  // Fecha y hora (ISO 8601), p. ej. 2024-04-01T19:00:00-05:00
  date: dateGen.required(),
});

export const updateReunionSchema = parcial(createReunionSchema);

export const listarReunionSchema = Joi.object({
  departamento: idGen.optional(),
  ...rangoFechas,
  ...paginacion,
});

// --- Asistentes a la reunión ---
export const createAsistenteSchema = Joi.object({
  member: idGen.required(),
  observacion: textLong.optional().allow(""),
});

export const asistenteParamsSchema = Joi.object({
  id: idGen.required(),
  asistenteId: idGen.required(),
});
