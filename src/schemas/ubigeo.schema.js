import Joi from "joi";
import { idGen } from "./common.schema.js";

export const nivelUbigeoSchema = Joi.object({
  nivel: Joi.string().valid("departamento", "provincia", "distrito").required(),
});

export const getUbigeoSchema = nivelUbigeoSchema.keys({ id: idGen.required() });

// ?padre=<id_ubigeo del nivel superior>
export const listarUbigeoSchema = Joi.object({
  padre: Joi.string().trim().max(20).optional(),
});
