import mongoose from "mongoose";
import { MODELOS, COLECCIONES } from "./nombres.js";

const { Schema, model } = mongoose;

const saldoFondoSchema = new Schema(
  {
    fondo: { type: Schema.Types.ObjectId, ref: MODELOS.FONDO, required: true },
    nombre: { type: String, required: true },
    saldo_inicial: { type: Number, required: true },
    ingresos: { type: Number, required: true },
    egresos: { type: Number, required: true },
    transferencias_entrada: { type: Number, required: true },
    transferencias_salida: { type: Number, required: true },
    saldo_final: { type: Number, required: true },
  },
  { _id: false },
);

/**
 * Cierre de un mes: bloquea sus movimientos y deja una foto de los saldos de cada fondo
 * para el informe al consistorio. Solo un administrador puede reabrirlo.
 */
const cierreSchema = new Schema(
  {
    periodo: { type: String, required: true, unique: true },
    fecha_cierre: { type: Date, required: true, default: Date.now },
    cerrado_por: { type: Schema.Types.ObjectId, ref: MODELOS.USUARIO },
    observacion: { type: String },
    saldos: { type: [saldoFondoSchema], default: [] },
  },
  { versionKey: false },
);

export const CierreMensualModel = model(
  MODELOS.CIERRE_MENSUAL,
  cierreSchema,
  COLECCIONES[MODELOS.CIERRE_MENSUAL],
);
