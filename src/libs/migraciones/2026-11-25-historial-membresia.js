/**
 * Migración 2026-11-25: historial de membresía inicial.
 *
 *   npm run migrar:historial              -> SIMULACIÓN
 *   npm run migrar:historial -- --aplicar -> escribe
 *
 * A cada miembro SIN historial le crea un evento "registro" con su fecha de alta real
 * (createdAt) y su estado actual, para que su historial tenga punto de partida.
 * Idempotente: los miembros que ya tienen eventos no se tocan.
 */
import mongoose from "mongoose";
import config from "../../config/env.config.js";
import { MiembroModel } from "../../models/miembro.model.js";
import { EventoMembresiaModel } from "../../models/eventoMembresia.model.js";

const APLICAR = process.argv.includes("--aplicar");

await mongoose.connect(config.MONGO_URI, { autoIndex: false });
console.log(`BD: ${mongoose.connection.name} | modo: ${APLICAR ? "APLICAR" : "SIMULACIÓN (usa --aplicar para escribir)"}\n`);

const conHistorial = new Set((await EventoMembresiaModel.distinct("miembro")).map(String));
const miembros = await MiembroModel.find({}, { state: 1, createdAt: 1 }).lean();
const pendientes = miembros.filter((m) => !conHistorial.has(String(m._id)));

const eventos = pendientes.map((m) => ({
  miembro: m._id,
  tipo: "registro",
  // Los miembros sin createdAt usan la fecha de su ObjectId
  fecha: m.createdAt ?? m._id.getTimestamp(),
  observacion: "Registro histórico (miembro anterior al historial de membresía)",
  estado_anterior: null,
  estado_nuevo: m.state,
}));

console.log(`Miembros: ${miembros.length} | ya con historial: ${miembros.length - pendientes.length} | a registrar: ${eventos.length}`);
if (APLICAR && eventos.length) {
  await EventoMembresiaModel.createIndexes();
  await EventoMembresiaModel.insertMany(eventos);
}

await mongoose.disconnect();
console.log(APLICAR ? "\nHistorial inicial creado." : "\nSimulación: no se escribió nada.");
