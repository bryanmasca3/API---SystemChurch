import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { iniciarServidor, sembrarBasico } from "./helpers/servidor.js";

describe("Departamentos, servicios, asistencias, reuniones y rol de limpieza", () => {
  let api, datos, t;
  before(async () => {
    api = await iniciarServidor();
    datos = await sembrarBasico(api);
    t = api.tokenAdmin;
  });
  after(() => api.cerrar());

  it("servicio: normaliza el día y valida las horas", async () => {
    const s = await api.esperar(201, "POST", "/servicio", { description: "Culto", day: "DOMINGO", begintime: "19:00", endtime: "20:30", departament: datos.departamento._id }, t);
    assert.equal(s.day, "domingo");
    const sab = await api.esperar(201, "POST", "/servicio", { description: "Jóvenes", day: "Sabado", departament: datos.departamento._id }, t);
    assert.equal(sab.day, "sábado");
    await api.esperar(400, "POST", "/servicio", { description: "M1", day: "funday", departament: datos.departamento._id }, t);
    await api.esperar(400, "POST", "/servicio", { description: "M2", day: "lunes", begintime: "7:00pm", departament: datos.departamento._id }, t);
    await api.esperar(400, "POST", "/servicio", { description: "M3", day: "lunes", begintime: "20:00", endtime: "19:00", departament: datos.departamento._id }, t);
    await api.esperar(400, "PUT", `/servicio/${s._id}`, { endtime: "18:00" }, t); // antes del inicio guardado
  });

  it("asistencias por sesión, sin duplicados y con filtros", async () => {
    const serv = await api.esperar(201, "POST", "/servicio", { description: "Oración", day: "miércoles", departament: datos.departamento._id }, t);
    const s1 = await api.esperar(201, "POST", "/sesion-servicio", { service: serv._id, date: "2024-03-10T19:00:00-05:00" }, t);
    const s2 = await api.esperar(201, "POST", "/sesion-servicio", { service: serv._id, date: "2024-03-17T19:00:00-05:00" }, t);
    const persona = datos.miembro.person._id;

    const a = await api.esperar(201, "POST", "/asistencia", { sesion: s1._id, person: persona }, t);
    assert.equal(a.sesion.service.description, "Oración");
    await api.esperar(409, "POST", "/asistencia", { sesion: s1._id, person: persona }, t);
    await api.esperar(201, "POST", "/asistencia", { sesion: s2._id, person: persona }, t);

    const total = async (q) => (await api.esperar(200, "GET", `/asistencia?${q}`, null, t)).meta.total;
    assert.equal(await total(`sesion=${s1._id}`), 1);
    assert.equal(await total(`servicio=${serv._id}`), 2);
    assert.equal(await total("desde=2024-03-15&hasta=2024-03-31"), 1);
    assert.equal(await total(`sesion=${s1._id}&desde=2024-03-15`), 0);
    await api.esperar(400, "GET", "/asistencia?desde=2024-05-01&hasta=2024-01-01", null, t);

    await api.esperar(409, "DELETE", `/sesion-servicio/${s1._id}`, null, t);
    await api.esperar(409, "DELETE", `/servicio/${serv._id}`, null, t);

    const sc = await api.esperar(201, "POST", "/asistencia-santa-cena", { sesion: s1._id, miembro: datos.miembro._id }, t);
    assert.equal(sc.miembro.person.name, "Juan");
    await api.esperar(409, "POST", "/asistencia-santa-cena", { sesion: s1._id, miembro: datos.miembro._id }, t);
  });

  it("integrantes del departamento sin duplicados", async () => {
    const rol = await api.esperar(201, "POST", "/catalogo/rol-miembro", { description: "Presidente" }, t);
    const ruta = `/departamento/${datos.departamento._id}/integrantes`;
    const i = await api.esperar(201, "POST", ruta, { member: datos.miembro._id, role: rol._id }, t);
    await api.esperar(409, "POST", ruta, { member: datos.miembro._id, role: rol._id }, t);
    await api.esperar(200, "PUT", `${ruta}/${i._id}`, { role: rol._id }, t);
    const lista = await api.esperar(200, "GET", ruta, null, t);
    assert.equal(lista[0].member.person.name, "Juan");
  });

  it("reuniones con asistentes", async () => {
    const tipo = await api.esperar(201, "POST", "/catalogo/tipo-reunion", { description: "Ordinaria" }, t);
    const reu = await api.esperar(201, "POST", "/reunion", { subject: "Sesión", description: "Mensual", typemeeting: tipo._id, departament: datos.departamento._id, date: "2024-04-01T19:00:00-05:00" }, t);
    assert.ok(!("time" in reu));
    const asis = await api.esperar(201, "POST", `/reunion/${reu._id}/asistentes`, { member: datos.miembro._id }, t);
    await api.esperar(409, "POST", `/reunion/${reu._id}/asistentes`, { member: datos.miembro._id }, t);
    await api.esperar(204, "DELETE", `/reunion/${reu._id}/asistentes/${asis._id}`, null, t);
  });

  it("rol de limpieza: próximo turno", async () => {
    await api.esperar(404, "GET", "/rol-limpieza/actual", null, t);
    await api.esperar(201, "POST", "/rol-limpieza", { membermain: datos.miembro._id, date: "2099-01-07" }, t);
    await api.esperar(201, "POST", "/rol-limpieza", { membermain: datos.miembro._id, date: "2099-01-01" }, t);
    const actual = await api.esperar(200, "GET", "/rol-limpieza/actual", null, t);
    assert.ok(actual.date.startsWith("2099-01-01"));
    assert.equal(actual.membermain.person.name, "Juan");
  });
});
