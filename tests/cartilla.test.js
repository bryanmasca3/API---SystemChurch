import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { iniciarServidor } from "./helpers/servidor.js";

/** Domingo de hace `semanas` semanas, a las 10:00 de Lima. */
const domingoHace = (semanas) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 7) % 7) - 7 * semanas);
  return `${d.toISOString().slice(0, 10)}T10:00:00-05:00`;
};
const hace = (anios) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - anios);
  return d.toISOString().slice(0, 10);
};

describe("Cartilla administrativa", () => {
  let api, t, activo, depNinos;
  const persona = (name, surname, extra = {}) => ({ name, surname, ...extra });
  const miembro = (name, dob) =>
    api.esperar(201, "POST", "/miembro", { state: activo._id, person: persona(name, "Cartilla", dob ? { dob } : {}) }, t);

  before(async () => {
    api = await iniciarServidor();
    t = api.tokenAdmin;
    activo = await api.esperar(201, "POST", "/catalogo/estado", { description: "ACTIVO" }, t);
    depNinos = await api.esperar(201, "POST", "/departamento", { description: "MINISTERIO DE NIÑOS" }, t);
  });
  after(() => api.cerrar());

  describe("Acta de dedicación de niños", () => {
    it("registra al niño y lo suma como hijo a una familia nueva con sus padres", async () => {
      const acta = await api.esperar(201, "POST", "/actas/dedicacion", {
        nino: persona("Mateo", "Quispe Rojas", { dob: "2025-01-15" }),
        padres: [persona("Jorge", "Quispe"), persona("Elena", "Rojas")],
        fecha: "2025-06-01",
        oficiante: "Pastor Juan Rivas",
      }, t);
      assert.equal(acta.numero, 1);
      assert.equal(acta.nino.name, "Mateo");
      assert.equal(acta.padres.length, 2);
      const fam = await api.esperar(200, "GET", `/familia/${acta.familia._id}`, null, t);
      assert.equal(fam.nombre, "Familia Quispe");
      assert.deepEqual(fam.integrantes.map((i) => i.parentesco), ["cabeza", "conyuge", "hijo"]);

      await api.esperar(409, "POST", "/actas/dedicacion", { nino: acta.nino._id, padres: [acta.padres[0]._id], fecha: "2025-06-02", oficiante: "P" }, t);
      await api.esperar(400, "POST", "/actas/dedicacion", { nino: acta.nino._id, padres: [acta.nino._id], fecha: "2025-06-02", oficiante: "P" }, t);

      // Segundo hijo: se suma a la familia existente
      const hermano = await api.esperar(201, "POST", "/actas/dedicacion", { nino: persona("Lucas", "Quispe"), padres: [acta.padres[0]._id, acta.padres[1]._id], fecha: "2025-07-01", oficiante: "P" }, t);
      assert.equal(hermano.numero, 2);
      assert.equal(String(hermano.familia._id), String(acta.familia._id));
    });
  });

  describe("Miembros hábiles y asambleas", () => {
    let m, asamblea;

    before(async () => {
      const adulto = hace(30);
      m = {
        habil: await miembro("Hábil", adulto),
        poca: await miembro("PocaAsistencia", adulto),
        sinCena: await miembro("SinCena", adulto),
        menor: await miembro("Menor", hace(15)),
        sinEdad: await miembro("SinEdad"),
        disciplinado: await miembro("Disciplinado", adulto),
        inactivo: await miembro("Inactivo", adulto),
      };
      await api.esperar(201, "POST", "/actas/disciplina", { miembro: m.disciplinado._id, fecha: new Date().toISOString(), acta_consistorio: "Acta 1", medida: "suspension_santa_cena", motivo: "Reservado" }, t);
      await api.esperar(201, "POST", `/miembro/${m.inactivo._id}/historial`, { tipo: "baja_inasistencia", fecha: new Date().toISOString() }, t);

      // 4 cultos dominicales en los últimos 6 meses; Santa Cena en 2 de ellos
      const dep = await api.esperar(201, "POST", "/departamento", { description: "CONSISTORIO" }, t);
      const culto = await api.esperar(201, "POST", "/servicio", { description: "Culto dominical", day: "domingo", departament: dep._id }, t);
      const sesiones = [];
      for (const s of [2, 4, 6, 8]) sesiones.push(await api.esperar(201, "POST", "/sesion-servicio", { service: culto._id, date: domingoHace(s) }, t));
      const asistir = async (mb, n) => {
        for (const s of sesiones.slice(0, n)) await api.esperar(201, "POST", "/asistencia", { sesion: s._id, person: mb.person._id }, t);
      };
      const cena = async (mb, n) => {
        for (const s of sesiones.slice(0, n)) await api.esperar(201, "POST", "/asistencia-santa-cena", { sesion: s._id, miembro: mb._id }, t);
      };
      await asistir(m.habil, 3); await cena(m.habil, 2);
      await asistir(m.poca, 1); await cena(m.poca, 2);
      await asistir(m.sinCena, 4); // nunca participó de la Santa Cena
      for (const x of [m.menor, m.sinEdad, m.disciplinado, m.inactivo]) { await asistir(x, 4); await cena(x, 2); }
    });

    it("evalúa cada requisito y explica por qué alguien no es hábil", async () => {
      const r = await api.esperar(200, "GET", "/asamblea/habiles", null, t);
      assert.equal(r.domingos_con_culto, 4);
      assert.equal(r.celebraciones_santa_cena, 2);
      assert.deepEqual(r.advertencias, []);
      const de = (mb) => r.miembros.find((x) => String(x.miembro) === String(mb._id));

      assert.equal(de(m.habil).habil, true);
      assert.equal(de(m.habil).asistencia_dominical.pct, 75);
      assert.match(de(m.poca).motivos[0], /Asistencia dominical 25% \(1 de 4/);
      assert.match(de(m.sinCena).motivos[0], /Santa Cena 0%/);
      assert.match(de(m.menor).motivos[0], /Menor de edad \(15 años\)/);
      assert.match(de(m.sinEdad).motivos[0], /por verificar/);
      assert.ok(de(m.disciplinado).motivos.some((x) => /Disciplina vigente/.test(x)));
      assert.ok(de(m.disciplinado).motivos.some((x) => /DISCIPLINADO/.test(x)));
      assert.match(de(m.inactivo).motivos[0], /INACTIVO/);
      assert.equal(r.total_habiles, 1);

      // Con criterios más flexibles el de poca asistencia pasa
      const flexible = await api.esperar(200, "GET", "/asamblea/habiles?asistencia_dominical_pct=25", null, t);
      assert.equal(flexible.total_habiles, 2);
      // Sin cultos registrados en el periodo, esos requisitos no se evalúan
      const sinDatos = await api.esperar(200, "GET", "/asamblea/habiles?fecha=2001-01-01", null, t);
      assert.equal(sinDatos.advertencias.length, 2);
    });

    it("asamblea: asistencia, quórum y padrón congelado", async () => {
      asamblea = await api.esperar(201, "POST", "/asamblea", { fecha: new Date().toISOString(), tipo: "ordinaria", agenda: "Elección de oficiales" }, t);
      assert.equal(asamblea.numero, 1);
      assert.deepEqual(asamblea.criterios, { meses: 6, edad_minima: 18, asistencia_dominical_pct: 50, santa_cena_pct: 50 });
      assert.equal(asamblea.quorum.total_habiles, 1);
      assert.equal(asamblea.quorum.hay_quorum, false);

      const conj = await api.esperar(200, "POST", `/asamblea/${asamblea._id}/habiles/congelar`, null, t);
      assert.equal(conj.congelado, true);
      assert.equal(conj.total_habiles, 1);
      await api.esperar(409, "POST", `/asamblea/${asamblea._id}/habiles/congelar`, null, t);
      await api.esperar(409, "PUT", `/asamblea/${asamblea._id}`, { criterios: { meses: 3 } }, t);

      const a1 = await api.esperar(201, "POST", `/asamblea/${asamblea._id}/asistentes`, { miembro: m.habil._id }, t);
      assert.equal(a1.asistentes[0].habil, true);
      assert.equal(a1.quorum.minimo, 1);
      assert.equal(a1.quorum.hay_quorum, true);
      const a2 = await api.esperar(201, "POST", `/asamblea/${asamblea._id}/asistentes`, { miembro: m.poca._id }, t);
      assert.equal(a2.asistentes[1].habil, false);
      assert.equal(a2.quorum.asistentes_habiles, 1);
      await api.esperar(409, "POST", `/asamblea/${asamblea._id}/asistentes`, { miembro: m.poca._id }, t);
      await api.esperar(409, "DELETE", `/asamblea/${asamblea._id}`, null, t); // tiene asistentes
      const sin = await api.esperar(200, "DELETE", `/asamblea/${asamblea._id}/asistentes/${m.poca._id}`, null, t);
      assert.equal(sin.asistentes.length, 1);
    });
  });

  describe("Padrón y crecimiento", () => {
    it("padrón numerado por apellido con forma de ingreso", async () => {
      await api.esperar(201, "POST", "/miembro", {
        person: persona("Ana", "Aguilar", { doi: "40123456" }),
        ingreso: { tipo: "traslado_recibido", fecha: "2024-01-10", iglesia: "IEP Cayma" },
      }, t);
      const p = await api.esperar(200, "GET", "/membresia/padron", null, t);
      assert.equal(p.miembros[0].numero, 1);
      assert.equal(p.miembros[0].apellidos, "Aguilar");
      assert.equal(p.miembros[0].forma_ingreso, "Carta de traslado");
      assert.equal(p.miembros[0].iglesia_procedencia, "IEP Cayma");
      assert.equal(p.total, p.miembros.length);
      assert.ok(p.por_estado.ACTIVO >= 1);
      const soloActivos = await api.esperar(200, "GET", `/membresia/padron?estado=${activo._id}`, null, t);
      assert.ok(soloActivos.miembros.every((x) => x.estado === "ACTIVO"));
    });

    it("crecimiento mes a mes con altas, bajas y asistencia", async () => {
      const c = await api.esperar(200, "GET", "/membresia/crecimiento", null, t);
      assert.equal(c.meses.length, 12);
      const ultimo = c.meses[11];
      const padron = await api.esperar(200, "GET", `/membresia/padron?estado=${activo._id}`, null, t);
      assert.equal(ultimo.miembros_activos, padron.total);
      assert.ok(c.variacion.bajas >= 1); // la baja por inasistencia
      assert.ok(c.meses.some((x) => x.asistencia_promedio_dominical > 0));
      const r = await api.esperar(200, "GET", "/membresia/crecimiento?desde=2024-01&hasta=2024-03", null, t);
      assert.deepEqual(r.meses.map((x) => x.periodo), ["2024-01", "2024-02", "2024-03"]);
      assert.equal(r.meses[0].altas, 1); // el traslado recibido de enero 2024
      await api.esperar(400, "GET", "/membresia/crecimiento?desde=2024-05&hasta=2024-01", null, t);
    });
  });

  describe("Inscritos por ministerio", () => {
    it("inscribe niños no miembros con su apoderado", async () => {
      const apoderado = await api.esperar(201, "POST", "/persona", persona("Rosa", "Mamani"), t);
      const ruta = `/departamento/${depNinos._id}/inscritos`;
      const ins = await api.esperar(201, "POST", ruta, { persona: persona("Sofía", "Mamani", { dob: hace(8) }), apoderado: apoderado._id, fecha_inscripcion: "2025-03-01" }, t);
      const lista = await api.esperar(200, "GET", ruta, null, t);
      assert.equal(lista.length, 1);
      assert.equal(lista[0].edad, 8);
      assert.equal(lista[0].apoderado.name, "Rosa");
      await api.esperar(409, "POST", ruta, { persona: ins.persona._id ?? ins.persona, fecha_inscripcion: "2025-03-02" }, t);

      const retirado = await api.esperar(200, "PUT", `${ruta}/${ins._id}`, { activo: false }, t);
      assert.ok(retirado.fecha_retiro);
      assert.equal((await api.esperar(200, "GET", ruta, null, t)).length, 0);
      assert.equal((await api.esperar(200, "GET", `${ruta}?activo=todos`, null, t)).length, 1);
      await api.esperar(409, "DELETE", `/departamento/${depNinos._id}`, null, t);
    });
  });

  describe("Dones, capacidades y profesiones", () => {
    it("registra, filtra y resume", async () => {
      const ensenanza = await api.esperar(201, "POST", "/catalogo/don", { description: "ENSEÑANZA" }, t);
      const musica = await api.esperar(201, "POST", "/catalogo/don", { description: "MÚSICA" }, t);
      await api.esperar(201, "POST", "/persona", persona("Carla", "Dones", { dones: [ensenanza._id, musica._id], capacidades: ["guitarra", "cocina"], profesion: "Profesora", grado_instruccion: "universitario", idiomas: ["quechua"] }), t);
      await api.esperar(201, "POST", "/persona", persona("Raúl", "Dones", { dones: [musica._id], capacidades: ["Guitarra"], profesion: "Ingeniero" }), t);
      await api.esperar(400, "POST", "/persona", persona("X", "Y", { dones: ["507f1f77bcf86cd799439011"] }), t);
      await api.esperar(400, "POST", "/persona", persona("X", "Y", { grado_instruccion: "doctorado-honoris" }), t);

      assert.equal((await api.esperar(200, "GET", `/persona?don=${musica._id}`, null, t)).meta.total, 2);
      assert.equal((await api.esperar(200, "GET", "/persona?capacidad=guitarra", null, t)).meta.total, 2);
      assert.equal((await api.esperar(200, "GET", "/persona?profesion=profe", null, t)).meta.total, 1);

      const r = await api.esperar(200, "GET", "/persona/dones", null, t);
      const mus = r.dones.find((d) => d.don === "MÚSICA");
      assert.equal(mus.cantidad, 2);
      assert.ok(r.profesiones.some((p) => p.profesion === "Profesora"));
      await api.esperar(409, "DELETE", `/catalogo/don/${musica._id}`, null, t);
    });
  });

  describe("Misioneros, predicadores, evangelistas y maestros", () => {
    it("se registran como servicio y no integran el consistorio", async () => {
      const mb = await miembro("Misionero", hace(40));
      await api.esperar(400, "POST", "/oficial", { miembro: mb._id, oficio: "misionero", fecha_inicio: "2024-01-01", integra_consistorio: true }, t);
      await api.esperar(201, "POST", "/oficial", { miembro: mb._id, oficio: "misionero", fecha_inicio: "2024-01-01" }, t);
      await api.esperar(201, "POST", "/oficial", { miembro: mb._id, oficio: "predicador", fecha_inicio: "2024-01-01" }, t);
      const c = await api.esperar(200, "GET", "/oficial/consistorio", null, t);
      assert.deepEqual(c.servicio.map((o) => o.oficio), ["misionero", "predicador"]);
      assert.equal(c.consistorio.length, 0);
    });
  });

  describe("Inventario anual", () => {
    it("unidades al inicio y al cierre de cada año", async () => {
      const cat = await api.esperar(201, "POST", "/catalogo/categoria-inventario", { description: "Mobiliario" }, t);
      const bien = await api.esperar(201, "POST", "/inventario", { nombre: "Sillas", categoria: cat._id, cantidad: 10, fecha_adquisicion: "2024-03-01", valor: 20 }, t);
      await api.esperar(201, "POST", `/inventario/${bien._id}/movimientos`, { tipo: "baja", cantidad: 2, fecha: "2024-06-01" }, t);
      await api.esperar(201, "POST", `/inventario/${bien._id}/movimientos`, { tipo: "entrada", cantidad: 5, fecha: "2025-02-01" }, t);

      const r24 = await api.esperar(200, "GET", "/inventario/reporte-anual?anio=2024", null, t);
      const s24 = r24.detalle.find((d) => d.nombre === "Sillas");
      assert.deepEqual([s24.cantidad_inicio, s24.entradas, s24.bajas, s24.cantidad_cierre], [0, 10, 2, 8]);
      const r25 = await api.esperar(200, "GET", "/inventario/reporte-anual?anio=2025", null, t);
      const s25 = r25.detalle.find((d) => d.nombre === "Sillas");
      assert.deepEqual([s25.cantidad_inicio, s25.entradas, s25.cantidad_cierre], [8, 5, 13]);
      assert.equal(r25.totales.valor_cierre, 260);
      assert.equal((await api.esperar(200, "GET", "/inventario/reporte-anual?anio=2023", null, t)).bienes, 0);
    });
  });
});
