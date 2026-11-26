import Joi from "joi";
import { idGen, rangoFechas, paginacion } from "./common.schema.js";
import { ACCIONES_BITACORA } from "../models/bitacora.model.js";

export const listarBitacoraSchema = Joi.object({
  usuario: idGen.optional(),
  accion: Joi.string().valid(...ACCIONES_BITACORA).optional(),
  // Nombre del recurso tal como aparece en la bitácora ("Miembro", "Bien"...)
  recurso: Joi.string().trim().max(60).optional(),
  documento: idGen.optional(),
  ...rangoFechas,
  ...paginacion,
});
