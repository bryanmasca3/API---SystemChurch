import mongoose from "mongoose";
import { MODELOS, COLECCIONES } from "./nombres.js";

const { Schema, model } = mongoose;

export const TIPOS_FONDO = Object.freeze(["caja", "banco", "fondo"]);

/**
 * Fondo de dinero: caja general, cuenta bancaria, fondo de misiones, fondo de un departamento...
 * El saldo NO se guarda: se calcula a partir de saldo_inicial + movimientos no anulados.
 */
const fondoSchema = new Schema(
  {
    nombre: { type: String, required: true, unique: true, trim: true },
    tipo: { type: String, enum: TIPOS_FONDO, required: true },
    descripcion: { type: String },
    // Fondo propio de un departamento (vacío = de toda la iglesia). Su líder puede consultarlo.
    departamento: { type: Schema.Types.ObjectId, ref: MODELOS.DEPARTAMENTO },
    // Banco y número de cuenta, si es una cuenta bancaria
    entidad: { type: String, trim: true },
    numero_cuenta: { type: String, trim: true },
    // Dinero con el que el fondo empieza a registrarse en el sistema
    saldo_inicial: { type: Number, required: true, default: 0 },
    fecha_inicio: { type: Date, required: true },
    // false = ya no recibe movimientos (se conserva su historial)
    activo: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

export const FondoModel = model(MODELOS.FONDO, fondoSchema, COLECCIONES[MODELOS.FONDO]);
