import mongoose from "mongoose";
import { MODELOS, COLECCIONES } from "./nombres.js";

const { Schema, model } = mongoose;

// Oficios de gobierno (pueden integrar el consistorio) y otros ministerios de servicio
export const OFICIOS_GOBIERNO = Object.freeze(["pastor", "anciano", "diacono"]);
export const OFICIOS_SERVICIO = Object.freeze(["misionero", "predicador", "evangelista", "maestro"]);
export const OFICIOS = Object.freeze([...OFICIOS_GOBIERNO, ...OFICIOS_SERVICIO]);
// Solo ancianos: ordenado o a prueba
export const CONDICIONES_ANCIANO = Object.freeze(["ordenado", "a_prueba"]);
export const ESTADOS_OFICIAL = Object.freeze(["activo", "cesado", "emerito", "renuncio"]);

/**
 * Periodo de servicio de un oficial de la iglesia. Cada registro es un periodo:
 * al terminar se marca cesado/emérito/renunció con fecha_fin, y un nuevo periodo es otro registro.
 */
const oficialSchema = new Schema(
  {
    miembro: { type: Schema.Types.ObjectId, ref: MODELOS.MIEMBRO, required: true },
    oficio: { type: String, enum: OFICIOS, required: true },
    condicion: { type: String, enum: CONDICIONES_ANCIANO },
    fecha_ordenacion: { type: Date },
    fecha_inicio: { type: Date, required: true },
    // Opcional: los periodos pueden ser fijos o indefinidos
    fecha_fin: { type: Date },
    // Ancianos (ordenados o a prueba) y diáconos pueden integrar o no el consistorio
    integra_consistorio: { type: Boolean, default: false },
    estado: { type: String, enum: ESTADOS_OFICIAL, default: "activo" },
    acta_consistorio: { type: String, trim: true },
    observacion: { type: String },
  },
  { timestamps: true, versionKey: false },
);

// Un miembro no puede tener dos periodos activos del mismo oficio
oficialSchema.index({ miembro: 1, oficio: 1 }, { unique: true, partialFilterExpression: { estado: "activo" } });

export const OficialModel = model(MODELOS.OFICIAL, oficialSchema, COLECCIONES[MODELOS.OFICIAL]);
