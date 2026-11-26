/**
 * Migración 2026-11-24: correcciones del modelo de datos.
 *
 *   npm run migrar              -> SIMULACIÓN: muestra qué cambiaría, no escribe nada
 *   npm run migrar -- --aplicar -> aplica los cambios
 *
 * Es idempotente: ejecutarla dos veces no cambia nada la segunda vez.
 * Haz un respaldo de la BD antes de usar --aplicar.
 *
 * 1. Servicios: día normalizado ("SABADO" -> "sábado") y horas a HH:mm (las inválidas se borran).
 * 2. Adherentes: observación -> observacion.
 * 3. Personas: doi y phone de número a texto (DNI con ceros a la izquierda recuperados).
 * 4. Reuniones y sesiones: date + time -> un solo date.
 * 5. Asistencias y Santa Cena: apuntan a la sesión del servicio (se crea si no existe).
 *    Santa Cena: person -> miembro.
 * 6. Índices únicos: persona.doi, miembro.person, (sesion, persona/miembro).
 */
import mongoose from "mongoose";
import config from "../../config/env.config.js";
import { MODELOS } from "../../models/nombres.js";
import { PersonaModel } from "../../models/persona.model.js";
import { MiembroModel } from "../../models/miembro.model.js";
import { SesionServicioModel } from "../../models/sesionServicio.model.js";
import { AsistenciaModel } from "../../models/asistencia.model.js";
import { AsistenciaSantaCenaModel } from "../../models/asistenciaSantaCena.model.js";
import { HORA_HHMM } from "../../models/servicio.model.js";
import { normalizarDia } from "../../schemas/servicio.schema.js";

const APLICAR = process.argv.includes("--aplicar");
const resumen = [];
const anotar = (texto) => {
  resumen.push(texto);
  console.log(`  - ${texto}`);
};

const col = (nombreModelo) => mongoose.connection.collection(mongoose.pluralize()(nombreModelo));

/** "7:00pm", "7 pm", "07:30 a.m.", "19:00" -> "HH:mm"; cualquier otra cosa -> null */
export const convertirHora = (valor) => {
  if (typeof valor !== "string") return null;
  const v = valor.trim().toLowerCase();
  if (HORA_HHMM.test(v)) return v;
  const m = v.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m?\.?$/) || v.match(/^(\d{1,2}):(\d{2})()$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  if (m[3] === "p" && h < 12) h += 12;
  if (m[3] === "a" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
};

/** Día de `fecha` + hora de `hora` (componentes UTC, igual que se guardaron). */
const combinar = (fecha, hora) =>
  new Date(
    Date.UTC(
      fecha.getUTCFullYear(),
      fecha.getUTCMonth(),
      fecha.getUTCDate(),
      hora ? hora.getUTCHours() : 0,
      hora ? hora.getUTCMinutes() : 0,
    ),
  );

const inicioDiaUTC = (fecha) =>
  new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));

async function actualizar(coleccion, filtro, cambios) {
  if (APLICAR) await coleccion.updateOne(filtro, cambios);
}

// ---------------------------------------------------------------------------
async function migrarServicios() {
  console.log("\n1. Servicios");
  const servicios = col(MODELOS.SERVICIO);
  for (const s of await servicios.find().toArray()) {
    const $set = {};
    const $unset = {};
    const dia = normalizarDia(s.day ?? "");
    if (!dia) anotar(`"${s.description}": día "${s.day}" no reconocido, revísalo a mano`);
    else if (dia !== s.day) $set.day = dia;

    for (const campo of ["begintime", "endtime"]) {
      if (s[campo] == null) continue;
      const hora = convertirHora(s[campo]);
      if (hora === s[campo]) continue;
      if (hora) $set[campo] = hora;
      else $unset[campo] = "";
    }
    if (Object.keys($set).length || Object.keys($unset).length) {
      const detalle = [
        ...Object.entries($set).map(([k, v]) => `${k}: "${s[k]}" -> "${v}"`),
        ...Object.keys($unset).map((k) => `${k}: "${s[k]}" -> (vacío)`),
      ].join(", ");
      anotar(`"${s.description}": ${detalle}`);
      await actualizar(servicios, { _id: s._id }, {
        ...(Object.keys($set).length && { $set }),
        ...(Object.keys($unset).length && { $unset }),
      });
    }
  }
}

async function migrarAdherentes() {
  console.log("\n2. Adherentes");
  const adherentes = col(MODELOS.ADHERENTE);
  const n = await adherentes.countDocuments({ "observación": { $exists: true } });
  if (n) {
    anotar(`${n} adherente(s): observación -> observacion`);
    if (APLICAR) await adherentes.updateMany({ "observación": { $exists: true } }, { $rename: { "observación": "observacion" } });
  }
}

async function migrarPersonas() {
  console.log("\n3. Personas");
  const personas = col(MODELOS.PERSONA);
  const conNumeros = await personas
    .find({ $or: [{ doi: { $type: "number" } }, { phone: { $type: "number" } }] })
    .toArray();
  for (const p of conNumeros) {
    const $set = {};
    if (typeof p.doi === "number") {
      const texto = String(p.doi);
      $set.doi = texto.length < 8 ? texto.padStart(8, "0") : texto;
    }
    if (typeof p.phone === "number") $set.phone = String(p.phone);
    await actualizar(personas, { _id: p._id }, { $set });
  }
  if (conNumeros.length) anotar(`${conNumeros.length} persona(s): doi/phone convertidos a texto`);
}

