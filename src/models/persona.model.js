import mongoose from "mongoose";
import { MODELOS } from "./nombres.js";

const { Schema, model } = mongoose;
const ref = (nombre) => ({ type: Schema.Types.ObjectId, ref: nombre });

export const GRADOS_INSTRUCCION = Object.freeze([
  "sin_estudios",
  "primaria",
  "secundaria",
  "tecnico",
  "universitario",
  "posgrado",
]);

const personaSchema = new Schema({
  name: { type: String, required: true, trim: true },
  surname: { type: String, required: true, trim: true },
  // Texto (no número): conserva ceros a la izquierda y el prefijo +51
  phone: { type: String, trim: true },
  mail: { type: String, trim: true, lowercase: true },
  // Documento de identidad (DNI / CE). Texto para no perder ceros a la izquierda
  doi: { type: String, trim: true },
  gender: ref(MODELOS.GENERO),
  photo: { type: String },
  civilstatus: ref(MODELOS.ESTADO_CIVIL),
  // Lugar de nacimiento
  dob: { type: Date },
  departamentdob: ref(MODELOS.UBIGEO_DEPARTAMENTO),
  provincedob: ref(MODELOS.UBIGEO_PROVINCIA),
  districtdob: ref(MODELOS.UBIGEO_DISTRITO),
  // Domicilio
  address: { type: String },
  reference: { type: String },
  departament: ref(MODELOS.UBIGEO_DEPARTAMENTO),
  province: ref(MODELOS.UBIGEO_PROVINCIA),
  district: ref(MODELOS.UBIGEO_DISTRITO),

  // Dones, capacidades y profesiones (cartilla: Educación Teológica)
  grado_instruccion: { type: String, enum: GRADOS_INSTRUCCION },
  profesion: { type: String, trim: true },
  ocupacion: { type: String, trim: true },
  idiomas: [{ type: String, trim: true }],
  // Habilidades prácticas: música, cocina, carpintería, sonido...
  capacidades: [{ type: String, trim: true }],
  dones: [ref(MODELOS.DON)],
});

personaSchema.index({ dones: 1 });

// Un documento de identidad no puede repetirse (las personas sin DOI no cuentan)
personaSchema.index(
  { doi: 1 },
  { unique: true, partialFilterExpression: { doi: { $type: "string" } } },
);

export const PersonaModel = model(MODELOS.PERSONA, personaSchema);
