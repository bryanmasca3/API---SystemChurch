import Joi from "joi";
import { stringStandard } from "./common.schema.js";

export const loginSchema = Joi.object({
  correo: stringStandard.required(),
  contrasena: Joi.string().max(255).required(),
});

export const actualizarContrasenaSchema = Joi.object({
  nuevaContrasena: Joi.string().min(6).max(255).required().messages({
    "string.min": "La contraseña debe tener al menos 6 caracteres",
  }),
});
