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
import { createPersonaSchema } from "./persona.schema.js";
import { MEDIDAS_DISCIPLINA, ESTADOS_DISCIPLINA } from "../models/actas.model.js";

/** Id de persona existente o datos de una persona nueva (como en /miembro). */
const personaONueva = Joi.alternatives()
  .conditional(Joi.object(), { then: createPersonaSchema, otherwise: idGen })
  .meta({ schemaOverride: Joi.alternatives().try(idGen, createPersonaSchema) });

const testigos = Joi.array().items(stringStandard).max(10);
const filtrosLibro = { ...rangoFechas, incluir_anuladas: booleanGen.default(false), ...paginacion };

export const anularActaSchema = Joi.object({ motivo: Joi.string().trim().min(5).max(500).required() });

// --- Bautismo (solo adultos) ---
const camposBautismoEditables = {
  lugar: stringStandard.optional().allow(""),
  oficiante: stringStandard,
  testigos,
  observacion: textLong.optional().allow(""),
};
export const createBautismoSchema = Joi.object({
  persona: personaONueva.required(),
  fecha: dateGen.max("now").required(),
  ...camposBautismoEditables,
  oficiante: stringStandard.required(),
});
export const updateBautismoSchema = parcial(Joi.object(camposBautismoEditables));
export const listarBautismoSchema = Joi.object({ persona: idGen.optional(), ...filtrosLibro });

// --- Matrimonio ---
const registroCivil = Joi.object({
  municipalidad: stringStandard.optional().allow(""),
  numero_partida: stringStandard.max(40).optional().allow(""),
  fecha: dateGen.optional(),
});
const camposMatrimonioEditables = {
  lugar: stringStandard.optional().allow(""),
  oficiante: stringStandard,
  testigos,
  registro_civil: registroCivil,
  observacion: textLong.optional().allow(""),
};
export const createMatrimonioSchema = Joi.object({
  contrayente1: personaONueva.required(),
  contrayente2: personaONueva.required(),
  fecha: dateGen.max("now").required(),
  ...camposMatrimonioEditables,
  oficiante: stringStandard.required(),
});
export const updateMatrimonioSchema = parcial(Joi.object(camposMatrimonioEditables));
export const listarMatrimonioSchema = Joi.object({ persona: idGen.optional(), ...filtrosLibro });

// --- Dedicación de niños ---
const camposDedicacionEditables = {
  lugar: stringStandard.optional().allow(""),
  oficiante: stringStandard,
  testigos,
  observacion: textLong.optional().allow(""),
};
export const createDedicacionSchema = Joi.object({
  nino: personaONueva.required(),
  // Padre y/o madre (uno o dos)
  padres: Joi.array().items(personaONueva).min(1).max(2).required(),
  fecha: dateGen.max("now").required(),
  ...camposDedicacionEditables,
  oficiante: stringStandard.required(),
});
export const updateDedicacionSchema = parcial(Joi.object(camposDedicacionEditables));
export const listarDedicacionSchema = Joi.object({ persona: idGen.optional(), ...filtrosLibro });

// --- Disciplina (confidencial) ---
export const createDisciplinaSchema = Joi.object({
  miembro: idGen.required(),
  fecha: dateGen.max("now").required(),
  acta_consistorio: stringStandard.max(60).required(),
  medida: Joi.string().valid(...MEDIDAS_DISCIPLINA).required(),
  motivo: textLong.min(5).required(),
  fecha_revision: dateGen.optional(),
  observacion: textLong.optional().allow(""),
});
export const updateDisciplinaSchema = parcial(
  Joi.object({
    motivo: textLong.min(5),
    fecha_revision: dateGen.allow(null),
    observacion: textLong.allow(""),
  }),
);
export const restaurarDisciplinaSchema = Joi.object({
  fecha: dateGen.max("now").required(),
  acta_consistorio: stringStandard.max(60).required(),
  observacion: textLong.optional().allow(""),
});
export const listarDisciplinaSchema = Joi.object({
  miembro: idGen.optional(),
  estado: Joi.string().valid(...ESTADOS_DISCIPLINA).optional(),
  medida: Joi.string().valid(...MEDIDAS_DISCIPLINA).optional(),
  ...filtrosLibro,
});
