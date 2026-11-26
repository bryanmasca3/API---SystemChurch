import mongoose from "mongoose";
import { MODELOS, COLECCIONES } from "./nombres.js";

const { Schema, model } = mongoose;

export const ESTADOS_BIEN = Object.freeze(["nuevo", "bueno", "regular", "malo", "inservible"]);

/**
 * Bien del inventario de la iglesia (equipo de sonido, sillas, instrumentos...).
 * `cantidad` y `cantidad_prestada` NO se editan a mano: las mueven los movimientos.
 */
const bienSchema = new Schema(
  {
    // Código patrimonial o etiqueta pegada al bien (opcional, único si se usa)
    codigo: { type: String, trim: true, uppercase: true },
    nombre: { type: String, required: true, trim: true },
    descripcion: { type: String },
    categoria: { type: Schema.Types.ObjectId, ref: MODELOS.CATEGORIA_INVENTARIO, required: true },
    // Unidades que la iglesia posee (incluye las prestadas)
    cantidad: { type: Number, required: true, min: 0, default: 0 },
    // Unidades que están fuera, prestadas
    cantidad_prestada: { type: Number, required: true, min: 0, default: 0 },
    estado: { type: String, enum: ESTADOS_BIEN, default: "bueno" },
    ubicacion: { type: String, trim: true },
    // Departamento dueño o responsable (vacío = de toda la iglesia)
    departamento: { type: Schema.Types.ObjectId, ref: MODELOS.DEPARTAMENTO },
    // Miembro encargado de cuidarlo
    encargado: { type: Schema.Types.ObjectId, ref: MODELOS.MIEMBRO },
    fecha_adquisicion: { type: Date },
    // Valor referencial en soles
    valor: { type: Number, min: 0 },
    observacion: { type: String },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true, id: false },
    toObject: { virtuals: true, id: false },
  },
);

// Unidades que hay en la iglesia en este momento
bienSchema.virtual("disponible").get(function disponible() {
  return this.cantidad - this.cantidad_prestada;
});

bienSchema.index({ codigo: 1 }, { unique: true, partialFilterExpression: { codigo: { $type: "string" } } });
bienSchema.index({ categoria: 1 });
bienSchema.index({ departamento: 1 });

export const BienModel = model(MODELOS.BIEN, bienSchema, COLECCIONES[MODELOS.BIEN]);
