import Joi from "joi";
import { idGen, stringStandard, booleanGen, parcial, paginacion } from "./common.schema.js";
import { LISTA_ROLES } from "../config/permisos.js";

const rol = Joi.string()
  .valid(...LISTA_ROLES)
  .messages({ "any.only": `El rol debe ser uno de: ${LISTA_ROLES.join(", ")}` });

export const createUsuarioSchema = Joi.object({
  nombre: stringStandard.required(),
  correo: stringStandard.email().required(),
  contrasena: stringStandard.min(6).optional().allow(""), // vacía = DEFAULT_USER_PASSWORD
  rol: rol.required(),
  activo: booleanGen.optional(),
  // Para el rol "lider" es obligatorio: define sus departamentos
  miembro: idGen.when("rol", { is: "lider", then: Joi.required(), otherwise: Joi.optional().allow(null) }),
  login_inicial: booleanGen.optional(),
});

// contrasena vacía = no se cambia. La regla líder => miembro se valida en el servicio
// contra el valor final (no obliga a reenviar el miembro en cada edición).
export const updateUsuarioSchema = parcial(
  createUsuarioSchema.keys({ miembro: idGen.optional().allow(null) }),
);

export const listarUsuarioSchema = Joi.object({
  rol: rol.optional(),
  activo: booleanGen.optional(),
  ...paginacion,
});
