import mongoose from "mongoose";
import { MODELOS, COLECCIONES } from "./nombres.js";

const { Schema, model } = mongoose;

export const TIPOS_EVENTO = Object.freeze([
  "campana_evangelistica",
  "vigilia",
  "retiro",
  "aniversario",
  "conferencia",
  "culto_especial",
  "actividad_social",
  "otro",
]);
export const ESTADOS_EVENTO = Object.freeze(["programado", "realizado", "postergado", "cancelado"]);

/** Evento del calendario de la iglesia (vigilias, campañas, retiros...). */
const eventoSchema = new Schema(
  {
    titulo: { type: String, required: true, trim: true },
    tipo: { type: String, enum: TIPOS_EVENTO, required: true },
    fecha_inicio: { type: Date, required: true },
    fecha_fin: { type: Date, required: true },
    lugar: { type: String, trim: true },
    descripcion: { type: String },
    // Departamento organizador (su líder puede gestionarlo). Vacío = toda la iglesia.
    departamento: { type: Schema.Types.ObjectId, ref: MODELOS.DEPARTAMENTO },
    responsable: { type: Schema.Types.ObjectId, ref: MODELOS.MIEMBRO },
    estado: { type: String, enum: ESTADOS_EVENTO, default: "programado" },
    observacion: { type: String },
    registrado_por: { type: Schema.Types.ObjectId, ref: MODELOS.USUARIO },
  },
  { timestamps: true, versionKey: false },
);

eventoSchema.index({ fecha_inicio: 1, fecha_fin: 1 });
eventoSchema.index({ departamento: 1 });

export const EventoModel = model(MODELOS.EVENTO, eventoSchema, COLECCIONES[MODELOS.EVENTO]);