async function unificarFechaHora(nombreModelo, etiqueta) {
  const coleccion = col(nombreModelo);
  const docs = await coleccion.find({ time: { $exists: true } }).toArray();
  for (const d of docs) {
    const date = d.date instanceof Date ? combinar(d.date, d.time instanceof Date ? d.time : null) : d.date;
    await actualizar(coleccion, { _id: d._id }, { $set: { date }, $unset: { time: "" } });
  }
  if (docs.length) anotar(`${docs.length} ${etiqueta}: date + time -> date`);
}

async function migrarFechas() {
  console.log("\n4. Fecha y hora en un solo campo");
  await unificarFechaHora(MODELOS.REUNION, "reunión(es)");
  await unificarFechaHora(MODELOS.SESION_SERVICIO, "sesión(es)");
}

/** Busca la sesión del servicio en ese día; si no existe la crea. */
async function sesionPara(servicioId, fecha, hora, creadas) {
  const desde = inicioDiaUTC(fecha);
  const hasta = new Date(desde.getTime() + 24 * 60 * 60 * 1000);
  const clave = `${servicioId}|${desde.toISOString()}`;
  if (creadas.has(clave)) return creadas.get(clave);

  const existente = await col(MODELOS.SESION_SERVICIO).findOne({
    service: servicioId,
    date: { $gte: desde, $lt: hasta },
  });
  if (existente) return existente._id;

  const _id = new mongoose.Types.ObjectId();
  if (APLICAR) {
    await col(MODELOS.SESION_SERVICIO).insertOne({
      _id,
      service: servicioId,
      date: combinar(fecha, hora),
      observation: "Creada por la migración a partir de asistencias",
    });
  }
  creadas.set(clave, _id);
  return _id;
}

async function migrarAsistencias(nombreModelo, campoPersonaViejo, campoPersonaNuevo, etiqueta) {
  const coleccion = col(nombreModelo);
  const pendientes = await coleccion.find({ sesion: { $exists: false } }).toArray();
  const creadas = new Map();
  let sinDatos = 0;
  for (const a of pendientes) {
    if (!a.services || !(a.date instanceof Date)) {
      sinDatos++;
      continue;
    }
    const sesion = await sesionPara(a.services, a.date, a.time instanceof Date ? a.time : null, creadas);
    const $set = { sesion };
    const $unset = { services: "", date: "", time: "" };
    if (campoPersonaViejo !== campoPersonaNuevo) {
      $set[campoPersonaNuevo] = a[campoPersonaViejo];
      $unset[campoPersonaViejo] = "";
    }
    await actualizar(coleccion, { _id: a._id }, { $set, $unset });
  }
  if (pendientes.length) {
    anotar(`${pendientes.length - sinDatos} ${etiqueta} enlazadas a su sesión (${creadas.size} sesión(es) nueva(s))`);
  }
  if (sinDatos) anotar(`${sinDatos} ${etiqueta} sin servicio o fecha: no se pueden enlazar, revísalas a mano`);

  // Duplicados que impedirían el índice único (misma persona dos veces en la misma sesión)
  if (APLICAR) {
    const dups = await coleccion
      .aggregate([
        { $group: { _id: { s: "$sesion", p: `$${campoPersonaNuevo}` }, ids: { $push: "$_id" }, n: { $sum: 1 } } },
        { $match: { n: { $gt: 1 } } },
      ])
      .toArray();
    const sobrantes = dups.flatMap((d) => d.ids.slice(1));
    if (sobrantes.length) {
      await coleccion.deleteMany({ _id: { $in: sobrantes } });
      anotar(`${sobrantes.length} ${etiqueta} duplicadas eliminadas`);
    }
  }
}

async function migrarAsistenciasTodas() {
  console.log("\n5. Asistencias -> sesiones");
  await migrarAsistencias(MODELOS.ASISTENCIA, "person", "person", "asistencia(s)");
  await migrarAsistencias(MODELOS.ASISTENCIA_SANTA_CENA, "person", "miembro", "asistencia(s) a Santa Cena");
}

async function contarDuplicados(nombreModelo, campo, filtro = {}) {
  const r = await col(nombreModelo)
    .aggregate([
      { $match: { ...filtro, [campo]: { $ne: null } } },
      { $group: { _id: `$${campo}`, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
      { $count: "n" },
    ])
    .toArray();
  return r[0]?.n ?? 0;
}

async function crearIndices() {
  console.log("\n6. Índices únicos");
  const dupDoi = await contarDuplicados(MODELOS.PERSONA, "doi");
  const dupMiembro = await contarDuplicados(MODELOS.MIEMBRO, "person");
  if (dupDoi) anotar(`¡${dupDoi} documento(s) de identidad repetidos! Corrígelos antes de crear el índice`);
  if (dupMiembro) anotar(`¡${dupMiembro} persona(s) registradas como miembro más de una vez! Corrígelas antes`);
  if (dupDoi || dupMiembro) return false;

  if (APLICAR) {
    for (const model of [PersonaModel, MiembroModel, SesionServicioModel, AsistenciaModel, AsistenciaSantaCenaModel]) {
      await model.createIndexes();
    }
  }
  anotar("persona.doi, miembro.person, asistencia(sesion, person), santa cena(sesion, miembro)");
  return true;
}

// ---------------------------------------------------------------------------
await mongoose.connect(config.MONGO_URI, { autoIndex: false });
console.log(`BD: ${mongoose.connection.name} | modo: ${APLICAR ? "APLICAR" : "SIMULACIÓN (usa --aplicar para escribir)"}`);

await migrarServicios();
await migrarAdherentes();
await migrarPersonas();
await migrarFechas();
await migrarAsistenciasTodas();
const indicesOk = await crearIndices();

console.log(`\n${resumen.length ? `${resumen.length} cambio(s)` : "Nada que migrar"}${APLICAR ? " aplicados" : " (simulación, no se escribió nada)"}.`);
await mongoose.disconnect();
process.exit(indicesOk ? 0 : 1);
