import Joi from "joi";
import { idGen, stringStandard, textLong, dateGen, booleanGen, rangoFechas, paginacion, parcial } from "./common.schema.js";
import { TIPOS_EVENTO, ESTADOS_EVENTO } from "../models/evento.model.js";

// --- Programa de un culto ---
/** Un miembro, o un invitado (nombre libre y su iglesia). `null` quita la asignación. */
const asignacion = (extra = {}) =>
  Joi.object({
    miembro: idGen.optional(),
    invitado: stringStandard.max(120).optional(),
    iglesia: stringStandard.max(120).optional().allow(""),
    ...extra,
  })
    .xor("miembro", "invitado")
    .messages({ "object.xor": "Indica un miembro o el nombre de un invitado (no ambos)", "object.missing": "Indica un miembro o el nombre de un invitado" })
    .allow(null);

export const programaSchema = Joi.object({
  director: asignacion(),
  predicador: asignacion({
    tema: stringStandard.max(200).optional().allow(""),
    texto_biblico: stringStandard.max(120).optional().allow(""),
  }),
  lectura_biblica: asignacion({ pasaje: stringStandard.max(120).optional().allow("") }),
}).min(1);

export const generarSesionesSchema = Joi.object({
  desde: dateGen.required(),
  hasta: dateGen.min(Joi.ref("desde")).required(),
  // Opcional: solo estos servicios (el líder debe indicar los de su departamento)
  servicios: Joi.array().items(idGen).unique().optional(),
});

// --- Eventos ---
const camposEvento = {
  titulo: stringStandard.required(),
  tipo: Joi.string().valid(...TIPOS_EVENTO).required(),
  fecha_inicio: dateGen.required(),
  // Si no se indica, el evento dura un solo momento/día (fin = inicio)
  fecha_fin: dateGen.optional(),
  lugar: stringStandard.optional().allow(""),
  descripcion: textLong.optional().allow(""),
  departamento: idGen.optional().allow(null),
  responsable: idGen.optional().allow(null),
  estado: Joi.string().valid(...ESTADOS_EVENTO).optional(),
  observacion: textLong.optional().allow(""),
};
export const createEventoSchema = Joi.object(camposEvento);
export const updateEventoSchema = parcial(Joi.object(camposEvento));
export const listarEventoSchema = Joi.object({
  tipo: Joi.string().valid(...TIPOS_EVENTO).optional(),
  departamento: idGen.optional(),
  estado: Joi.string().valid(...ESTADOS_EVENTO).optional(),
  ...rangoFechas,
  ...paginacion,
});

// --- Calendario ---
export const calendarioSchema = Joi.object({
  ...rangoFechas,
  departamento: idGen.optional(),
});
export const misAsignacionesSchema = Joi.object({ desde: dateGen.optional() });

