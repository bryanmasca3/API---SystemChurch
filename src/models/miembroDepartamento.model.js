import mongoose from "mongoose";
import { MODELOS } from "./nombres.js";

const { Schema, model } = mongoose;

// Miembro que integra un departamento con un rol (presidente, secretario...)
const miembroDepartamentoSchema = new Schema({
  departament: { type: Schema.Types.ObjectId, ref: MODELOS.DEPARTAMENTO, required: true },
  member: { type: Schema.Types.ObjectId, ref: MODELOS.MIEMBRO, required: true },
  role: { type: Schema.Types.ObjectId, ref: MODELOS.ROL_MIEMBRO, required: true },
});

export const MiembroDepartamentoModel = model(
  MODELOS.MIEMBRO_DEPARTAMENTO,
  miembroDepartamentoSchema,
);
