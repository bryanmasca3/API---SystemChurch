import Joi from "joi";
import { idGen, stringStandard, textLong, parcial, paginacion } from "./common.schema.js";
import { PARENTESCOS } from "../models/familia.model.js";

const parentesco = Joi.string().valid(...PARENTESCOS);

export const integranteFamiliaSchema = Joi.object({
  persona: idGen.required(),
  parentesco: parentesco.required(),
});

export const createFamiliaSchema = Joi.object({
  nombre: stringStandard.required(),
  direccion: stringStandard.optional().allow(""),
  observacion: textLong.optional().allow(""),
  integrantes: Joi.array().items(integranteFamiliaSchema).max(30).optional(),
});

export const updateFamiliaSchema = parcial(createFamiliaSchema);

export const listarFamiliaSchema = Joi.object({
  buscar: Joi.string().trim().max(100).optional(),
  persona: idGen.optional(),
  ...paginacion,
});

export const parentescoSchema = Joi.object({ parentesco: parentesco.required() });

export const integranteParamsFamiliaSchema = Joi.object({
  id: idGen.required(),
  personaId: idGen.required(),
});
