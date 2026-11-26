import mongoose from "mongoose";
import { MODELOS, COLECCIONES } from "./nombres.js";

const { Schema, model } = mongoose;

export const TIPOS_MOV_FIN = Object.freeze(["ingreso", "egreso", "transferencia"]);
// Solo ingresos: diezmo (con miembro o anónimo), ofrenda (siempre anónima), otro (con categoría)
export const CLASES_INGRESO = Object.freeze(["diezmo", "ofrenda", "otro"]);
export const MEDIOS_PAGO = Object.freeze(["efectivo", "transferencia", "yape_plin", "deposito", "cheque", "otro"]);
export const TIPOS_COMPROBANTE = Object.freeze(["boleta", "factura", "recibo", "otro"]);

/**
 * Movimiento de dinero. Inmutable: no se edita ni se borra; un error se ANULA con motivo
 * (sigue visible pero no cuenta en saldos ni reportes). Los meses cerrados no admiten cambios.
 */
const movimientoSchema = new Schema(
  {
    tipo: { type: String, enum: TIPOS_MOV_FIN, required: true },
    fecha: { type: Date, required: true },
    // "YYYY-MM" en la zona horaria de la iglesia (se calcula de `fecha`)
    periodo: { type: String, required: true },
    monto: { type: Number, required: true, min: 0.01 },
    // Fondo donde entra (ingreso) o de donde sale (egreso / transferencia)
    fondo: { type: Schema.Types.ObjectId, ref: MODELOS.FONDO, required: true },
    // Solo transferencias
    fondo_destino: { type: Schema.Types.ObjectId, ref: MODELOS.FONDO },
    // Solo ingresos
    clase: { type: String, enum: CLASES_INGRESO },
    // Ingresos "otro" y egresos
    categoria: { type: Schema.Types.ObjectId, ref: MODELOS.CATEGORIA_FINANCIERA },
    // Solo diezmos (opcional: vacío = anónimo). Las ofrendas nunca guardan quién dio.
    miembro: { type: Schema.Types.ObjectId, ref: MODELOS.MIEMBRO },
    // Culto donde se recibió (opcional)
    sesion: { type: Schema.Types.ObjectId, ref: MODELOS.SESION_SERVICIO },
    medio_pago: { type: String, enum: MEDIOS_PAGO, default: "efectivo" },
    descripcion: { type: String },
    // Solo egresos
    beneficiario: { type: String, trim: true },
    comprobante: {
      tipo: { type: String, enum: TIPOS_COMPROBANTE },
      numero: { type: String, trim: true },
    },
    registrado_por: { type: Schema.Types.ObjectId, ref: MODELOS.USUARIO },
    anulado: { type: Boolean, default: false },
    anulacion: {
      fecha: { type: Date },
      motivo: { type: String },
      usuario: { type: Schema.Types.ObjectId, ref: MODELOS.USUARIO },
    },
  },
  { timestamps: true, versionKey: false },
);

movimientoSchema.index({ fondo: 1, anulado: 1, periodo: 1 });
movimientoSchema.index({ fondo_destino: 1, anulado: 1, periodo: 1 });
movimientoSchema.index({ periodo: 1, tipo: 1 });
movimientoSchema.index({ miembro: 1, periodo: 1 });
movimientoSchema.index({ fecha: -1 });

export const MovimientoFinancieroModel = model(
  MODELOS.MOVIMIENTO_FINANCIERO,
  movimientoSchema,
  COLECCIONES[MODELOS.MOVIMIENTO_FINANCIERO],
);
