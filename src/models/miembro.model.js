import mongoose from "mongoose";
import { MODELOS } from "./nombres.js";

const { Schema, model } = mongoose;

const miembroSchema = new Schema(
  {
    dateconvert: { type: Date },
    placeconvert: { type: String },
    datebaptism: { type: Date },
    placebaptism: { type: String },
    state: { type: Schema.Types.ObjectId, ref: MODELOS.ESTADO, required: true },
    typemembership: { type: Schema.Types.ObjectId, ref: MODELOS.TIPO_MEMBRESIA },
    testimony: { type: String },
    // Una persona solo puede ser miembro una vez (índice único)
    person: { type: Schema.Types.ObjectId, ref: MODELOS.PERSONA, required: true, unique: true },
  },
  { timestamps: true },
);

export const MiembroModel = model(MODELOS.MIEMBRO, miembroSchema);
