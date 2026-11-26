import Joi from "joi";
import {
  idGen,
  stringStandard,
  textLong,
  dateGen,
  parcial,
  paginacion,
  rangoFechas,
} from "./common.schema.js";
import { createPersonaSchema } from "./persona.schema.js";
import { TIPOS_EVENTO_MANUAL, EVENTOS_CON_IGLESIA } from "../models/eventoMembresia.model.js";
import { PERIODO_REGEX } from "../libs/fechas.js";

export const listarMiembroSchema = Joi.object(paginacion);

// Campos que ya no se editan aquí: los cambian el historial y las actas
const noEditable = (mensaje) => Joi.any().forbidden().messages({ "any.unknown": mensaje });
const camposControlados = {
  state: noEditable("El estado cambia con el historial: POST /miembro/:id/historial"),
  datebaptism: noEditable("El bautismo se registra con un acta: POST /actas/bautismo"),
  placebaptism: noEditable("El bautismo se registra con un acta: POST /actas/bautismo"),
};

const camposMiembro = {
  dateconvert: dateGen.optional(),
  placeconvert: stringStandard.optional().allow(""),
  typemembership: idGen.optional(),
  testimony: textLong.optional().allow(""),
};

const datosEvento = {
  fecha: dateGen.max("now").required(),
  acta_consistorio: stringStandard.max(60).optional().allow(""),
  iglesia: stringStandard.when("tipo", {
    is: Joi.valid(...EVENTOS_CON_IGLESIA),
    then: Joi.required(),
    otherwise: Joi.optional().allow(""),
  }),
  observacion: textLong.optional().allow(""),
};

// Cómo ingresó un miembro que no llega por bautismo (el bautismo crea al miembro solo)
const ingresoSchema = Joi.object({
  tipo: Joi.string().valid("traslado_recibido", "reafirmacion_fe").required(),
  ...datosEvento,
});

// person: id de una persona existente o los datos de una persona nueva
export const createMiembroSchema = Joi.object({
  ...camposMiembro,
  datebaptism: camposControlados.datebaptism,
  placebaptism: camposControlados.placebaptism,
  ingreso: ingresoSchema.optional(),
  // Sin `ingreso` hay que indicar el estado inicial
  state: idGen.when("ingreso", { is: Joi.exist(), then: Joi.forbidden(), otherwise: Joi.required() }),
  // Se usa conditional (no try): try() + stripUnknown vacía el objeto anidado
  person: Joi.alternatives()
    .conditional(Joi.object(), { then: createPersonaSchema, otherwise: idGen })
    .required()
    // Solo para Swagger: joi-to-swagger no soporta conditional
    .meta({ schemaOverride: Joi.alternatives().try(idGen, createPersonaSchema) }),
});

// Los datos personales se editan en /persona/:id
export const updateMiembroSchema = parcial(Joi.object({ ...camposMiembro, person: idGen })).keys(
  camposControlados,
);

// --- Historial de membresía ---
export const createEventoSchema = Joi.object({
  tipo: Joi.string().valid(...TIPOS_EVENTO_MANUAL).required(),
  ...datosEvento,
});

export const eventoParamsSchema = Joi.object({ id: idGen.required(), eventoId: idGen.required() });

export const listarEventosSchema = Joi.object({
  miembro: idGen.optional(),
  tipo: Joi.string().optional(),
  ...rangoFechas,
  ...paginacion,
});

export const padronSchema = Joi.object({ estado: idGen.optional() });

const periodo = Joi.string()
  .pattern(PERIODO_REGEX)
  .messages({ "string.pattern.base": "El periodo debe tener formato AAAA-MM" });
export const crecimientoSchema = Joi.object({ desde: periodo.optional(), hasta: periodo.optional() });

export const resumenMembresiaSchema = Joi.object({
  anio: Joi.number().integer().min(1900).max(2100).required(),
});
