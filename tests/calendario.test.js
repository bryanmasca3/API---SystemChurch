import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { iniciarServidor } from "./helpers/servidor.js";

// Diciembre de 2026: domingos 6, 13, 20, 27 y sábados 5, 12, 19, 26
const DICIEMBRE = { desde: "2026-12-01", hasta: "2026-12-31" };

describe("Calendario y programa de cultos", () => {
  let api, t, liturgia, jovenes, culto, reunionJovenes, director, lectora, tk, sesionCulto, sesionJovenes;

  before(async () => {
    api = await iniciarServidor();
    t = api.tokenAdmin;
    const estado = await api.esperar(201, "POST", "/catalogo/estado", { description: "ACTIVO" }, t);
    const nuevo = (name) => api.esperar(201, "POST", "/miembro", { state: estado._id, person: { name, surname: "Calendario" } }, t);
    director = await nuevo("Director");
    lectora = await nuevo("Lectora");
    liturgia = await api.esperar(201, "POST", "/departamento", { description: "MINISTERIO DE LITURGIA" }, t);
    jovenes = await api.esperar(201, "POST", "/departamento", { description: "SOCIEDAD DE ESFUERZOS CRISTIANOS" }, t);
    culto = await api.esperar(201, "POST", "/servicio", { description: "CULTO DOMINICAL", day: "domingo", begintime: "10:00", endtime: "12:00", departament: liturgia._id }, t);
    reunionJovenes = await api.esperar(201, "POST", "/servicio", { description: "REUNIÓN DE JÓVENES", day: "sábado", begintime: "19:00", departament: jovenes._id }, t);
    await api.esperar(201, "POST", "/servicio", { description: "SIN HORARIO", day: "sábado", departament: jovenes._id }, t);

    // El líder de jóvenes es integrante de ese departamento
    const cargo = await api.esperar(201, "POST", "/catalogo/rol-miembro", { description: "PRESIDENTE(A)" }, t);
    await api.esperar(201, "POST", `/departamento/${jovenes._id}/integrantes`, { member: lectora._id, role: cargo._id }, t);
    tk = {
      lider: (await api.crearUsuario("lider", { miembro: lectora._id })).token,
      lector: (await api.crearUsuario("lector")).token,
      director: (await api.crearUsuario("lector", { miembro: director._id })).token,
      sinMiembro: (await api.crearUsuario("secretario")).token,
    };
  });
  after(() => api.cerrar());

  it("genera los cultos del mes según el día y la hora de cada servicio, sin duplicar", async () => {
    const r = await api.esperar(201, "POST", "/sesion-servicio/generar", DICIEMBRE, t);
    assert.equal(r.creadas, 8);
    assert.deepEqual(r.servicios_sin_horario, ["SIN HORARIO"]);
    const otra = await api.esperar(201, "POST", "/sesion-servicio/generar", DICIEMBRE, t);
    assert.equal(otra.creadas, 0);
    assert.equal(otra.ya_existian, 8);

    const cultos = await api.esperar(200, "GET", `/sesion-servicio?servicio=${culto._id}&limite=10`, null, t);
    assert.equal(cultos.meta.total, 4);
    const fechas = cultos.data.map((s) => s.date).sort();
    assert.equal(fechas[0], "2026-12-06T15:00:00.000Z"); // domingo 6, 10:00 en Lima
    sesionCulto = cultos.data.find((s) => s.date === "2026-12-06T15:00:00.000Z");
    const sab = await api.esperar(200, "GET", `/sesion-servicio?servicio=${reunionJovenes._id}&limite=10`, null, t);
    sesionJovenes = sab.data.find((s) => s.date.startsWith("2026-12-06T00:00")); // sábado 5, 19:00 en Lima
    assert.ok(sesionJovenes);
    await api.esperar(400, "POST", "/sesion-servicio/generar", { desde: "2026-01-01", hasta: "2026-12-31" }, t); // más de 3 meses
  });

  it("asigna director, predicador (miembro o invitado) y lectura bíblica", async () => {
    const ruta = `/sesion-servicio/${sesionCulto._id}/programa`;
    await api.esperar(400, "PUT", ruta, { director: { miembro: director._id, invitado: "X" } }, t); // ambos
    await api.esperar(400, "PUT", ruta, { director: {} }, t); // ninguno
    await api.esperar(400, "PUT", ruta, { director: { miembro: "507f1f77bcf86cd799439011" } }, t);

    let s = await api.esperar(200, "PUT", ruta, { director: { miembro: director._id } }, t);
    assert.deepEqual(s.funciones_pendientes, ["predicador", "lectura_biblica"]);
    s = await api.esperar(200, "PUT", ruta, {
      predicador: { invitado: "Pastor Luis Vega", iglesia: "IEP Tacna", tema: "La gracia", texto_biblico: "Efesios 2:8-10" },
      lectura_biblica: { miembro: lectora._id, pasaje: "Salmo 23" },
    }, t);
    assert.deepEqual(s.funciones_pendientes, []);
    assert.equal(s.programa.director.miembro.person.name, "Director"); // no se borró al asignar las otras
    assert.equal(s.programa.predicador.invitado, "Pastor Luis Vega");
    assert.equal(s.programa.lectura_biblica.pasaje, "Salmo 23");

    const incompletos = await api.esperar(200, "GET", "/sesion-servicio?programa_incompleto=true&limite=50", null, t);
    assert.equal(incompletos.meta.total, 7);

    s = await api.esperar(200, "PUT", ruta, { director: null }, t);
    assert.deepEqual(s.funciones_pendientes, ["director"]);
    await api.esperar(200, "PUT", ruta, { director: { miembro: director._id } }, t);
  });

  it("eventos del calendario: vigilias, campañas...", async () => {
    await api.esperar(400, "POST", "/calendario/eventos", { titulo: "Mal", tipo: "vigilia", fecha_inicio: "2026-12-20T22:00:00-05:00", fecha_fin: "2026-12-19T22:00:00-05:00" }, t);
    const vigilia = await api.esperar(201, "POST", "/calendario/eventos", {
      titulo: "Vigilia de fin de año", tipo: "vigilia", fecha_inicio: "2026-12-31T22:00:00-05:00", fecha_fin: "2027-01-01T02:00:00-05:00",
      lugar: "Templo", departamento: jovenes._id, responsable: director._id,
    }, t);
    assert.equal(vigilia.estado, "programado");
    const campana = await api.esperar(201, "POST", "/calendario/eventos", { titulo: "Campaña evangelística", tipo: "campana_evangelistica", fecha_inicio: "2026-12-12T16:00:00-05:00" }, t);
    assert.equal(campana.fecha_fin, campana.fecha_inicio); // sin fin = mismo momento
    const enDiciembre = await api.esperar(200, "GET", "/calendario/eventos?desde=2026-12-01&hasta=2026-12-31", null, tk.lector);
    assert.equal(enDiciembre.meta.total, 2);
    const enEnero = await api.esperar(200, "GET", "/calendario/eventos?desde=2027-01-01&hasta=2027-01-31", null, t);
    assert.equal(enEnero.meta.total, 1); // la vigilia cruza al 1 de enero
    await api.esperar(200, "PUT", `/calendario/eventos/${campana._id}`, { estado: "postergado" }, t);
  });

  it("calendario unificado con el programa de cada culto", async () => {
    const c = await api.esperar(200, "GET", `/calendario?desde=${DICIEMBRE.desde}&hasta=2026-12-31T23:59:59-05:00`, null, tk.lector);
    assert.equal(c.cultos, 8);
    assert.equal(c.eventos, 2);
    assert.equal(c.cultos_con_programa_incompleto, 7);
    const primero = c.items.find((i) => i.tipo === "culto" && i.titulo === "CULTO DOMINICAL");
    assert.equal(primero.programa.director.nombre, "Director Calendario");
    assert.equal(primero.programa.predicador.nombre, "Pastor Luis Vega (IEP Tacna)");
    assert.equal(primero.programa.predicador.texto_biblico, "Efesios 2:8-10");
    assert.equal(primero.departamento, "MINISTERIO DE LITURGIA");
    const fechas = c.items.map((i) => new Date(i.fecha_inicio).getTime());
    assert.deepEqual(fechas, [...fechas].sort((a, b) => a - b)); // ordenado

    const soloJovenes = await api.esperar(200, "GET", `/calendario?desde=${DICIEMBRE.desde}&hasta=2026-12-31&departamento=${jovenes._id}`, null, t);
    assert.equal(soloJovenes.cultos, 4);
    assert.equal(soloJovenes.eventos, 1);
  });

  it("mis asignaciones", async () => {
    const mias = await api.esperar(200, "GET", "/calendario/mis-asignaciones?desde=2026-12-01", null, tk.director);
    assert.equal(mias.length, 1);
    assert.equal(mias[0].funcion, "director");
    assert.equal(mias[0].servicio, "CULTO DOMINICAL");
    const lectora = await api.esperar(200, "GET", "/calendario/mis-asignaciones?desde=2026-12-01", null, tk.lider);
    assert.equal(lectora[0].pasaje, "Salmo 23");
    await api.esperar(400, "GET", "/calendario/mis-asignaciones", null, tk.sinMiembro);
  });

  it("el líder programa solo los cultos y eventos de su departamento", async () => {
    await api.esperar(200, "PUT", `/sesion-servicio/${sesionJovenes._id}/programa`, { predicador: { miembro: lectora._id, tema: "Juventud y fe" } }, tk.lider);
    await api.esperar(403, "PUT", `/sesion-servicio/${sesionCulto._id}/programa`, { predicador: { miembro: lectora._id } }, tk.lider);
    await api.esperar(201, "POST", "/calendario/eventos", { titulo: "Retiro juvenil", tipo: "retiro", fecha_inicio: "2026-12-26T08:00:00-05:00", departamento: jovenes._id }, tk.lider);
    await api.esperar(403, "POST", "/calendario/eventos", { titulo: "Otro", tipo: "otro", fecha_inicio: "2026-12-26T08:00:00-05:00", departamento: liturgia._id }, tk.lider);
    await api.esperar(403, "POST", "/calendario/eventos", { titulo: "Sin depto", tipo: "otro", fecha_inicio: "2026-12-26T08:00:00-05:00" }, tk.lider);
    await api.esperar(403, "POST", "/sesion-servicio/generar", { desde: "2027-01-01", hasta: "2027-01-31" }, tk.lider); // todos los servicios
    const r = await api.esperar(201, "POST", "/sesion-servicio/generar", { desde: "2027-01-01", hasta: "2027-01-31", servicios: [reunionJovenes._id] }, tk.lider);
    assert.equal(r.creadas, 5); // sábados de enero 2027: 2, 9, 16, 23, 30
    await api.esperar(403, "POST", "/calendario/eventos", { titulo: "X", tipo: "otro", fecha_inicio: "2026-12-26T08:00:00-05:00" }, tk.lector);
  });

  it("no se puede eliminar a un miembro asignado en un programa", async () => {
    await api.esperar(409, "DELETE", `/miembro/${director._id}`, null, t);
  });
});
