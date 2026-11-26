import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { iniciarServidor } from "./helpers/servidor.js";

const domingoHace = (semanas) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 7) % 7) - 7 * semanas);
  return `${d.toISOString().slice(0, 10)}T10:00:00-05:00`;
};
const hoy = () => new Date().toISOString();

describe("Pastoral", () => {
  let api, t, activo, tk, usuarios, miembros;
  const nuevoMiembro = (name) =>
    api.esperar(201, "POST", "/miembro", { state: activo._id, person: { name, surname: "Pastoral" } }, t);

  before(async () => {
    api = await iniciarServidor();
    t = api.tokenAdmin;
    activo = await api.esperar(201, "POST", "/catalogo/estado", { description: "ACTIVO" }, t);
    miembros = {
      anciano: await nuevoMiembro("Anciano"),
      diacono: await nuevoMiembro("Diacono"),
      evangelista: await nuevoMiembro("Evangelista"),
    };
    // Los oficios activos dan acceso aunque el rol sea "lector"
    const ofAnciano = await api.esperar(201, "POST", "/oficial", { miembro: miembros.anciano._id, oficio: "anciano", condicion: "ordenado", fecha_inicio: "2024-01-01" }, t);
    await api.esperar(201, "POST", "/oficial", { miembro: miembros.diacono._id, oficio: "diacono", fecha_inicio: "2024-01-01" }, t);
    await api.esperar(201, "POST", "/oficial", { miembro: miembros.evangelista._id, oficio: "evangelista", fecha_inicio: "2024-01-01" }, t);
    usuarios = { ofAnciano };
    tk = {};
    for (const r of ["pastor", "secretario", "tesorero", "lector"]) tk[r] = (await api.crearUsuario(r)).token;
    tk.lector2 = (await api.crearUsuario("lector")).token;
    tk.anciano = (await api.crearUsuario("lector", { miembro: miembros.anciano._id })).token;
    tk.diacono = (await api.crearUsuario("lector", { miembro: miembros.diacono._id })).token;
    tk.evangelista = (await api.crearUsuario("lector", { miembro: miembros.evangelista._id })).token;
  });
  after(() => api.cerrar());

  describe("Acceso por oficio", () => {
    it("ancianos ven visitas y casos; diáconos solo casos; lector y secretario ninguno", async () => {
      await api.esperar(200, "GET", "/pastoral/visitas", null, tk.anciano);
      await api.esperar(200, "GET", "/pastoral/casos", null, tk.anciano);
      await api.esperar(200, "GET", "/pastoral/casos", null, tk.diacono);
      await api.esperar(403, "GET", "/pastoral/visitas", null, tk.diacono);
      for (const r of ["lector", "secretario", "tesorero"]) {
        await api.esperar(403, "GET", "/pastoral/visitas", null, tk[r]);
        await api.esperar(403, "GET", "/pastoral/casos", null, tk[r]);
      }
      await api.esperar(200, "GET", "/pastoral/seguimiento", null, tk.evangelista);
      await api.esperar(200, "GET", "/pastoral/seguimiento", null, tk.secretario);
      await api.esperar(403, "GET", "/pastoral/seguimiento", null, tk.lector);
    });

    it("el perfil refleja los oficios y los permisos que dan", async () => {
      const p = await api.esperar(200, "GET", "/login/perfil", null, tk.anciano);
      assert.deepEqual(p.oficios, ["anciano"]);
      assert.equal(p.rol, "lector");
      assert.equal(p.permisos.visitas.escribir, true);
      assert.equal(p.permisos.finanzas.leer, false);
    });

    it("al terminar su periodo, el anciano pierde el acceso al instante", async () => {
      const m = await nuevoMiembro("Temporal");
      const of = await api.esperar(201, "POST", "/oficial", { miembro: m._id, oficio: "anciano", condicion: "a_prueba", fecha_inicio: "2024-01-01" }, t);
      const { token } = await api.crearUsuario("lector", { miembro: m._id });
      await api.esperar(200, "GET", "/pastoral/visitas", null, token);
      await api.esperar(200, "PUT", `/oficial/${of._id}`, { estado: "cesado", fecha_fin: hoy() }, t);
      await api.esperar(403, "GET", "/pastoral/visitas", null, token);
    });
  });

  describe("Visitas pastorales", () => {
    let persona;
    before(async () => {
      persona = await api.esperar(201, "POST", "/persona", { name: "Hermana", surname: "Visitada", phone: "999111222" }, t);
    });

    it("se registran y las 'solo pastor' quedan ocultas para los ancianos", async () => {
      await api.esperar(400, "POST", "/pastoral/visitas", { fecha: hoy(), motivo: "rutina" }, tk.anciano); // falta a quién
      const v = await api.esperar(201, "POST", "/pastoral/visitas", {
        fecha: hoy(), persona: persona._id, visitantes: [miembros.anciano._id], motivo: "enfermedad", lugar: "hospital",
        notas: "Operación de rodilla", proxima_visita: new Date(Date.now() + 3 * 864e5).toISOString(),
      }, tk.anciano);
      assert.equal(v.visitantes[0].person.name, "Anciano");
      await api.esperar(403, "POST", "/pastoral/visitas", { fecha: hoy(), persona: persona._id, motivo: "consejeria", solo_pastor: true }, tk.anciano);

      const reservada = await api.esperar(201, "POST", "/pastoral/visitas", { fecha: hoy(), persona: persona._id, motivo: "consejeria", notas: "Muy delicado", solo_pastor: true }, tk.pastor);
      assert.equal((await api.esperar(200, "GET", "/pastoral/visitas", null, tk.anciano)).meta.total, 1);
      assert.equal((await api.esperar(200, "GET", "/pastoral/visitas", null, tk.pastor)).meta.total, 2);
      await api.esperar(404, "GET", `/pastoral/visitas/${reservada._id}`, null, tk.anciano);
      await api.esperar(404, "PUT", `/pastoral/visitas/${reservada._id}`, { notas: "x" }, tk.anciano);

      const agenda = await api.esperar(200, "GET", "/pastoral/visitas?proximas=true", null, tk.anciano);
      assert.equal(agenda.meta.total, 1);
    });
  });

  describe("Necesitados y enfermos", () => {
    let caso, egreso;
    before(async () => {
      const fondo = await api.esperar(201, "POST", "/finanzas/fondos", { nombre: "Diaconía", tipo: "fondo", saldo_inicial: 500, fecha_inicio: "2024-01-01" }, tk.tesorero);
      const cat = await api.esperar(201, "POST", "/finanzas/categorias", { description: "Ayuda social", tipo: "egreso" }, tk.tesorero);
      egreso = await api.esperar(201, "POST", "/finanzas/movimientos", { tipo: "egreso", monto: 120, fondo: fondo._id, categoria: cat._id, fecha: hoy() }, tk.tesorero);
      const ingreso = await api.esperar(201, "POST", "/finanzas/movimientos", { tipo: "ingreso", clase: "ofrenda", monto: 10, fondo: fondo._id, fecha: hoy() }, tk.tesorero);
      egreso.ingreso = ingreso;
    });

    it("el diácono registra el caso y las ayudas (con egreso de finanzas)", async () => {
      caso = await api.esperar(201, "POST", "/pastoral/casos", {
        persona: { name: "Don", surname: "Necesitado" }, tipo: "economica", descripcion: "Perdió su trabajo", prioridad: "alta",
        fecha_inicio: hoy(), responsable: miembros.diacono._id,
      }, tk.diacono);
      assert.equal(caso.estado, "abierto");
      assert.equal(caso.responsable.person.name, "Diacono");

      const c1 = await api.esperar(201, "POST", `/pastoral/casos/${caso._id}/ayudas`, { fecha: hoy(), tipo: "viveres", descripcion: "Canasta" }, tk.diacono);
      assert.equal(c1.estado, "en_seguimiento");
      const c2 = await api.esperar(201, "POST", `/pastoral/casos/${caso._id}/ayudas`, { fecha: hoy(), tipo: "economica", movimiento_financiero: egreso._id }, tk.diacono);
      assert.equal(c2.ayudas[1].monto, 120);
      await api.esperar(409, "POST", `/pastoral/casos/${caso._id}/ayudas`, { fecha: hoy(), tipo: "economica", movimiento_financiero: egreso._id }, tk.diacono);
      await api.esperar(400, "POST", `/pastoral/casos/${caso._id}/ayudas`, { fecha: hoy(), tipo: "economica", movimiento_financiero: egreso.ingreso._id }, tk.diacono);
    });

    it("cerrar exige motivo; un caso cerrado no recibe ayudas hasta reabrirlo", async () => {
      await api.esperar(400, "PUT", `/pastoral/casos/${caso._id}`, { estado: "cerrado" }, tk.diacono);
      const cerrado = await api.esperar(200, "PUT", `/pastoral/casos/${caso._id}`, { estado: "cerrado", motivo_cierre: "Consiguió trabajo" }, tk.diacono);
      assert.ok(cerrado.fecha_cierre);
      await api.esperar(409, "POST", `/pastoral/casos/${caso._id}/ayudas`, { fecha: hoy(), tipo: "oracion" }, tk.diacono);
      const reabierto = await api.esperar(200, "PUT", `/pastoral/casos/${caso._id}`, { estado: "abierto" }, tk.diacono);
      assert.equal(reabierto.fecha_cierre, null);
      assert.equal((await api.esperar(200, "GET", "/pastoral/casos?abiertos=true&prioridad=alta", null, tk.anciano)).meta.total, 1);
      await api.esperar(409, "DELETE", `/persona/${caso.persona._id}`, null, t);
    });
  });

  describe("Peticiones de oración", () => {
    it("todos ven las públicas; las confidenciales solo el equipo pastoral y su autor", async () => {
      await api.esperar(201, "POST", "/pastoral/oracion", { peticion: "Por la salud de mi madre" }, tk.lector);
      const conf = await api.esperar(201, "POST", "/pastoral/oracion", { peticion: "Problema familiar", confidencial: true }, tk.lector);
      assert.equal((await api.esperar(200, "GET", "/pastoral/oracion", null, tk.lector2)).meta.total, 1);
      assert.equal((await api.esperar(200, "GET", "/pastoral/oracion", null, tk.lector)).meta.total, 2);
      assert.equal((await api.esperar(200, "GET", "/pastoral/oracion", null, tk.anciano)).meta.total, 2);
      assert.equal((await api.esperar(200, "GET", "/pastoral/oracion", null, tk.pastor)).meta.total, 2);
      await api.esperar(404, "GET", `/pastoral/oracion/${conf._id}`, null, tk.lector2);

      const publica = (await api.esperar(200, "GET", "/pastoral/oracion", null, tk.lector2)).data[0];
      await api.esperar(403, "PUT", `/pastoral/oracion/${publica._id}`, { estado: "cerrada" }, tk.lector2);
      const resp = await api.esperar(200, "PUT", `/pastoral/oracion/${publica._id}`, { estado: "respondida", testimonio: "Salió bien de la operación" }, tk.lector);
      assert.ok(resp.fecha_respuesta);
      await api.esperar(200, "PUT", `/pastoral/oracion/${conf._id}`, { estado: "cerrada" }, tk.anciano);
    });
  });

  describe("Seguimiento de nuevos", () => {
    let seg;
    it("registra el proceso por etapas con sesiones de discipulado", async () => {
      seg = await api.esperar(201, "POST", "/pastoral/seguimiento", {
        persona: { name: "Nuevo", surname: "Creyente", phone: "988777666" }, origen: "invitacion",
        invitado_por: miembros.anciano._id, discipulador: miembros.evangelista._id, fecha_inicio: "2025-01-05",
      }, tk.evangelista);
      assert.equal(seg.etapa, "contacto");
      assert.equal(seg.avances.length, 1);
      await api.esperar(409, "POST", "/pastoral/seguimiento", { persona: seg.persona._id, fecha_inicio: "2025-01-06" }, tk.evangelista);
      await api.esperar(409, "POST", "/pastoral/seguimiento", { persona: miembros.anciano.person._id, fecha_inicio: "2025-01-06" }, tk.evangelista);

      const ruta = `/pastoral/seguimiento/${seg._id}/avances`;
      await api.esperar(400, "POST", ruta, { tipo: "sesion", fecha: "2025-01-12" }, tk.evangelista); // falta tema
      await api.esperar(201, "POST", ruta, { tipo: "cambio_etapa", etapa: "en_discipulado", fecha: "2025-01-12" }, tk.evangelista);
      const s = await api.esperar(201, "POST", ruta, { tipo: "sesion", fecha: "2025-01-19", tema: "La gracia de Dios" }, tk.evangelista);
      assert.equal(s.etapa, "en_discipulado");
      assert.equal(s.avances.length, 3);
      await api.esperar(400, "POST", ruta, { tipo: "cambio_etapa", etapa: "en_discipulado", fecha: "2025-01-20" }, tk.evangelista);
      assert.equal((await api.esperar(200, "GET", "/pastoral/seguimiento?activos=true", null, tk.secretario)).meta.total, 1);
    });

    it("al bautizarse pasa solo a 'integrado'", async () => {
      await api.esperar(201, "POST", "/actas/bautismo", { persona: seg.persona._id, fecha: "2025-06-01", oficiante: "Pastor" }, t);
      const s = await api.esperar(200, "GET", `/pastoral/seguimiento/${seg._id}`, null, tk.evangelista);
      assert.equal(s.etapa, "integrado");
      assert.match(s.avances.at(-1).observacion, /Bautizado \(acta N.º 1\)/);
      assert.equal((await api.esperar(200, "GET", "/pastoral/seguimiento?activos=true", null, tk.secretario)).meta.total, 0);
    });
  });

  describe("Alertas de inasistencia y tablero", () => {
    let fiel, ausente, nunca;
    before(async () => {
      fiel = await nuevoMiembro("Fiel");
      ausente = await nuevoMiembro("Ausente");
      nunca = await nuevoMiembro("Nunca");
    });

    it("sin suficientes domingos registrados no genera alertas", async () => {
      const r = await api.esperar(200, "GET", "/pastoral/alertas", null, tk.anciano);
      assert.match(r.advertencia, /Solo hay 0 domingo/);
    });

    it("detecta a quienes faltaron los últimos 4 domingos", async () => {
      const dep = await api.esperar(201, "POST", "/departamento", { description: "CONSISTORIO" }, t);
      const culto = await api.esperar(201, "POST", "/servicio", { description: "Culto dominical", day: "domingo", departament: dep._id }, t);
      const sesiones = [];
      for (const s of [1, 2, 3, 4, 5, 6]) sesiones.push(await api.esperar(201, "POST", "/sesion-servicio", { service: culto._id, date: domingoHace(s) }, t));
      await api.esperar(201, "POST", "/asistencia", { sesion: sesiones[1]._id, person: fiel.person._id }, t); // hace 2 domingos
      await api.esperar(201, "POST", "/asistencia", { sesion: sesiones[5]._id, person: ausente.person._id }, t); // hace 6 domingos
      await api.esperar(201, "POST", "/pastoral/casos", { persona: nunca.person._id, tipo: "enfermedad", descripcion: "Hospitalizado", fecha_inicio: hoy() }, tk.diacono);

      const r = await api.esperar(200, "GET", "/pastoral/alertas", null, tk.anciano);
      const de = (m) => r.alertas.find((a) => String(a.miembro) === String(m._id));
      assert.equal(de(fiel), undefined);
      assert.equal(de(ausente).domingos_sin_asistir, 5);
      assert.ok(de(ausente).ultima_asistencia);
      assert.equal(de(nunca).domingos_sin_asistir, 6);
      assert.equal(de(nunca).caso_abierto, "enfermedad");
      assert.equal(r.alertas[0].domingos_sin_asistir, 6); // ordenado: los más ausentes primero

      const r8 = await api.esperar(200, "GET", "/pastoral/alertas?domingos=8", null, tk.anciano);
      assert.match(r8.advertencia, /Solo hay 6/);
      await api.esperar(403, "GET", "/pastoral/alertas", null, tk.diacono);
    });

    it("tablero pastoral", async () => {
      const r = await api.esperar(200, "GET", "/pastoral/resumen", null, tk.pastor);
      assert.equal(r.visitas_del_mes, 2);
      assert.equal(r.proximas_visitas.length, 1);
      assert.ok(r.casos_abiertos.alta >= 1);
      assert.equal(r.nuevos_por_etapa.integrado, 1);
      assert.ok(r.alertas_inasistencia >= 2);
      const anc = await api.esperar(200, "GET", "/pastoral/resumen", null, tk.anciano);
      assert.equal(anc.visitas_del_mes, 1); // no cuenta la "solo pastor"
    });
  });
});
