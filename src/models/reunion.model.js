import mongoose from "mongoose";
import { MODELOS } from "./nombres.js";

const { Schema, model } = mongoose;

const reunionSchema = new Schema(
  {
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    typemeeting: { type: Schema.Types.ObjectId, ref: MODELOS.TIPO_REUNION, required: true },
    departament: { type: Schema.Types.ObjectId, ref: MODELOS.DEPARTAMENTO, required: true },
    observacion: { type: String },
    // Fecha y hora en un solo campo
    date: { type: Date, required: true },
  },
  { timestamps: true },
);

export const ReunionModel = model(MODELOS.REUNION, reunionSchema);
