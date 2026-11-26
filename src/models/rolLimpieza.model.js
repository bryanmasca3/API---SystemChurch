import mongoose from "mongoose";
import { MODELOS } from "./nombres.js";

const { Schema, model } = mongoose;

const rolLimpiezaSchema = new Schema({
  membermain: { type: Schema.Types.ObjectId, ref: MODELOS.MIEMBRO, required: true },
  date: { type: Date },
});

export const RolLimpiezaModel = model(MODELOS.ROL_LIMPIEZA, rolLimpiezaSchema);
