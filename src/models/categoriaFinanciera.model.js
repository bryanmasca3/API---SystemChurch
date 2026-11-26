import mongoose from "mongoose";
import { MODELOS, COLECCIONES } from "./nombres.js";

const { Schema, model } = mongoose;

/**
 * Categorías de ingresos "otros" (ofrenda de misiones, donación, venta de actividad...)
 * y de egresos (servicios básicos, mantenimiento, ayuda social...).
 * Diezmo y ofrenda no son categorías: son clases fijas del movimiento.
 */
const categoriaSchema = new Schema(
  {
    description: { type: String, required: true, trim: true },
    tipo: { type: String, enum: ["ingreso", "egreso"], required: true },
  },
  { versionKey: false },
);

categoriaSchema.index({ tipo: 1, description: 1 }, { unique: true });

export const CategoriaFinancieraModel = model(
  MODELOS.CATEGORIA_FINANCIERA,
  categoriaSchema,
  COLECCIONES[MODELOS.CATEGORIA_FINANCIERA],
);
