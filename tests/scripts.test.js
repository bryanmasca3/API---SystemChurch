/**
 * Scripts de datos: migración 2026-11-24 y carga de ubigeo.
 * Se ejecutan como procesos aparte contra una MongoDB en memoria.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, ObjectId } from "mongodb";

const ejecutar = promisify(execFile);
const RAIZ = fileURLToPath(new URL("..", import.meta.url));

describe("Scripts de datos", () => {
  let replSet, uri, client, db;
  const correr = async (script, ...args) =>
    (
      await ejecutar(process.execPath, [`src/libs/migraciones/${script}`, ...args], {
        cwd: RAIZ,
        env: { ...process.env, NODE_ENV: "test", MONGO_URI: uri, TOKEN_JWT: "x" },
      })
    ).stdout;

  before(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    uri = replSet.getUri("iep_scripts");
    client = await MongoClient.connect(uri);
    db = client.db("iep_scripts");
  });
  after(async () => {
    await client.close();
    await replSet.stop();
  });

  it("migración: simula sin escribir, aplica, y es idempotente", async () => {
    const dep = new ObjectId(), serv = new ObjectId(), p1 = new ObjectId(), m1 = new ObjectId();
    await db.collection("dep_services").insertMany([
      { _id: serv, description: "LIGA", day: "SABADO", begintime: "Invalid Date", endtime: "Invalid Date", departament: dep },
      { description: "CULTO", day: "Domingo", begintime: "7:00pm", endtime: "8:30 p.m.", departament: dep },
    ]);
    await db.collection("per_aderents").insertOne({ code: "A1", "observación": "hola" });
    await db.collection("per_people").insertOne({ _id: p1, name: "Ana", surname: "R", doi: 4512345, phone: 963211646 });
    await db.collection("per_members").insertOne({ _id: m1, person: p1, state: new ObjectId() });
    await db.collection("met_meetings").insertOne({ subject: "S", date: new Date("2024-04-01T00:00:00Z"), time: new Date("2024-04-01T19:30:00Z") });
    await db.collection("dep_serviceasistances").insertMany([
      { person: p1, services: serv, date: new Date("2024-03-10T00:00:00Z"), time: new Date("2024-03-10T16:05:00Z") },
      { person: p1, services: serv, date: new Date("2024-03-10T00:00:00Z"), time: new Date("2024-03-10T16:10:00Z") }, // duplicado
    ]);
    await db.collection("dep_serviceasistanceholies").insertOne({ person: m1, services: serv, date: new Date("2024-03-17T00:00:00Z") });

    const script = "2026-11-24-correcciones-modelo.js";
    assert.match(await correr(script), /SIMULACIÓN/);
    assert.equal((await db.collection("dep_services").findOne({ _id: serv })).day, "SABADO");

    await correr(script, "--aplicar");
    const [culto, liga] = await db.collection("dep_services").find().sort({ description: 1 }).toArray();
    assert.equal(liga.day, "sábado");
    assert.ok(!("begintime" in liga));
    assert.equal(culto.begintime, "19:00");
    assert.equal(culto.endtime, "20:30");
    assert.equal((await db.collection("per_aderents").findOne()).observacion, "hola");
    const ana = await db.collection("per_people").findOne({ _id: p1 });
    assert.equal(ana.doi, "04512345");
    assert.equal((await db.collection("met_meetings").findOne()).date.toISOString(), "2024-04-01T19:30:00.000Z");
    const asis = await db.collection("dep_serviceasistances").find().toArray();
    assert.equal(asis.length, 1);
    assert.ok(asis[0].sesion && !asis[0].services);
    const sc = await db.collection("dep_serviceasistanceholies").findOne();
    assert.ok(sc.miembro.equals(m1) && !("person" in sc));

    const sesiones = await db.collection("dep_serviceasistancestructs").countDocuments();
    await correr(script, "--aplicar");
    assert.equal(await db.collection("dep_serviceasistancestructs").countDocuments(), sesiones);
  });

  it("historial de membresía inicial: un evento por miembro, idempotente", async () => {
    const estado = new ObjectId();
    const conFecha = new ObjectId();
    await db.collection("per_members").insertMany([
      { _id: conFecha, person: new ObjectId(), state: estado, createdAt: new Date("2023-09-18T22:32:50Z") },
      { person: new ObjectId(), state: estado }, // sin createdAt: usa la fecha del ObjectId
    ]);
    const script = "2026-11-25-historial-membresia.js";
    assert.match(await correr(script), /a registrar: 3/); // + el miembro de la prueba anterior
    assert.equal(await db.collection("ecl_eventos_membresia").countDocuments(), 0);

    await correr(script, "--aplicar");
    const ev = await db.collection("ecl_eventos_membresia").findOne({ miembro: conFecha });
    assert.equal(ev.tipo, "registro");
    assert.equal(ev.fecha.toISOString(), "2023-09-18T22:32:50.000Z");
    assert.ok(ev.estado_nuevo.equals(estado));
    assert.match(await correr(script, "--aplicar"), /a registrar: 0/);
  });

  it("datos iniciales: crea solo lo que falta, sin duplicar por tildes o mayúsculas", async () => {
    await db.collection("util_states").insertOne({ description: "Fallecido" }); // ya existe con otro formato
    await db.collection("dep_departaments").insertMany(
      ["DEPARTAMENTO DE TEOLOGIA", "MINISTERIO DE LITURGIA", "LIGA FEMENINA", "SOCIEDAD DE ESFUERZOS CRISTIANOS", "MINISTERIO DE NIÑOS", "MINISTERIO DE ADOLESCENTES"].map((description) => ({ description })),
    );
    const script = "cargar-datos-iniciales.js";
    assert.match(await correr(script), /SIMULACIÓN/);
    assert.equal(await db.collection("util_rolemembers").countDocuments(), 0);

    const salida = await correr(script, "--aplicar");
    assert.match(salida, /Estados de miembro: 1 ya existen, 2 por crear/);
    assert.equal(await db.collection("util_rolemembers").countDocuments(), 7);
    assert.equal(await db.collection("fin_categorias").countDocuments({ tipo: "egreso" }), 12);
    const culto = await db.collection("dep_services").findOne({ description: "CULTO DOMINICAL" });
    assert.equal(culto.day, "domingo");
    const liga = await db.collection("fin_fondos").findOne({ nombre: "FONDO LIGA FEMENINA" });
    assert.ok(liga.departamento && liga.saldo_inicial === 0);
    assert.equal(await db.collection("fin_fondos").countDocuments(), 7);

    assert.match(await correr(script, "--aplicar"), /0 registro\(s\) creados/);
  });

  it("carga de ubigeo: completa, coherente e idempotente", async () => {
    assert.match(await correr("cargar-ubigeo.js"), /Simulación/);
    assert.equal(await db.collection("util_departaments").countDocuments(), 0);

    await correr("cargar-ubigeo.js", "--aplicar");
    assert.equal(await db.collection("util_departaments").countDocuments(), 25);
    assert.equal(await db.collection("util_provinces").countDocuments(), 196);
    assert.equal(await db.collection("util_districts").countDocuments(), 1893);
    const cayma = await db.collection("util_districts").findOne({ id_ubigeo: "040103" });
    assert.equal(cayma.nombre_ubigeo, "Cayma");
    assert.equal(cayma.id_padre_ubigeo, "0401");
    const callao = await db.collection("util_departaments").findOne({ id_ubigeo: "07" });
    assert.equal(callao.nombre_ubigeo, "Callao");

    const salida = await correr("cargar-ubigeo.js", "--aplicar");
    assert.match(salida, /distritos: 0 insertados, 0 actualizados, 1893 sin cambios/);
  });
});
