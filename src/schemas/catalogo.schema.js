import Joi from "joi";
import { stringStandard, parcial } from "./common.schema.js";

export const createCatalogoSchema = Joi.object({
  description: stringStandard.required(),
});

export const updateCatalogoSchema = parcial(createCatalogoSchema);
