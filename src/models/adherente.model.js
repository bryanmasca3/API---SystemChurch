import mongoose from "mongoose";
import { MODELOS } from "./nombres.js";

const { Schema, model } = mongoose;

const adherenteSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    observacion: { type: String },
    // Miembro que lo invitó
    relation: { type: Schema.Types.ObjectId, ref: MODELOS.MIEMBRO },
    // Datos personales del adherente (campo nuevo, opcional)
    person: { type: Schema.Types.ObjectId, ref: MODELOS.PERSONA },
  },
  { timestamps: true },
);

export const AdherenteModel = model(MODELOS.ADHERENTE, adherenteSchema);
