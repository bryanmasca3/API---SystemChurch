import Joi from "joi";
import { idGen, rangoFechas, paginacion, parcial } from "./common.schema.js";

// Filtros comunes: por sesión concreta o por servicio/rango de fechas de la sesión
const filtrosSesion = {
  sesion: idGen.optional(),
  servicio: idGen.optional(),
  ...rangoFechas,
  ...paginacion,
};

// --- Asistencia a servicios (persona) ---
export const createAsistenciaSchema = Joi.object({
  sesion: idGen.required(),
  person: idGen.required(),
});

export const updateAsistenciaSchema = parcial(createAsistenciaSchema);

export const listarAsistenciaSchema = Joi.object({
  persona: idGen.optional(),
  ...filtrosSesion,
});

// --- Asistencia a Santa Cena (miembro) ---
export const createAsistenciaSantaCenaSchema = Joi.object({
  sesion: idGen.required(),
  miembro: idGen.required(),
});

export const updateAsistenciaSantaCenaSchema = parcial(createAsistenciaSantaCenaSchema);

export const listarAsistenciaSantaCenaSchema = Joi.object({
  miembro: idGen.optional(),
  ...filtrosSesion,
});
