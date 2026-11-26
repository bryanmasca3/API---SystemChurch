import mongoose from "mongoose";
import { MODELOS } from "./nombres.js";

const { Schema, model } = mongoose;

export const DIAS_SEMANA = Object.freeze([
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
]);

// Formato 24 h: "07:30", "19:00"
export const HORA_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// Servicio semanal (culto de oración, escuela dominical...)
const servicioSchema = new Schema({
  description: { type: String, required: true, unique: true, trim: true },
  day: { type: String, required: true, enum: DIAS_SEMANA },
  begintime: { type: String, match: HORA_HHMM },
  endtime: { type: String, match: HORA_HHMM },
  departament: { type: Schema.Types.ObjectId, ref: MODELOS.DEPARTAMENTO, required: true },
});

export const ServicioModel = model(MODELOS.SERVICIO, servicioSchema);
