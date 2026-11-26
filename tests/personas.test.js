import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { iniciarServidor, sembrarBasico } from "./helpers/servidor.js";

describe("Personas, miembros, adherentes y ubigeo", () => {
  let api, datos, t;
  before(async () => {
    api = await iniciarServidor();
    datos = await sembrarBasico(api);
    t = api.tokenAdmin;
  });
  after(() => api.cerrar());

  it("crea un miembro con persona nueva y la devuelve poblada", async () => {
    const m = await api.esperar(201, "POST", "/miembro", {
      state: datos.estado._id,
      placeconvert: "Arequipa",
      person: { name: "Rosa", surname: "Quispe", doi: "04512345", phone: "+51 963 211 646" },
    }, t);
    assert.equal(m.person.name, "Rosa");
    assert.equal(m.person.doi, "04512345"); // conserva el cero
    assert.equal(m.person.phone, "+51 963 211 646");
    assert.equal(m.state.description, "Activo");
  });

  it("no deja persona huérfana si falla el miembro", async () => {
    const antes = (await api.esperar(200, "GET", "/persona", null, t)).meta.total;
    await api.esperar(400, "POST", "/miembro", { state: "507f1f77bcf86cd799439011", person: { name: "X", surname: "Y" } }, t);
    const despues = (await api.esperar(200, "GET", "/persona", null, t)).meta.total;
    assert.equal(despues, antes);
  });

  it("una persona solo puede ser miembro una vez y el DOI es único", async () => {
    await api.esperar(409, "POST", "/miembro", { state: datos.estado._id, person: datos.miembro.person._id }, t);
    await api.esperar(201, "POST", "/persona", { name: "A", surname: "B", doi: "72117609" }, t);
    await api.esperar(409, "POST", "/persona", { name: "C", surname: "D", doi: "72117609" }, t);
    await api.esperar(400, "POST", "/persona", { name: "C", surname: "D", doi: "12-34" }, t);
  });

  it("protege registros en uso", async () => {
    await api.esperar(409, "DELETE", `/catalogo/estado/${datos.estado._id}`, null, t);
    await api.esperar(409, "DELETE", `/persona/${datos.miembro.person._id}`, null, t);
    await api.esperar(409, "POST", "/catalogo/estado", { description: "Activo" }, t);
  });

  it("pagina y busca sin distinguir tildes", async () => {
    for (let i = 0; i < 25; i++) await api.esperar(201, "POST", "/persona", { name: `P${i}`, surname: "Lote" }, t);
    const p1 = await api.esperar(200, "GET", "/persona?limite=10", null, t);
    assert.equal(p1.data.length, 10);
    assert.equal(p1.meta.paginas, Math.ceil(p1.meta.total / 10));
    const busq = await api.esperar(200, "GET", "/persona?buscar=perez", null, t);
    assert.equal(busq.meta.total, 1); // "Pérez"
    await api.esperar(400, "GET", "/persona?limite=500", null, t);
    const cats = await api.esperar(200, "GET", "/catalogo/estado", null, t);
    assert.ok(Array.isArray(cats), "los catálogos no se paginan");
  });

  it("actualización parcial: exige al menos un campo", async () => {
    await api.esperar(400, "PUT", `/miembro/${datos.miembro._id}`, {}, t);
    const m = await api.esperar(200, "PUT", `/miembro/${datos.miembro._id}`, { testimony: "Testimonio" }, t);
    assert.equal(m.testimony, "Testimonio");
  });

  it("valida la jerarquía del ubigeo", async () => {
    const UD = api.mongoose.model("util_departament");
    const UP = api.mongoose.model("util_province");
    const UDi = api.mongoose.model("util_district");
    const u = (id, nombre, padre) => ({ id_ubigeo: id, nombre_ubigeo: nombre, codigo_ubigeo: id, etiqueta_ubigeo: nombre, buscador_ubigeo: nombre, numero_hijos_ubigeo: "1", nivel_ubigeo: "1", id_padre_ubigeo: padre });
    const aqp = await UD.create(u("04", "Arequipa", "00"));
    const lima = await UD.create(u("15", "Lima", "00"));
    const prov = await UP.create(u("0401", "Arequipa", "04"));
    const cayma = await UDi.create(u("040103", "Cayma", "0401"));

    const p = datos.miembro.person._id;
    await api.esperar(200, "PUT", `/persona/${p}`, { departament: aqp._id, province: prov._id, district: cayma._id }, t);
    const r = await api.req("PUT", `/persona/${p}`, { departament: lima._id }, t);
    assert.equal(r.status, 400);
    assert.match(r.body.message, /no pertenece al departamento Lima/);
    const provs = await api.esperar(200, "GET", "/ubigeo/provincia?padre=04", null, t);
    assert.equal(provs.length, 1);
    await api.esperar(400, "GET", "/ubigeo/planeta", null, t);
  });

  it("adherente con invitante y observación", async () => {
    const a = await api.esperar(201, "POST", "/adherente", { code: "ADH-1", relation: datos.miembro._id, observacion: "Invitado" }, t);
    assert.equal(a.observacion, "Invitado");
    assert.equal(a.relation.person.name, "Juan");
    await api.esperar(409, "POST", "/adherente", { code: "ADH-1" }, t);
  });
});
