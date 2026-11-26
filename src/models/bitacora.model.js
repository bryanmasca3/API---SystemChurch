import mongoose from "mongoose";
import { MODELOS, COLECCIONES } from "./nombres.js";

const { Schema, model } = mongoose;

export const ACCIONES_BITACORA = Object.freeze([
  "crear",
  "actualizar",
  "eliminar",
  "movimiento",
  "login",
  "login_fallido",
]);

/** Registro de auditoría: quién hizo qué, cuándo y desde dónde. Solo se inserta. */
const bitacoraSchema = new Schema(
  {
    fecha: { type: Date, default: Date.now, required: true },
    usuario: { type: Schema.Types.ObjectId, ref: MODELOS.USUARIO },
    accion: { type: String, enum: ACCIONES_BITACORA, required: true },
    // Tipo de registro afectado ("Miembro", "Bien"...)
    recurso: { type: String, required: true },
    documento: { type: Schema.Types.ObjectId },
    resumen: { type: String },
    // crear: { despues } · eliminar: { antes } · actualizar: { campo: { antes, despues } }
    cambios: { type: Schema.Types.Mixed },
    ip: { type: String },
  },
  { versionKey: false },
);

bitacoraSchema.index({ fecha: -1 });
bitacoraSchema.index({ documento: 1, fecha: -1 });
bitacoraSchema.index({ usuario: 1, fecha: -1 });

export const BitacoraModel = model(MODELOS.BITACORA, bitacoraSchema, COLECCIONES[MODELOS.BITACORA]);
