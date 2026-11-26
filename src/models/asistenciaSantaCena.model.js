import mongoose from "mongoose";
import { MODELOS } from "./nombres.js";

const { Schema, model } = mongoose;

// Asistencia de un miembro a la Santa Cena en una sesión de servicio
const asistenciaSantaCenaSchema = new Schema(
  {
    sesion: { type: Schema.Types.ObjectId, ref: MODELOS.SESION_SERVICIO, required: true },
    miembro: { type: Schema.Types.ObjectId, ref: MODELOS.MIEMBRO, required: true },
  },
  { timestamps: true },
);

// Un miembro se registra una sola vez por sesión
asistenciaSantaCenaSchema.index({ sesion: 1, miembro: 1 }, { unique: true });

export const AsistenciaSantaCenaModel = model(
  MODELOS.ASISTENCIA_SANTA_CENA,
  asistenciaSantaCenaSchema,
);
