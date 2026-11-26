import mongoose from "mongoose";
import { MODELOS, COLECCIONES } from "./nombres.js";

const { Schema, model } = mongoose;

/**
 * Persona inscrita en un ministerio o departamento SIN necesidad de ser miembro:
 * niños (Ministerio de Niños), adolescentes, jóvenes que aún no son miembros...
 * Los integrantes con cargo (presidente, maestro) siguen en MiembroDepartamento.
 */
const inscripcionSchema = new Schema(
  {
    departamento: { type: Schema.Types.ObjectId, ref: MODELOS.DEPARTAMENTO, required: true },
    persona: { type: Schema.Types.ObjectId, ref: MODELOS.PERSONA, required: true },
    fecha_inscripcion: { type: Date, required: true },
    // Padre, madre o tutor responsable (para menores)
    apoderado: { type: Schema.Types.ObjectId, ref: MODELOS.PERSONA },
    observacion: { type: String },
    activo: { type: Boolean, default: true },
    fecha_retiro: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

// Una persona no puede estar inscrita dos veces (activa) en el mismo departamento
inscripcionSchema.index({ departamento: 1, persona: 1 }, { unique: true, partialFilterExpression: { activo: true } });

export const InscripcionModel = model(MODELOS.INSCRIPCION, inscripcionSchema, COLECCIONES[MODELOS.INSCRIPCION]);
