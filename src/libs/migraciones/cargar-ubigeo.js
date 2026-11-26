/**
 * Carga el ubigeo del Perú (códigos INEI) en util_departaments, util_provinces y util_districts.
 *
 *   npm run cargar:ubigeo              -> SIMULACIÓN: cuenta qué se insertaría/actualizaría
 *   npm run cargar:ubigeo -- --aplicar -> escribe en la BD
 *
 * Idempotente: hace upsert por id_ubigeo, así que se puede volver a ejecutar para actualizar
 * nombres sin cambiar los _id (las personas que ya referencian un ubigeo no se rompen).
 *
 * Datos: datos/ubigeo/*.json, generados desde jmcastagnetto/ubigeo-peru-aumentado (INEI),
 * 25 departamentos, 196 provincias y 1893 distritos. Los nombres vienen en mayúsculas y sin
 * tildes en la fuente; se convirtieron a "Tipo Título" (las tildes no se pueden recuperar).
 */
import fs from "node:fs";
import mongoose from "mongoose";
import config from "../../config/env.config.js";
import {
  UbigeoDepartamentoModel,
  UbigeoProvinciaModel,
  UbigeoDistritoModel,
} from "../../models/ubigeo.model.js";

const APLICAR = process.argv.includes("--aplicar");

const leer = (archivo) =>
  JSON.parse(fs.readFileSync(new URL(`./datos/ubigeo/${archivo}`, import.meta.url), "utf8"));

const NIVELES = [
  { etiqueta: "departamentos", model: UbigeoDepartamentoModel, datos: leer("departamentos.json") },
  { etiqueta: "provincias", model: UbigeoProvinciaModel, datos: leer("provincias.json") },
  { etiqueta: "distritos", model: UbigeoDistritoModel, datos: leer("distritos.json") },
];

await mongoose.connect(config.MONGO_URI, { autoIndex: false });
console.log(`BD: ${mongoose.connection.name} | modo: ${APLICAR ? "APLICAR" : "SIMULACIÓN (usa --aplicar para escribir)"}\n`);

// Si ya hay ubigeo cargado con otro esquema de ids (p. ej. "2534" en vez de "04"), no se mezcla
for (const { etiqueta, model, datos } of NIVELES) {
  const ids = new Set(datos.map((d) => d.id_ubigeo));
  const ajenos = await model.countDocuments({ id_ubigeo: { $nin: [...ids] } });
  if (ajenos) {
    console.error(
      `${etiqueta}: hay ${ajenos} registro(s) con ids que no son códigos INEI. ` +
        "Revisa o vacía la colección antes de cargar, para no mezclar dos listas.",
    );
    await mongoose.disconnect();
    process.exit(1);
  }
}

for (const { etiqueta, model, datos } of NIVELES) {
  const existentes = await model.countDocuments();
  if (APLICAR) {
    await model.createIndexes();
    const r = await model.bulkWrite(
      datos.map((d) => ({
        updateOne: { filter: { id_ubigeo: d.id_ubigeo }, update: { $set: d }, upsert: true },
      })),
      { ordered: false },
    );
    console.log(
      `${etiqueta}: ${r.upsertedCount} insertados, ${r.modifiedCount} actualizados, ` +
        `${datos.length - r.upsertedCount - r.modifiedCount} sin cambios`,
    );
  } else {
    console.log(`${etiqueta}: ${datos.length} en el archivo, ${existentes} ya en la BD`);
  }
}

await mongoose.disconnect();
console.log(APLICAR ? "\nUbigeo cargado." : "\nSimulación: no se escribió nada.");
