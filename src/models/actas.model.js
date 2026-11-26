import mongoose from "mongoose";
import { MODELOS, COLECCIONES } from "./nombres.js";

const { Schema, model } = mongoose;

/** Campos comunes de las actas: número correlativo por tipo y anulación (no se borran). */
const camposActa = {
  numero: { type: Number, required: true, unique: true },
  fecha: { type: Date, required: true },
  lugar: { type: String, trim: true },
  observacion: { type: String },
  registrado_por: { type: Schema.Types.ObjectId, ref: MODELOS.USUARIO },
  anulada: { type: Boolean, default: false },
  anulacion: {
    fecha: { type: Date },
    motivo: { type: String },
    usuario: { type: Schema.Types.ObjectId, ref: MODELOS.USUARIO },
  },
};
const opciones = { timestamps: true, versionKey: false };

// --- Bautismo (solo adultos) ---
const actaBautismoSchema = new Schema(
  {
    ...camposActa,
    persona: { type: Schema.Types.ObjectId, ref: MODELOS.PERSONA, required: true },
    // Miembro creado/admitido por este bautismo
    miembro: { type: Schema.Types.ObjectId, ref: MODELOS.MIEMBRO },
    oficiante: { type: String, required: true, trim: true },
    testigos: [{ type: String, trim: true }],
  },
  opciones,
);
// Una persona tiene un solo bautismo vigente
actaBautismoSchema.index({ persona: 1 }, { unique: true, partialFilterExpression: { anulada: false } });

// --- Matrimonio ---
const actaMatrimonioSchema = new Schema(
  {
    ...camposActa,
    contrayente1: { type: Schema.Types.ObjectId, ref: MODELOS.PERSONA, required: true },
    contrayente2: { type: Schema.Types.ObjectId, ref: MODELOS.PERSONA, required: true },
    oficiante: { type: String, required: true, trim: true },
    testigos: [{ type: String, trim: true }],
    registro_civil: {
      municipalidad: { type: String, trim: true },
      numero_partida: { type: String, trim: true },
      fecha: { type: Date },
    },
    familia: { type: Schema.Types.ObjectId, ref: MODELOS.FAMILIA },
  },
  opciones,
);
actaMatrimonioSchema.index({ contrayente1: 1 });
actaMatrimonioSchema.index({ contrayente2: 1 });

// --- Disciplina (CONFIDENCIAL: solo pastor y administrador) ---
export const MEDIDAS_DISCIPLINA = Object.freeze(["amonestacion", "suspension_santa_cena", "exclusion"]);
// vigente: la medida sigue aplicándose · levantada: hubo restauración · registrada: amonestación (no cambia el estado)
export const ESTADOS_DISCIPLINA = Object.freeze(["vigente", "levantada", "registrada"]);

const actaDisciplinaSchema = new Schema(
  {
    ...camposActa,
    miembro: { type: Schema.Types.ObjectId, ref: MODELOS.MIEMBRO, required: true },
    acta_consistorio: { type: String, required: true, trim: true },
    medida: { type: String, enum: MEDIDAS_DISCIPLINA, required: true },
    motivo: { type: String, required: true },
    // Fecha prevista para revisar la medida (opcional)
    fecha_revision: { type: Date },
    estado: { type: String, enum: ESTADOS_DISCIPLINA, required: true },
    restauracion: {
      fecha: { type: Date },
      acta_consistorio: { type: String, trim: true },
      observacion: { type: String },
    },
  },
  opciones,
);
actaDisciplinaSchema.index({ miembro: 1, estado: 1 });

export const ActaBautismoModel = model(MODELOS.ACTA_BAUTISMO, actaBautismoSchema, COLECCIONES[MODELOS.ACTA_BAUTISMO]);
export const ActaMatrimonioModel = model(MODELOS.ACTA_MATRIMONIO, actaMatrimonioSchema, COLECCIONES[MODELOS.ACTA_MATRIMONIO]);
export const ActaDisciplinaModel = model(MODELOS.ACTA_DISCIPLINA, actaDisciplinaSchema, COLECCIONES[MODELOS.ACTA_DISCIPLINA]);

// --- Dedicación de niños (distinta del bautismo: los padres presentan al niño) ---
const actaDedicacionSchema = new Schema(
  {
    ...camposActa,
    nino: { type: Schema.Types.ObjectId, ref: MODELOS.PERSONA, required: true },
    padres: [{ type: Schema.Types.ObjectId, ref: MODELOS.PERSONA }],
    oficiante: { type: String, required: true, trim: true },
    testigos: [{ type: String, trim: true }],
    familia: { type: Schema.Types.ObjectId, ref: MODELOS.FAMILIA },
  },
  opciones,
);
actaDedicacionSchema.index({ nino: 1 }, { unique: true, partialFilterExpression: { anulada: false } });

export const ActaDedicacionModel = model(
  MODELOS.ACTA_DEDICACION,
  actaDedicacionSchema,
  COLECCIONES[MODELOS.ACTA_DEDICACION],
);

// --- Contador de correlativos por tipo de acta ---
const contadorSchema = new Schema({ _id: { type: String }, secuencia: { type: Number, default: 0 } }, { versionKey: false });
export const ContadorModel = model(MODELOS.CONTADOR, contadorSchema, COLECCIONES[MODELOS.CONTADOR]);
