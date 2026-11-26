import mongoose from "mongoose";
import { MODELOS } from "./nombres.js";

const { Schema, model } = mongoose;

// Departamento / grupo de la iglesia (Consistorio, Liga Femenina, Escuela Dominical...)
const departamentoSchema = new Schema({
  description: { type: String, required: true, unique: true, trim: true },
});

export const DepartamentoModel = model(MODELOS.DEPARTAMENTO, departamentoSchema);
