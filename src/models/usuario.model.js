import mongoose from "mongoose";
import { MODELOS } from "./nombres.js";
import { LISTA_ROLES, ROLES } from "../config/permisos.js";

const { Schema, model } = mongoose;

const usuarioSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    correo: { type: String, required: true, unique: true, trim: true, lowercase: true },
    // true = debe cambiar la contraseña en su primer ingreso
    login_inicial: { type: Boolean, default: true },
    contrasena: {
      type: String,
      required: true,
      select: false, // nunca se devuelve en consultas (usar .select("+contrasena"))
    },
    // Ver src/config/permisos.js
    rol: { type: String, enum: LISTA_ROLES, required: true, default: ROLES.LECTOR },
    // false = cuenta desactivada (no puede iniciar sesión), sin borrar su historial
    activo: { type: Boolean, default: true },
    // Miembro de la iglesia vinculado a la cuenta. Para el rol "lider" define
    // sus departamentos (aquellos donde el miembro es integrante).
    miembro: { type: Schema.Types.ObjectId, ref: MODELOS.MIEMBRO },
  },
  { timestamps: true, versionKey: false },
);

// Por si el documento viene de create(): tampoco se serializa la contraseña
usuarioSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.contrasena;
    return ret;
  },
});

export const UsuarioModel = model(MODELOS.USUARIO, usuarioSchema);
