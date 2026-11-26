import Joi from "joi";
import { idGen, dateGen, textLong, booleanGen, rangoFechas, paginacion, parcial } from "./common.schema.js";

export const createSesionServicioSchema = Joi.object({
  // Fecha y hora de inicio (ISO 8601), p. ej. 2024-03-10T19:00:00-05:00
  date: dateGen.required(),
  service: idGen.required(),
  observation: textLong.optional().allow(""),
});

export const updateSesionServicioSchema = parcial(createSesionServicioSchema);

export const listarSesionServicioSchema = Joi.object({
  servicio: idGen.optional(),
  // true = cultos a los que les falta director, predicador o lectura bíblica
  programa_incompleto: booleanGen.optional(),
  ...rangoFechas,
  ...paginacion,
});
