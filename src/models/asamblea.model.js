import mongoose from "mongoose";
import { MODELOS, COLECCIONES } from "./nombres.js";

const { Schema, model } = mongoose;

export const TIPOS_ASAMBLEA = Object.freeze(["ordinaria", "extraordinaria"]);

/**
 * Asamblea de la iglesia. La lista de miembros hábiles se calcula con los `criterios`
 * y puede CONGELARSE (padrón electoral de esa asamblea) para que no cambie después.
 */
const asambleaSchema = new Schema(
  {
    numero: { type: Number, required: true, unique: true },
    fecha: { type: Date, required: true },
    tipo: { type: String, enum: TIPOS_ASAMBLEA, required: true },
    lugar: { type: String, trim: true },
    agenda: { type: String },
    acta_numero: { type: String, trim: true },
    observacion: { type: String },
    criterios: {
      meses: { type: Number, required: true },
      edad_minima: { type: Number, required: true },
      asistencia_dominical_pct: { type: Number, required: true },
      santa_cena_pct: { type: Number, required: true },
    },
    // Padrón de hábiles congelado (vacío = se calcula en vivo)
    habiles_congelados: { type: Boolean, default: false },
    habiles: [{ type: Schema.Types.ObjectId, ref: MODELOS.MIEMBRO }],
    asistentes: [
      {
        _id: false,
        miembro: { type: Schema.Types.ObjectId, ref: MODELOS.MIEMBRO, required: true },
        habil: { type: Boolean, required: true },
        registrado: { type: Date, default: Date.now },
      },
    ],
    registrado_por: { type: Schema.Types.ObjectId, ref: MODELOS.USUARIO },
  },
  { timestamps: true, versionKey: false },
);

export const AsambleaModel = model(MODELOS.ASAMBLEA, asambleaSchema, COLECCIONES[MODELOS.ASAMBLEA]);
