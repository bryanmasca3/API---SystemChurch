import mongoose from "mongoose";
import { MODELOS, COLECCIONES } from "./nombres.js";

const { Schema, model } = mongoose;
const ref = (nombre) => ({ type: Schema.Types.ObjectId, ref: nombre });
const opciones = { timestamps: true, versionKey: false };

// ---------------------------------------------------------------------------
// Visitas pastorales (pastor, administrador y ancianos activos)
export const MOTIVOS_VISITA = Object.freeze([
  "rutina",
  "enfermedad",
  "duelo",
  "consejeria",
  "crisis",
  "nuevo_creyente",
  "inasistencia",
  "otro",
]);
export const LUGARES_VISITA = Object.freeze(["hogar", "hospital", "iglesia", "telefono", "virtual", "otro"]);

const visitaSchema = new Schema(
  {
    fecha: { type: Date, required: true },
    // A quién se visitó: una persona, una familia o ambas
    persona: ref(MODELOS.PERSONA),
    familia: ref(MODELOS.FAMILIA),
    // Quiénes visitaron (pastor, ancianos, diáconos...)
    visitantes: [ref(MODELOS.MIEMBRO)],
    motivo: { type: String, enum: MOTIVOS_VISITA, required: true },
    lugar: { type: String, enum: LUGARES_VISITA, default: "hogar" },
    notas: { type: String },
    acuerdos: { type: String },
    proxima_visita: { type: Date },
    // true = solo pastor y administrador (ni los ancianos)
    solo_pastor: { type: Boolean, default: false },
    caso: ref(MODELOS.CASO_DIACONIA),
    registrado_por: ref(MODELOS.USUARIO),
  },
  opciones,
);
visitaSchema.index({ persona: 1, fecha: -1 });
visitaSchema.index({ familia: 1, fecha: -1 });
visitaSchema.index({ fecha: -1 });
visitaSchema.index({ proxima_visita: 1 });

// ---------------------------------------------------------------------------
// Necesitados y enfermos (diaconado)
export const TIPOS_CASO = Object.freeze([
  "enfermedad",
  "economica",
  "alimentaria",
  "vivienda",
  "duelo",
  "discapacidad",
  "adulto_mayor",
  "otro",
]);
export const PRIORIDADES = Object.freeze(["baja", "media", "alta", "urgente"]);
export const ESTADOS_CASO = Object.freeze(["abierto", "en_seguimiento", "cerrado"]);
export const TIPOS_AYUDA = Object.freeze(["economica", "viveres", "medicinas", "visita", "oracion", "otro"]);

const casoSchema = new Schema(
  {
    persona: { ...ref(MODELOS.PERSONA), required: true },
    tipo: { type: String, enum: TIPOS_CASO, required: true },
    descripcion: { type: String, required: true },
    prioridad: { type: String, enum: PRIORIDADES, default: "media" },
    estado: { type: String, enum: ESTADOS_CASO, default: "abierto" },
    fecha_inicio: { type: Date, required: true },
    // Diácono o miembro a cargo
    responsable: ref(MODELOS.MIEMBRO),
    fecha_cierre: { type: Date },
    motivo_cierre: { type: String },
    ayudas: [
      {
        fecha: { type: Date, required: true },
        tipo: { type: String, enum: TIPOS_AYUDA, required: true },
        descripcion: { type: String },
        monto: { type: Number, min: 0 },
        // Egreso registrado en finanzas por el tesorero (opcional)
        movimiento_financiero: ref(MODELOS.MOVIMIENTO_FINANCIERO),
        registrado_por: ref(MODELOS.USUARIO),
      },
    ],
    registrado_por: ref(MODELOS.USUARIO),
  },
  opciones,
);
casoSchema.index({ estado: 1, prioridad: 1 });
casoSchema.index({ persona: 1 });

// ---------------------------------------------------------------------------
// Peticiones de oración (todos; las confidenciales solo pastor, administrador y ancianos)
export const ESTADOS_PETICION = Object.freeze(["activa", "respondida", "cerrada"]);

const peticionSchema = new Schema(
  {
    fecha: { type: Date, required: true },
    // Por quién se ora (opcional: puede ser alguien sin registro, descrito en el texto)
    persona: ref(MODELOS.PERSONA),
    peticion: { type: String, required: true },
    confidencial: { type: Boolean, default: false },
    estado: { type: String, enum: ESTADOS_PETICION, default: "activa" },
    // Cómo respondió Dios: se comparte como testimonio
    testimonio: { type: String },
    fecha_respuesta: { type: Date },
    registrado_por: ref(MODELOS.USUARIO),
  },
  opciones,
);
peticionSchema.index({ estado: 1, fecha: -1 });

// ---------------------------------------------------------------------------
// Seguimiento de nuevos en proceso de evangelismo y discipulado
export const ETAPAS_SEGUIMIENTO = Object.freeze([
  "contacto", // primer contacto (evangelismo, invitación)
  "visitante", // asiste a los cultos
  "en_discipulado", // recibe discipulado
  "preparacion_bautismo",
  "integrado", // bautizado / recibido como miembro
  "sin_seguimiento", // dejó de asistir o no desea continuar
]);
export const ORIGENES = Object.freeze(["invitacion", "evangelismo", "visita_espontanea", "redes_sociales", "otro"]);

const seguimientoSchema = new Schema(
  {
    persona: { ...ref(MODELOS.PERSONA), required: true, unique: true },
    etapa: { type: String, enum: ETAPAS_SEGUIMIENTO, required: true },
    origen: { type: String, enum: ORIGENES, default: "otro" },
    fecha_inicio: { type: Date, required: true },
    invitado_por: ref(MODELOS.MIEMBRO),
    discipulador: ref(MODELOS.MIEMBRO),
    observacion: { type: String },
    // Bitácora del proceso: sesiones de discipulado, cambios de etapa y notas
    avances: [
      {
        fecha: { type: Date, required: true },
        tipo: { type: String, enum: ["sesion", "cambio_etapa", "nota"], required: true },
        etapa: { type: String, enum: ETAPAS_SEGUIMIENTO },
        tema: { type: String },
        observacion: { type: String },
        registrado_por: ref(MODELOS.USUARIO),
      },
    ],
    registrado_por: ref(MODELOS.USUARIO),
  },
  opciones,
);
seguimientoSchema.index({ etapa: 1 });
seguimientoSchema.index({ discipulador: 1 });

export const VisitaModel = model(MODELOS.VISITA, visitaSchema, COLECCIONES[MODELOS.VISITA]);
export const CasoDiaconiaModel = model(MODELOS.CASO_DIACONIA, casoSchema, COLECCIONES[MODELOS.CASO_DIACONIA]);
export const PeticionOracionModel = model(MODELOS.PETICION_ORACION, peticionSchema, COLECCIONES[MODELOS.PETICION_ORACION]);
export const SeguimientoModel = model(MODELOS.SEGUIMIENTO, seguimientoSchema, COLECCIONES[MODELOS.SEGUIMIENTO]);
