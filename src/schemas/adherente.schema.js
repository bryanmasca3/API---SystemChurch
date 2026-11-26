import Joi from "joi";
import { idGen, stringStandard, textLong, parcial, paginacionSchema } from "./common.schema.js";

export const createAdherenteSchema = Joi.object({
  code: stringStandard.required(),
  observacion: textLong.optional().allow(""),
  relation: idGen.optional(),
  person: idGen.optional(),
});

export const updateAdherenteSchema = parcial(createAdherenteSchema);

export const listarAdherenteSchema = paginacionSchema;
