/**
 * Datos iniciales: catálogos, servicios dominicales y fondos.
 *
 *   npm run cargar:datos              -> SIMULACIÓN: muestra qué se crearía
 *   npm run cargar:datos -- --aplicar -> escribe en la BD
 *
 * Idempotente: compara sin distinguir mayúsculas ni tildes y solo crea lo que falta.
 * No modifica ni borra nada existente. Todo se puede editar después desde la API.
 */
import mongoose from "mongoose";
import config from "../../config/env.config.js";
import {
  EstadoModel,
  RolMiembroModel,
  TipoReunionModel,
  DonModel,
  CategoriaInventarioModel,
} from "../../models/catalogo.model.js";
import { CategoriaFinancieraModel } from "../../models/categoriaFinanciera.model.js";
import { DepartamentoModel } from "../../models/departamento.model.js";
import { ServicioModel } from "../../models/servicio.model.js";
import { FondoModel } from "../../models/fondo.model.js";

const APLICAR = process.argv.includes("--aplicar");

// ---------------------------------------------------------------------------
// Datos
const CATALOGOS = [
  { etiqueta: "Estados de miembro", model: EstadoModel, valores: ["TRASLADADO", "FALLECIDO", "EXCLUIDO"] },
  {
    etiqueta: "Cargos",
    model: RolMiembroModel,
    valores: ["PRESIDENTE(A)", "VICEPRESIDENTE(A)", "SECRETARIO(A)", "TESORERO(A)", "VOCAL", "MAESTRO(A)", "COORDINADOR(A)"],
  },
  { etiqueta: "Tipos de reunión", model: TipoReunionModel, valores: ["ORDINARIA", "EXTRAORDINARIA", "SESIÓN DE DIRECTIVA"] },
  {
    etiqueta: "Dones",
    model: DonModel,
    valores: [
      "ENSEÑANZA", "PREDICACIÓN", "EVANGELISMO", "SERVICIO", "HOSPITALIDAD", "ADMINISTRACIÓN", "LIDERAZGO",
      "MISERICORDIA", "EXHORTACIÓN", "GENEROSIDAD", "INTERCESIÓN", "MÚSICA Y ALABANZA", "CONSEJERÍA",
    ],
  },
  {
    etiqueta: "Categorías de inventario",
    model: CategoriaInventarioModel,
    valores: [
      "SONIDO Y AUDIO", "INSTRUMENTOS MUSICALES", "MOBILIARIO", "ELECTRODOMÉSTICOS", "COCINA Y MENAJE", "LIMPIEZA",
      "LIBROS Y MATERIAL EDUCATIVO", "EQUIPOS DE CÓMPUTO", "HERRAMIENTAS", "DECORACIÓN", "OTROS",
    ],
  },
];

const CATEGORIAS_FINANCIERAS = {
  ingreso: ["PRIMICIAS", "OFRENDA DE MISIONES", "OFRENDA ESPECIAL", "DONACIONES", "ACTIVIDADES PRO-FONDOS", "OTROS INGRESOS"],
  egreso: [
    "SERVICIOS BÁSICOS", "MANTENIMIENTO E INFRAESTRUCTURA", "LIMPIEZA", "AYUDA SOCIAL (DIACONÍA)", "MISIONES Y EVANGELISMO",
    "APORTE A LAS INSTANCIAS", "SOSTENIMIENTO PASTORAL", "MATERIALES Y ÚTILES", "EVENTOS Y ACTIVIDADES",
    "TRANSPORTE Y MOVILIDAD", "COMUNICACIONES", "OTROS GASTOS",
  ],
};

const SERVICIOS = [
  { description: "ESCUELA DOMINICAL", day: "domingo", begintime: "09:00", endtime: "10:00", departamento: "DEPARTAMENTO DE TEOLOGIA" },
  { description: "CULTO DOMINICAL", day: "domingo", begintime: "10:00", endtime: "12:00", departamento: "MINISTERIO DE LITURGIA" },
];

