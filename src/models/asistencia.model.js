import mongoose from "mongoose";
import { MODELOS } from "./nombres.js";

const { Schema, model } = mongoose;

// Asistencia de una persona (miembro o no) a una sesión de servicio.
// La fecha y el servicio se obtienen de la sesión.
const asistenciaSchema = new Schema(
  {
    sesion: { type: Schema.Types.ObjectId, ref: MODELOS.SESION_SERVICIO, required: true },
    person: { type: Schema.Types.ObjectId, ref: MODELOS.PERSONA, required: true },
  },
  { timestamps: true },
);

// Una persona se registra una sola vez por sesión
asistenciaSchema.index({ sesion: 1, person: 1 }, { unique: true });

export const AsistenciaModel = model(MODELOS.ASISTENCIA, asistenciaSchema);
