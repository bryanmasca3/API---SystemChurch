import mongoose from "mongoose";
import { MODELOS, COLECCIONES } from "./nombres.js";

const { Schema, model } = mongoose;

/**
 * Tipos de evento y el estado en que dejan al miembro (descripción del catálogo de estados;
 * si no existe, se crea). `null` = no cambia el estado.
 * Los de `SOLO_SISTEMA` los generan las actas, no se registran a mano.
 */
export const ESTADO_POR_EVENTO = Object.freeze({
  registro: null, // alta en el sistema / registro histórico
  admision_bautismo: "ACTIVO",
  traslado_recibido: "ACTIVO",
  reafirmacion_fe: "ACTIVO",
  traslado_enviado: "TRASLADADO",
  baja_inasistencia: "INACTIVO",
  fallecimiento: "FALLECIDO",
  disciplina_suspension: "DISCIPLINADO",
  disciplina_exclusion: "EXCLUIDO",
  restauracion: "ACTIVO",
});
export const TIPOS_EVENTO = Object.freeze(Object.keys(ESTADO_POR_EVENTO));
export const SOLO_SISTEMA = Object.freeze([
  "registro",
  "admision_bautismo",
  "disciplina_suspension",
  "disciplina_exclusion",
  "restauracion",
]);
export const TIPOS_EVENTO_MANUAL = Object.freeze(TIPOS_EVENTO.filter((t) => !SOLO_SISTEMA.includes(t)));
// Requieren el nombre de la otra iglesia
export const EVENTOS_CON_IGLESIA = Object.freeze(["traslado_recibido", "traslado_enviado"]);

/** Historial de membresía: cada cambio de estado de un miembro, con fecha y acta. */
const eventoSchema = new Schema(
  {
    miembro: { type: Schema.Types.ObjectId, ref: MODELOS.MIEMBRO, required: true },
    tipo: { type: String, enum: TIPOS_EVENTO, required: true },
    fecha: { type: Date, required: true },
    // Número de acta del consistorio que lo aprobó ("Acta 45")
    acta_consistorio: { type: String, trim: true },
    // Iglesia de origen o destino en los traslados
    iglesia: { type: String, trim: true },
    observacion: { type: String },
    estado_anterior: { type: Schema.Types.ObjectId, ref: MODELOS.ESTADO },
    estado_nuevo: { type: Schema.Types.ObjectId, ref: MODELOS.ESTADO },
    // Acta que generó el evento (bautismo o disciplina)
    acta: { type: Schema.Types.ObjectId },
    registrado_por: { type: Schema.Types.ObjectId, ref: MODELOS.USUARIO },
  },
  { timestamps: true, versionKey: false },
);

eventoSchema.index({ miembro: 1, fecha: -1, createdAt: -1 });
eventoSchema.index({ tipo: 1, fecha: -1 });

export const EventoMembresiaModel = model(
  MODELOS.EVENTO_MEMBRESIA,
  eventoSchema,
  COLECCIONES[MODELOS.EVENTO_MEMBRESIA],
);
