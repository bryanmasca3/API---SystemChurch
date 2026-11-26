import mongoose from "mongoose";
import { MODELOS } from "./nombres.js";

const { Schema, model } = mongoose;

/** Funciones del programa de cada culto (iguales para todos los servicios). */
export const FUNCIONES = Object.freeze(["director", "predicador", "lectura_biblica"]);

/** Quién cumple una función: un miembro o un invitado externo (p. ej. predicador de otra iglesia). */
const asignacionSchema = new Schema(
  {
    miembro: { type: Schema.Types.ObjectId, ref: MODELOS.MIEMBRO },
    invitado: { type: String, trim: true },
    iglesia: { type: String, trim: true },
    // Solo predicador
    tema: { type: String, trim: true },
    texto_biblico: { type: String, trim: true },
    // Solo lectura bíblica
    pasaje: { type: String, trim: true },
  },
  { _id: false },
);

// Cada vez que un servicio semanal ocurre en una fecha concreta (p. ej. el culto del 10 de marzo).
// La asistencia se registra contra la sesión, y su programa dice quién dirige, predica y lee.
const sesionServicioSchema = new Schema({
  // Fecha y hora de inicio en un solo campo
  date: { type: Date, required: true },
  service: { type: Schema.Types.ObjectId, ref: MODELOS.SERVICIO, required: true },
  observation: { type: String },
  programa: {
    director: { type: asignacionSchema, default: undefined },
    predicador: { type: asignacionSchema, default: undefined },
    lectura_biblica: { type: asignacionSchema, default: undefined },
  },
});

sesionServicioSchema.index({ service: 1, date: -1 });
sesionServicioSchema.index({ "programa.director.miembro": 1 });
sesionServicioSchema.index({ "programa.predicador.miembro": 1 });
sesionServicioSchema.index({ "programa.lectura_biblica.miembro": 1 });

export const SesionServicioModel = model(MODELOS.SESION_SERVICIO, sesionServicioSchema);
