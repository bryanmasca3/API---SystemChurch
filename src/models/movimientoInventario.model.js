import mongoose from "mongoose";
import { MODELOS, COLECCIONES } from "./nombres.js";

const { Schema, model } = mongoose;

/**
 * Tipos de movimiento y su efecto sobre el bien:
 *  - entrada:    compra o donación          -> cantidad += n
 *  - baja:       se pierde, rompe o regala  -> cantidad -= n   (solo de lo disponible)
 *  - prestamo:   sale prestado a alguien    -> cantidad_prestada += n
 *  - devolucion: vuelve un préstamo         -> cantidad_prestada -= n
 */
export const TIPOS_MOVIMIENTO = Object.freeze(["entrada", "baja", "prestamo", "devolucion"]);

// Historial inmutable: los errores se corrigen con el movimiento contrario
const movimientoSchema = new Schema(
  {
    bien: { type: Schema.Types.ObjectId, ref: MODELOS.BIEN, required: true },
    tipo: { type: String, enum: TIPOS_MOVIMIENTO, required: true },
    cantidad: { type: Number, required: true, min: 1 },
    fecha: { type: Date, required: true, default: Date.now },
    motivo: { type: String },
    // Préstamo: quién se lo lleva. Entrada: quién lo donó (opcional)
    persona: { type: Schema.Types.ObjectId, ref: MODELOS.PERSONA },
    // Solo préstamos
    fecha_devolucion_prevista: { type: Date },
    cantidad_devuelta: { type: Number, min: 0 },
    // Solo devoluciones: el préstamo que se devuelve
    prestamo: { type: Schema.Types.ObjectId, ref: MODELOS.MOVIMIENTO_INVENTARIO },
    // Usuario que registró el movimiento
    registrado_por: { type: Schema.Types.ObjectId, ref: MODELOS.USUARIO },
  },
  { timestamps: true, versionKey: false },
);

movimientoSchema.index({ bien: 1, fecha: -1 });
movimientoSchema.index({ tipo: 1, fecha: -1 });
movimientoSchema.index({ persona: 1 });

export const MovimientoInventarioModel = model(
  MODELOS.MOVIMIENTO_INVENTARIO,
  movimientoSchema,
  COLECCIONES[MODELOS.MOVIMIENTO_INVENTARIO],
);
