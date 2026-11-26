import mongoose from "mongoose";
import { MODELOS, COLECCIONES } from "./nombres.js";

const { Schema, model } = mongoose;

export const PARENTESCOS = Object.freeze(["cabeza", "conyuge", "hijo", "otro"]);

/**
 * Núcleo familiar. Sus integrantes son personas (miembros o no: un cónyuge que no asiste,
 * hijos pequeños...). Cada persona pertenece como máximo a una familia.
 */
const familiaSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    direccion: { type: String, trim: true },
    observacion: { type: String },
    integrantes: [
      {
        _id: false,
        persona: { type: Schema.Types.ObjectId, ref: MODELOS.PERSONA, required: true },
        parentesco: { type: String, enum: PARENTESCOS, required: true },
      },
    ],
  },
  { timestamps: true, versionKey: false },
);

// Una persona no puede estar en dos familias
familiaSchema.index({ "integrantes.persona": 1 }, { unique: true, partialFilterExpression: { "integrantes.persona": { $exists: true } } });

export const FamiliaModel = model(MODELOS.FAMILIA, familiaSchema, COLECCIONES[MODELOS.FAMILIA]);
