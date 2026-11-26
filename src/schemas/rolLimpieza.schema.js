import Joi from "joi";
import { idGen, dateGen, parcial, paginacionSchema } from "./common.schema.js";

export const createRolLimpiezaSchema = Joi.object({
  membermain: idGen.required(),
  date: dateGen.required(),
});

export const updateRolLimpiezaSchema = parcial(createRolLimpiezaSchema);

export const listarRolLimpiezaSchema = paginacionSchema;
