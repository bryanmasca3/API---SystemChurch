import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { iniciarServidor } from "./helpers/servidor.js";

describe("Registro eclesiástico", () => {
  let api, t, tk, activo;
  const persona = (name, surname) => ({ name, surname });
  const nuevoMiembro = (name, extra = {}) =>
    api.esperar(201, "POST", "/miembro", { state: activo._id, person: persona(name, "Test"), ...extra }, t);
  const estadoDe = async (miembroId) =>
    (await api.esperar(200, "GET", `/miembro/${miembroId}`, null, t)).state.description;
  const historial = (miembroId) => api.esperar(200, "GET", `/miembro/${miembroId}/historial`, null, t);

  before(async () => {
    api = await iniciarServidor();
    t = api.tokenAdmin;
    activo = await api.esperar(201, "POST", "/catalogo/estado", { description: "ACTIVO" }, t);
    tk = {};
    for (const r of ["pastor", "secretario", "lector"]) tk[r] = (await api.crearUsuario(r)).token;
  });
  after(() => api.cerrar());

  describe("Historial de membresía", () => {
    it("todo miembro nuevo empieza con un evento en su historial", async () => {
      const m = await nuevoMiembro("Alta");
      const h = await historial(m._id);
      assert.equal(h.length, 1);
      assert.equal(h[0].tipo, "registro");
      assert.equal(h[0].estado_nuevo.description, "ACTIVO");
    });

    it("ingreso por traslado: requiere la iglesia y define el estado", async () => {
      await api.esperar(400, "POST", "/miembro", { person: persona("Tras", "L"), ingreso: { tipo: "traslado_recibido", fecha: "2024-01-10" } }, t);
      const m = await api.esperar(201, "POST", "/miembro", {
        person: persona("Tras", "L"),
        ingreso: { tipo: "traslado_recibido", fecha: "2024-01-10", iglesia: "IEP Cayma", acta_consistorio: "Acta 78" },
      }, t);
      assert.equal(m.state.description, "ACTIVO");
      const [ev] = await historial(m._id);
      assert.equal(ev.tipo, "traslado_recibido");
      assert.equal(ev.iglesia, "IEP Cayma");
    });

    it("el estado y el bautismo ya no se editan a mano", async () => {
      const m = await nuevoMiembro("NoEdit");
      const r = await api.req("PUT", `/miembro/${m._id}`, { state: activo._id }, t);
      assert.equal(r.status, 400);
      assert.match(r.body.message, /historial/);
      const r2 = await api.req("PUT", `/miembro/${m._id}`, { datebaptism: "2020-01-01" }, t);
      assert.match(r2.body.message, /POST \/actas\/bautismo/);
    });

    it("eventos manuales cambian el estado, en orden, y el último se puede deshacer", async () => {
      const m = await nuevoMiembro("Hist");
      const ruta = `/miembro/${m._id}/historial`;
      await api.esperar(400, "POST", ruta, { tipo: "traslado_enviado", fecha: "2025-06-01" }, t); // falta iglesia
      await api.esperar(400, "POST", ruta, { tipo: "admision_bautismo", fecha: "2025-06-01" }, t); // solo por acta
      // El alta fue hoy: el evento no puede ser anterior
      const traslado = await api.esperar(201, "POST", ruta, { tipo: "traslado_enviado", fecha: new Date().toISOString(), iglesia: "IEP Tacna" }, t);
      assert.equal(await estadoDe(m._id), "TRASLADADO"); // estado creado automáticamente
      await api.esperar(409, "POST", ruta, { tipo: "baja_inasistencia", fecha: "2020-01-01" }, t); // anterior al último

      const h = await historial(m._id);
      await api.esperar(409, "DELETE", `${ruta}/${h[1]._id}`, null, t); // no es el último
      await api.esperar(204, "DELETE", `${ruta}/${traslado._id}`, null, t);
      assert.equal(await estadoDe(m._id), "ACTIVO");
      const [registro] = await historial(m._id);
      await api.esperar(409, "DELETE", `${ruta}/${registro._id}`, null, t); // lo generó el sistema
    });

    it("solo administrador, pastor y secretario registran eventos", async () => {
      const m = await nuevoMiembro("Perm");
      await api.esperar(403, "POST", `/miembro/${m._id}/historial`, { tipo: "fallecimiento", fecha: new Date().toISOString() }, tk.lector);
      await api.esperar(200, "GET", `/miembro/${m._id}/historial`, null, tk.lector);
      await api.esperar(201, "POST", `/miembro/${m._id}/historial`, { tipo: "fallecimiento", fecha: new Date().toISOString() }, tk.secretario);
      assert.equal(await estadoDe(m._id), "FALLECIDO");
    });
  });

  describe("Actas de bautismo", () => {
    it("bautizar a una persona nueva la admite como miembro activo", async () => {
      const acta = await api.esperar(201, "POST", "/actas/bautismo", {
        persona: persona("Rosa", "Quispe"),
        fecha: "2024-05-12",
        lugar: "Templo central",
        oficiante: "Pastor Juan Rivas",
        testigos: ["Ana Ríos", "Luis Vega"],
      }, tk.secretario);
      assert.equal(acta.numero, 1);
      assert.equal(acta.persona.name, "Rosa");
      const m = await api.esperar(200, "GET", `/miembro/${acta.miembro}`, null, t);
      assert.equal(m.state.description, "ACTIVO");
      assert.ok(m.datebaptism.startsWith("2024-05-12"));
      const [ev] = await historial(acta.miembro);
      assert.equal(ev.tipo, "admision_bautismo");
      assert.equal(ev.estado_anterior, null);
      assert.equal(ev.observacion, "Bautismo N.º 1");

      await api.esperar(409, "POST", "/actas/bautismo", { persona: acta.persona._id, fecha: "2024-06-01", oficiante: "X" }, t);
    });

    it("el bautismo antiguo de un miembro ya registrado queda como histórico", async () => {
      const m = await nuevoMiembro("Antiguo");
      const acta = await api.esperar(201, "POST", "/actas/bautismo", { persona: m.person._id, fecha: "1998-03-01", oficiante: "Pastor emérito" }, t);
      assert.equal(acta.numero, 2);
      assert.equal(String(acta.miembro), String(m._id));
      const h = await historial(m._id);
      assert.deepEqual(h.map((e) => e.tipo), ["registro", "admision_bautismo"]); // ordenado por fecha desc
      assert.equal(await estadoDe(m._id), "ACTIVO");
    });

    it("anular conserva el número y limpia el bautismo del miembro", async () => {
      const acta = await api.esperar(201, "POST", "/actas/bautismo", { persona: persona("Error", "X"), fecha: "2024-07-01", oficiante: "P" }, t);
      assert.equal(acta.numero, 3);
      const anulada = await api.esperar(200, "POST", `/actas/bautismo/${acta._id}/anular`, { motivo: "Persona equivocada" }, t);
      assert.equal(anulada.anulada, true);
      const m = await api.esperar(200, "GET", `/miembro/${acta.miembro}`, null, t);
      assert.equal(m.datebaptism, undefined);
      const siguiente = await api.esperar(201, "POST", "/actas/bautismo", { persona: persona("Nueva", "Y"), fecha: "2024-07-02", oficiante: "P" }, t);
      assert.equal(siguiente.numero, 4);
      const lista = await api.esperar(200, "GET", "/actas/bautismo", null, tk.lector);
      assert.equal(lista.meta.total, 3);
      assert.equal((await api.esperar(200, "GET", "/actas/bautismo?incluir_anuladas=true", null, t)).meta.total, 4);
      await api.esperar(403, "POST", "/actas/bautismo", { persona: persona("A", "B"), fecha: "2024-07-02", oficiante: "P" }, tk.lector);
    });
  });

  describe("Actas de matrimonio", () => {
    it("enlaza a los contrayentes como familia", async () => {
      const acta = await api.esperar(201, "POST", "/actas/matrimonio", {
        contrayente1: persona("Carlos", "Mamani Flores"),
        contrayente2: persona("Lucía", "Condori Apaza"),
        fecha: "2024-08-10",
        oficiante: "Pastor Juan Rivas",
        testigos: ["T1", "T2"],
        registro_civil: { municipalidad: "Cayma", numero_partida: "2024-00123" },
      }, t);
      assert.equal(acta.numero, 1);
      assert.equal(acta.familia.nombre, "Familia Mamani Condori");
      const fam = await api.esperar(200, "GET", `/familia/${acta.familia._id}`, null, t);
      assert.deepEqual(fam.integrantes.map((i) => i.parentesco), ["cabeza", "conyuge"]);

      await api.esperar(409, "POST", "/actas/matrimonio", { contrayente1: acta.contrayente2._id, contrayente2: acta.contrayente1._id, fecha: "2024-08-10", oficiante: "P" }, t);
      await api.esperar(400, "POST", "/actas/matrimonio", { contrayente1: acta.contrayente1._id, contrayente2: acta.contrayente1._id, fecha: "2024-08-10", oficiante: "P" }, t);
    });

    it("si uno ya tiene familia, el otro se suma; si están en familias distintas, avisa", async () => {
      const p1 = await api.esperar(201, "POST", "/persona", persona("Pedro", "Soto"), t);
      const fam = await api.esperar(201, "POST", "/familia", { nombre: "Familia Soto", integrantes: [{ persona: p1._id, parentesco: "cabeza" }] }, t);
      const acta = await api.esperar(201, "POST", "/actas/matrimonio", { contrayente1: p1._id, contrayente2: persona("Marta", "Ramos"), fecha: "2024-09-01", oficiante: "P" }, t);
      assert.equal(String(acta.familia._id), String(fam._id));

      const a = await api.esperar(201, "POST", "/persona", persona("A", "Uno"), t);
      const b = await api.esperar(201, "POST", "/persona", persona("B", "Dos"), t);
      await api.esperar(201, "POST", "/familia", { nombre: "F1", integrantes: [{ persona: a._id, parentesco: "hijo" }] }, t);
      await api.esperar(201, "POST", "/familia", { nombre: "F2", integrantes: [{ persona: b._id, parentesco: "hijo" }] }, t);
      const r = await api.esperar(201, "POST", "/actas/matrimonio", { contrayente1: a._id, contrayente2: b._id, fecha: "2024-09-02", oficiante: "P" }, t);
      assert.equal(r.familia, null);
      assert.match(r.aviso_familia, /familias distintas/);
    });
  });

  describe("Actas de disciplina (confidencial)", () => {
    let m;
    before(async () => {
      m = await nuevoMiembro("Disc");
    });

    it("solo pastor y administrador la ven y registran", async () => {
      await api.esperar(403, "GET", "/actas/disciplina", null, tk.secretario);
      await api.esperar(403, "GET", "/actas/disciplina", null, tk.lector);
      await api.esperar(200, "GET", "/actas/disciplina", null, tk.pastor);
    });

    it("la suspensión cambia el estado y la restauración lo devuelve", async () => {
      const hoy = new Date().toISOString();
      const acta = await api.esperar(201, "POST", "/actas/disciplina", {
        miembro: m._id, fecha: hoy, acta_consistorio: "Acta 102", medida: "suspension_santa_cena", motivo: "Motivo reservado del caso",
      }, tk.pastor);
      assert.equal(acta.estado, "vigente");
      assert.equal(await estadoDe(m._id), "DISCIPLINADO");
      await api.esperar(409, "POST", "/actas/disciplina", { miembro: m._id, fecha: hoy, acta_consistorio: "Acta 103", medida: "exclusion", motivo: "Otra medida" }, tk.pastor);

      // El historial (visible para todos) no revela el motivo
      const [ev] = await api.esperar(200, "GET", `/miembro/${m._id}/historial`, null, tk.lector);
      assert.equal(ev.tipo, "disciplina_suspension");
      assert.ok(!JSON.stringify(ev).includes("reservado"));

      await api.esperar(400, "POST", `/actas/disciplina/${acta._id}/restaurar`, { fecha: "2020-01-01", acta_consistorio: "Acta 110" }, tk.pastor);
      const rest = await api.esperar(200, "POST", `/actas/disciplina/${acta._id}/restaurar`, { fecha: new Date().toISOString(), acta_consistorio: "Acta 110" }, tk.pastor);
      assert.equal(rest.estado, "levantada");
      assert.equal(await estadoDe(m._id), "ACTIVO");
      await api.esperar(409, "POST", `/actas/disciplina/${acta._id}/restaurar`, { fecha: new Date().toISOString(), acta_consistorio: "Acta 111" }, tk.pastor);
    });

    it("la amonestación no cambia el estado; anular una exclusión lo revierte", async () => {
      const amon = await api.esperar(201, "POST", "/actas/disciplina", { miembro: m._id, fecha: new Date().toISOString(), acta_consistorio: "Acta 120", medida: "amonestacion", motivo: "Amonestación privada" }, tk.pastor);
      assert.equal(amon.estado, "registrada");
      assert.equal(await estadoDe(m._id), "ACTIVO");

      const exc = await api.esperar(201, "POST", "/actas/disciplina", { miembro: m._id, fecha: new Date().toISOString(), acta_consistorio: "Acta 121", medida: "exclusion", motivo: "Exclusión reservada" }, tk.pastor);
      assert.equal(await estadoDe(m._id), "EXCLUIDO");
      await api.esperar(200, "POST", `/actas/disciplina/${exc._id}/anular`, { motivo: "Registrada por error" }, tk.pastor);
      assert.equal(await estadoDe(m._id), "ACTIVO");
    });

    it("la bitácora no guarda el motivo", async () => {
      const bit = await api.esperar(200, "GET", "/bitacora?recurso=Acta de disciplina&limite=100", null, t);
      assert.ok(bit.meta.total >= 4);
      const texto = JSON.stringify(bit.data);
      assert.ok(!texto.includes("reservad") && !texto.includes("Amonestación privada"));
      await api.esperar(409, "DELETE", `/miembro/${m._id}`, null, t); // tiene actas
    });
  });

  describe("Familias", () => {
    it("una persona en una sola familia y una sola cabeza", async () => {
      const p = await api.esperar(201, "POST", "/persona", persona("Única", "Fam"), t);
      const q = await api.esperar(201, "POST", "/persona", persona("Otra", "Fam"), t);
      const f = await api.esperar(201, "POST", "/familia", { nombre: "Familia Fam", integrantes: [{ persona: p._id, parentesco: "cabeza" }] }, t);
      const r = await api.req("POST", "/familia", { nombre: "Otra", integrantes: [{ persona: p._id, parentesco: "hijo" }] }, t);
      assert.equal(r.status, 409);
      assert.match(r.body.message, /ya pertenece a la familia "Familia Fam"/);
      await api.esperar(400, "POST", `/familia/${f._id}/integrantes`, { persona: q._id, parentesco: "cabeza" }, t);
      await api.esperar(201, "POST", `/familia/${f._id}/integrantes`, { persona: q._id, parentesco: "hijo" }, t);
      await api.esperar(200, "PUT", `/familia/${f._id}/integrantes/${q._id}`, { parentesco: "otro" }, t);
      await api.esperar(409, "DELETE", `/persona/${q._id}`, null, t); // está en una familia
      const sin = await api.esperar(200, "DELETE", `/familia/${f._id}/integrantes/${q._id}`, null, t);
      assert.equal(sin.integrantes.length, 1);
      const busq = await api.esperar(200, "GET", `/familia?persona=${p._id}`, null, tk.lector);
      assert.equal(busq.meta.total, 1);
    });
  });

  describe("Oficiales", () => {
    it("ancianos ordenados o a prueba, diáconos y consistorio", async () => {
      const a1 = await nuevoMiembro("Anciano1");
      const a2 = await nuevoMiembro("Anciano2");
      const d1 = await nuevoMiembro("Diacono1");
      const base = { fecha_inicio: "2024-01-01" };

      await api.esperar(400, "POST", "/oficial", { ...base, miembro: a1._id, oficio: "anciano" }, t); // falta condición
      await api.esperar(400, "POST", "/oficial", { ...base, miembro: d1._id, oficio: "diacono", condicion: "ordenado" }, t);
      const o1 = await api.esperar(201, "POST", "/oficial", { ...base, miembro: a1._id, oficio: "anciano", condicion: "ordenado", fecha_ordenacion: "2020-05-01", integra_consistorio: true }, tk.secretario);
      const o2 = await api.esperar(201, "POST", "/oficial", { ...base, miembro: a2._id, oficio: "anciano", condicion: "a_prueba", integra_consistorio: true }, t);
      await api.esperar(201, "POST", "/oficial", { ...base, miembro: d1._id, oficio: "diacono", integra_consistorio: false }, t);
      await api.esperar(409, "POST", "/oficial", { ...base, miembro: a1._id, oficio: "anciano", condicion: "ordenado" }, t);

      const c = await api.esperar(200, "GET", "/oficial/consistorio", null, tk.lector);
      assert.equal(c.consistorio.length, 2);
      assert.equal(c.ancianos.length, 2);
      assert.equal(c.diaconos.length, 1);
      assert.equal(c.consistorio[0].miembro.person.name.startsWith("Anciano"), true);

      await api.esperar(400, "PUT", `/oficial/${o2._id}`, { condicion: "ordenado" }, t); // falta fecha_ordenacion
      await api.esperar(200, "PUT", `/oficial/${o2._id}`, { condicion: "ordenado", fecha_ordenacion: "2025-01-15" }, t);
      await api.esperar(400, "PUT", `/oficial/${o1._id}`, { estado: "cesado" }, t); // falta fecha_fin
      await api.esperar(200, "PUT", `/oficial/${o1._id}`, { estado: "cesado", fecha_fin: "2025-12-31" }, t);
      assert.equal((await api.esperar(200, "GET", "/oficial/consistorio", null, t)).consistorio.length, 1);
      assert.equal((await api.esperar(200, "GET", "/oficial?estado=cesado", null, t)).length, 1);
    });

    it("solo un miembro activo puede ser oficial", async () => {
      const m = await nuevoMiembro("Trasladado");
      await api.esperar(201, "POST", `/miembro/${m._id}/historial`, { tipo: "traslado_enviado", fecha: new Date().toISOString(), iglesia: "Otra" }, t);
      const r = await api.req("POST", "/oficial", { miembro: m._id, oficio: "diacono", fecha_inicio: "2024-01-01" }, t);
      assert.equal(r.status, 409);
      assert.match(r.body.message, /TRASLADADO/);
    });
  });

  it("resumen anual de membresía", async () => {
    const anio = new Date().getFullYear();
    const r = await api.esperar(200, "GET", `/membresia/resumen?anio=${anio}`, null, tk.lector);
    assert.ok(r.eventos.traslado_enviado >= 1);
    assert.ok(r.miembros_por_estado.some((e) => e.estado === "ACTIVO"));
    const r2024 = await api.esperar(200, "GET", "/membresia/resumen?anio=2024", null, t);
    assert.ok(r2024.eventos.admision_bautismo >= 3);
    assert.equal(r2024.eventos.traslado_recibido, 1);
  });
});