// Saldo inicial 0: el tesorero lo corrige antes del primer cierre de mes
const FONDOS = [
  { nombre: "CAJA GENERAL", tipo: "caja" },
  { nombre: "FONDO DE MISIONES", tipo: "fondo" },
  { nombre: "FONDO DE DIACONÍA", tipo: "fondo" },
  { nombre: "FONDO LIGA FEMENINA", tipo: "fondo", departamento: "LIGA FEMENINA" },
  { nombre: "FONDO SEC (JÓVENES)", tipo: "fondo", departamento: "SOCIEDAD DE ESFUERZOS CRISTIANOS" },
  { nombre: "FONDO MINISTERIO DE NIÑOS", tipo: "fondo", departamento: "MINISTERIO DE NIÑOS" },
  { nombre: "FONDO MINISTERIO DE ADOLESCENTES", tipo: "fondo", departamento: "MINISTERIO DE ADOLESCENTES" },
];

// ---------------------------------------------------------------------------
const normalizar = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();
let creados = 0;
let pendientesManuales = [];

/** Crea los valores que falten comparando por `campo` normalizado. */
async function asegurar(etiqueta, model, docs, campo = "description", filtroExtra = {}) {
  const existentes = new Set((await model.find(filtroExtra, { [campo]: 1 }).lean()).map((d) => normalizar(d[campo])));
  const faltan = docs.filter((d) => !existentes.has(normalizar(d[campo])));
  console.log(`${etiqueta}: ${docs.length - faltan.length} ya existen, ${faltan.length} por crear${faltan.length ? ` → ${faltan.map((d) => d[campo]).join(", ")}` : ""}`);
  if (APLICAR) for (const d of faltan) await model.create(d);
  creados += faltan.length;
}

/** Busca un departamento por nombre (sin distinguir tildes). */
async function departamento(nombre) {
  const deps = await DepartamentoModel.find({}, { description: 1 }).lean();
  const dep = deps.find((d) => normalizar(d.description) === normalizar(nombre));
  if (!dep) pendientesManuales.push(`No existe el departamento "${nombre}"`);
  return dep?._id;
}

const primerDiaDelMes = () => {
  const [anio, mes] = new Intl.DateTimeFormat("en-CA", { timeZone: config.ZONA_HORARIA, year: "numeric", month: "2-digit" })
    .format(new Date())
    .split("-");
  return new Date(`${anio}-${mes}-01T00:00:00-05:00`);
};

// ---------------------------------------------------------------------------
await mongoose.connect(config.MONGO_URI, { autoIndex: false });
console.log(`BD: ${mongoose.connection.name} | modo: ${APLICAR ? "APLICAR" : "SIMULACIÓN (usa --aplicar para escribir)"}\n`);

for (const { etiqueta, model, valores } of CATALOGOS) {
  await asegurar(etiqueta, model, valores.map((description) => ({ description })));
}
for (const [tipo, valores] of Object.entries(CATEGORIAS_FINANCIERAS)) {
  await asegurar(`Categorías de ${tipo}`, CategoriaFinancieraModel, valores.map((description) => ({ description, tipo })), "description", { tipo });
}

const servicios = [];
for (const s of SERVICIOS) {
  const dep = await departamento(s.departamento);
  if (dep) servicios.push({ description: s.description, day: s.day, begintime: s.begintime, endtime: s.endtime, departament: dep });
}
await asegurar("Servicios dominicales", ServicioModel, servicios);

const inicio = primerDiaDelMes();
const fondos = [];
for (const f of FONDOS) {
  const dep = f.departamento ? await departamento(f.departamento) : undefined;
  if (f.departamento && !dep) continue;
  fondos.push({ nombre: f.nombre, tipo: f.tipo, saldo_inicial: 0, fecha_inicio: inicio, ...(dep && { departamento: dep }) });
}
await asegurar(`Fondos (desde ${inicio.toISOString().slice(0, 10)}, saldo 0)`, FondoModel, fondos, "nombre");

if (pendientesManuales.length) console.log(`\nRevisar:\n  - ${pendientesManuales.join("\n  - ")}`);
console.log(`\n${creados} registro(s) ${APLICAR ? "creados" : "por crear (simulación, no se escribió nada)"}.`);
await mongoose.disconnect();
