import Joi from "joi";
import { idGen, stringStandard, dateGen, paginacion, parcial } from "./common.schema.js";
import { GRADOS_INSTRUCCION } from "../models/persona.model.js";

export const createPersonaSchema = Joi.object({
  name: stringStandard.required(),
  surname: stringStandard.required(),
  // Texto: conserva el prefijo +51 y los ceros
  phone: Joi.string()
    .trim()
    .pattern(/^\+?[0-9 ]{6,15}$/)
    .optional()
    .messages({ "string.pattern.base": "El teléfono solo puede tener dígitos, espacios y un + inicial" }),
  mail: stringStandard.email().optional().allow(""),
  // DNI (8 dígitos) o carné de extranjería / pasaporte (hasta 12 caracteres)
  doi: Joi.string()
    .trim()
    .uppercase()
    .pattern(/^[0-9A-Z]{8,12}$/)
    .optional()
    .messages({ "string.pattern.base": "El documento debe tener entre 8 y 12 letras o dígitos" }),
  gender: idGen.optional(),
  photo: stringStandard.optional().allow(""),
  civilstatus: idGen.optional(),
  dob: dateGen.max("now").optional(),
  departamentdob: idGen.optional(),
  provincedob: idGen.optional(),
  districtdob: idGen.optional(),
  address: stringStandard.optional().allow(""),
  reference: stringStandard.optional().allow(""),
  departament: idGen.optional(),
  province: idGen.optional(),
  district: idGen.optional(),
  // Dones, capacidades y profesiones
  grado_instruccion: Joi.string().valid(...GRADOS_INSTRUCCION).optional(),
  profesion: stringStandard.optional().allow(""),
  ocupacion: stringStandard.optional().allow(""),
  idiomas: Joi.array().items(stringStandard.max(40)).max(10).optional(),
  capacidades: Joi.array().items(stringStandard.max(60)).max(20).optional(),
  dones: Joi.array().items(idGen).unique().max(15).optional(),
});

export const updatePersonaSchema = parcial(createPersonaSchema);

export const listarPersonaSchema = Joi.object({
  buscar: Joi.string().trim().max(100).optional(),
  don: idGen.optional(),
  capacidad: Joi.string().trim().max(60).optional(),
  profesion: Joi.string().trim().max(60).optional(),
  grado_instruccion: Joi.string().valid(...GRADOS_INSTRUCCION).optional(),
  ...paginacion,
});
