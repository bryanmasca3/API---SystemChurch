import Joi from "joi";
import { idGen, stringStandard, textLong, dateGen, booleanGen, parcial } from "./common.schema.js";
import { createPersonaSchema } from "./persona.schema.js";

export const createDepartamentoSchema = Joi.object({
  description: stringStandard.required(),
});

export const updateDepartamentoSchema = parcial(createDepartamentoSchema);

// --- Integrantes del departamento ---
export const createIntegranteSchema = Joi.object({
  member: idGen.required(),
  role: idGen.required(),
});

export const updateIntegranteSchema = Joi.object({ role: idGen.required() });

// --- Inscritos (niños, adolescentes, jóvenes; miembros o no) ---
const personaONueva = Joi.alternatives()
  .conditional(Joi.object(), { then: createPersonaSchema, otherwise: idGen })
  .meta({ schemaOverride: Joi.alternatives().try(idGen, createPersonaSchema) });

export const createInscripcionSchema = Joi.object({
  persona: personaONueva.required(),
  fecha_inscripcion: dateGen.max("now").required(),
  apoderado: idGen.optional(),
  observacion: textLong.optional().allow(""),
});
export const updateInscripcionSchema = parcial(
  Joi.object({
    apoderado: idGen.allow(null),
    observacion: textLong.allow(""),
    activo: booleanGen,
    fecha_retiro: dateGen.allow(null),
  }),
);
export const listarInscripcionSchema = Joi.object({
  activo: Joi.alternatives().try(booleanGen, Joi.valid("todos")).default(true),
});
export const inscripcionParamsSchema = Joi.object({ id: idGen.required(), inscripcionId: idGen.required() });

export const integranteParamsSchema = Joi.object({
  id: idGen.required(),
  integranteId: idGen.required(),
});
