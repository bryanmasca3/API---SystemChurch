import mongoose from "mongoose";
import { MODELOS } from "./nombres.js";

const { Schema, model } = mongoose;

// Miembro que asistió a una reunión
const reunionMiembroSchema = new Schema(
  {
    member: { type: Schema.Types.ObjectId, ref: MODELOS.MIEMBRO, required: true },
    meeting: { type: Schema.Types.ObjectId, ref: MODELOS.REUNION, required: true },
    observacion: { type: String },
  },
  { timestamps: true },
);

export const ReunionMiembroModel = model(MODELOS.REUNION_MIEMBRO, reunionMiembroSchema);
