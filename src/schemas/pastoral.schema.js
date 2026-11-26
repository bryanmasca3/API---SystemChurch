import Joi from "joi";
import { idGen, stringStandard, textLong, dateGen, booleanGen, rangoFechas, paginacion, parcial } from "./common.schema.js";
import { createPersonaSchema } from "./persona.schema.js";
import {
  MOTIVOS_VISITA,
  LUGARES_VISITA,
  TIPOS_CASO,
  PRIORIDADES,
  ESTADOS_CASO,
  TIPOS_AYUDA,
  ESTADOS_PETICION,
  ETAPAS_SEGUIMIENTO,
  ORIGENES,
} from "../models/pastoral.model.js";

const personaONueva = Joi.alternatives()
  .conditional(Joi.object(), { then: createPersonaSchema, otherwise: idGen })
  .meta({ schemaOverride: Joi.alternatives().try(idGen, createPersonaSchema) });

// --- Visitas ---
const camposVisita = {
  fecha: dateGen.max("now").required(),
  persona: idGen.optional(),
  familia: idGen.optional(),
  visitantes: Joi.array().items(idGen).unique().max(10).optional(),
  motivo: Joi.string().valid(...MOTIVOS_VISITA).required(),
  lugar: Joi.string().valid(...LUGARES_VISITA).optional(),
  notas: textLong.optional().allow(""),
  acuerdos: textLong.optional().allow(""),
  proxima_visita: dateGen.optional().allow(null),
  solo_pastor: booleanGen.optional(),
  caso: idGen.optional().allow(null),
};
export const createVisitaSchema = Joi.object(camposVisita)
  .or("persona", "familia")
  .messages({ "object.missing": "Indica a quién se visitó: persona o familia" });
export const updateVisitaSchema = parcial(Joi.object(camposVisita));
export const listarVisitaSchema = Joi.object({
  persona: idGen.optional(),
  familia: idGen.optional(),
  motivo: Joi.string().valid(...MOTIVOS_VISITA).optional(),
  // true = visitas con próxima visita programada desde hoy (agenda)
  proximas: booleanGen.optional(),
  ...rangoFechas,
  ...paginacion,
});

// --- Necesitados y enfermos ---
const camposCaso = {
  persona: personaONueva.required(),
  tipo: Joi.string().valid(...TIPOS_CASO).required(),
  descripcion: textLong.required(),
  prioridad: Joi.string().valid(...PRIORIDADES).optional(),
  fecha_inicio: dateGen.max("now").required(),
  responsable: idGen.optional().allow(null),
};
export const createCasoSchema = Joi.object(camposCaso);
export const updateCasoSchema = parcial(
  Joi.object({
    tipo: camposCaso.tipo,
    descripcion: textLong,
    prioridad: camposCaso.prioridad,
    responsable: camposCaso.responsable,
    estado: Joi.string().valid(...ESTADOS_CASO),
    motivo_cierre: textLong.allow(""),
  }),
);
export const listarCasoSchema = Joi.object({
  estado: Joi.string().valid(...ESTADOS_CASO).optional(),
  abiertos: booleanGen.optional(),
  tipo: Joi.string().valid(...TIPOS_CASO).optional(),
  prioridad: Joi.string().valid(...PRIORIDADES).optional(),
  persona: idGen.optional(),
  ...paginacion,
});
export const createAyudaSchema = Joi.object({
  fecha: dateGen.max("now").required(),
  tipo: Joi.string().valid(...TIPOS_AYUDA).required(),
  descripcion: textLong.optional().allow(""),
  monto: Joi.number().min(0).precision(2).optional(),
  // Egreso ya registrado por el tesorero en /finanzas/movimientos
  movimiento_financiero: idGen.optional(),
});
export const ayudaParamsSchema = Joi.object({ id: idGen.required(), ayudaId: idGen.required() });

// --- Peticiones de oración ---
export const createPeticionSchema = Joi.object({
  fecha: dateGen.max("now").default(() => new Date()),
  persona: idGen.optional(),
  peticion: textLong.min(3).required(),
  confidencial: booleanGen.optional(),
});
export const updatePeticionSchema = parcial(
  Joi.object({
    peticion: textLong.min(3),
    confidencial: booleanGen,
    estado: Joi.string().valid(...ESTADOS_PETICION),
    testimonio: textLong.allow(""),
  }),
);
export const listarPeticionSchema = Joi.object({
  estado: Joi.string().valid(...ESTADOS_PETICION).optional(),
  persona: idGen.optional(),
  confidencial: booleanGen.optional(),
  ...paginacion,
});

// --- Seguimiento de nuevos ---
export const createSeguimientoSchema = Joi.object({
  persona: personaONueva.required(),
  etapa: Joi.string().valid(...ETAPAS_SEGUIMIENTO.filter((e) => e !== "integrado")).optional(),
  origen: Joi.string().valid(...ORIGENES).optional(),
  fecha_inicio: dateGen.max("now").required(),
  invitado_por: idGen.optional(),
  discipulador: idGen.optional(),
  observacion: textLong.optional().allow(""),
});
export const updateSeguimientoSchema = parcial(
  Joi.object({
    origen: Joi.string().valid(...ORIGENES),
    invitado_por: idGen.allow(null),
    discipulador: idGen.allow(null),
    observacion: textLong.allow(""),
  }),
);
export const listarSeguimientoSchema = Joi.object({
  etapa: Joi.string().valid(...ETAPAS_SEGUIMIENTO).optional(),
  // true = excluye integrados y sin seguimiento
  activos: booleanGen.optional(),
  discipulador: idGen.optional(),
  ...paginacion,
});
export const createAvanceSchema = Joi.object({
  tipo: Joi.string().valid("sesion", "cambio_etapa", "nota").required(),
  fecha: dateGen.max("now").required(),
  etapa: Joi.string()
    .valid(...ETAPAS_SEGUIMIENTO)
    .when("tipo", { is: "cambio_etapa", then: Joi.required(), otherwise: Joi.forbidden() }),
  tema: stringStandard.when("tipo", { is: "sesion", then: Joi.required(), otherwise: Joi.optional().allow("") }),
  observacion: textLong.optional().allow(""),
});

// --- Alertas ---
export const alertasSchema = Joi.object({
  domingos: Joi.number().integer().min(1).max(26).default(4),
});
