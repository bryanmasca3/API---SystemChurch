import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { iniciarServidor, sembrarBasico } from "./helpers/servidor.js";

describe("Finanzas", () => {
  let api, datos, tk, caja, banco, fondoJovenes, catMisiones, catServicios;

  const mov = (body, status = 201, token = tk.tesorero) =>
    api.esperar(status, "POST", "/finanzas/movimientos", body, token);
  const saldo = async (fondo) =>
    (await api.esperar(200, "GET", `/finanzas/fondos/${fondo._id}`, null, tk.tesorero)).saldo_actual;

  before(async () => {
    api = await iniciarServidor();
    datos = await sembrarBasico(api);
    const rol = await api.esperar(201, "POST", "/catalogo/rol-miembro", { description: "Presidente" }, api.tokenAdmin);
    await api.esperar(201, "POST", `/departamento/${datos.departamento._id}/integrantes`, { member: datos.miembro._id, role: rol._id }, api.tokenAdmin);
    tk = { admin: api.tokenAdmin };
    for (const r of ["tesorero", "pastor", "secretario", "lector"]) tk[r] = (await api.crearUsuario(r)).token;
    tk.lider = (await api.crearUsuario("lider", { miembro: datos.miembro._id })).token;
  });
  after(() => api.cerrar());

  it("permisos: solo administrador y tesorero registran; lector y secretario no ven finanzas", async () => {
    const fondo = { nombre: "Caja general", tipo: "caja", saldo_inicial: 100, fecha_inicio: "2024-01-01" };
    await api.esperar(403, "POST", "/finanzas/fondos", fondo, tk.secretario);
    await api.esperar(403, "GET", "/finanzas/fondos", null, tk.lector);
    await api.esperar(403, "GET", "/finanzas/movimientos", null, tk.secretario);
    caja = await api.esperar(201, "POST", "/finanzas/fondos", fondo, tk.tesorero);
    banco = await api.esperar(201, "POST", "/finanzas/fondos", { nombre: "Banco BCP", tipo: "banco", entidad: "BCP", fecha_inicio: "2024-01-01" }, tk.tesorero);
    fondoJovenes = await api.esperar(201, "POST", "/finanzas/fondos", { nombre: "Fondo Jóvenes", tipo: "fondo", departamento: datos.departamento._id, saldo_inicial: 50, fecha_inicio: "2024-01-01" }, tk.tesorero);
    assert.equal(caja.saldo_inicial, 100);
    await api.esperar(200, "GET", "/finanzas/fondos", null, tk.pastor);
  });

  it("categorías por tipo", async () => {
    catMisiones = await api.esperar(201, "POST", "/finanzas/categorias", { description: "Ofrenda de misiones", tipo: "ingreso" }, tk.tesorero);
    catServicios = await api.esperar(201, "POST", "/finanzas/categorias", { description: "Servicios básicos", tipo: "egreso" }, tk.tesorero);
    await api.esperar(409, "POST", "/finanzas/categorias", { description: "Servicios básicos", tipo: "egreso" }, tk.tesorero);
    const egresos = await api.esperar(200, "GET", "/finanzas/categorias?tipo=egreso", null, tk.tesorero);
    assert.deepEqual(egresos.map((c) => c.description), ["Servicios básicos"]);
  });

  it("diezmos con miembro o anónimos; ofrendas siempre anónimas", async () => {
    const d = await mov({ tipo: "ingreso", clase: "diezmo", monto: 150.5, fondo: caja._id, miembro: datos.miembro._id, fecha: "2024-03-10T11:00:00-05:00", medio_pago: "yape_plin" });
    assert.equal(d.miembro.person.name, "Juan");
    assert.equal(d.periodo, "2024-03");
    assert.equal(d.registrado_por.nombre, "tesorero 1");
    await mov({ tipo: "ingreso", clase: "diezmo", monto: 80, fondo: caja._id, fecha: "2024-03-10T11:00:00-05:00" });

    const r = await api.req("POST", "/finanzas/movimientos", { tipo: "ingreso", clase: "ofrenda", monto: 10, fondo: caja._id, miembro: datos.miembro._id, fecha: "2024-03-10" }, tk.tesorero);
    assert.equal(r.status, 400);
    assert.match(r.body.message, /ofrendas son anónimas/);

    // 31/03 22:00 en Lima es 01/04 en UTC, pero pertenece a marzo
    const o = await mov({ tipo: "ingreso", clase: "ofrenda", monto: 45.3, fondo: caja._id, fecha: "2024-03-31T22:00:00-05:00" });
    assert.equal(o.periodo, "2024-03");
  });

  it("otros ingresos y egresos exigen una categoría del tipo correcto", async () => {
    await mov({ tipo: "ingreso", clase: "otro", monto: 20, fondo: caja._id, fecha: "2024-03-12" }, 400);
    await mov({ tipo: "ingreso", clase: "otro", monto: 20, fondo: caja._id, fecha: "2024-03-12", categoria: catServicios._id }, 400);
    await mov({ tipo: "ingreso", clase: "otro", monto: 20, fondo: caja._id, fecha: "2024-03-12", categoria: catMisiones._id });
    await mov({ tipo: "egreso", monto: 30, fondo: caja._id, fecha: "2024-03-15", categoria: catMisiones._id }, 400);
    const e = await mov({ tipo: "egreso", monto: 30, fondo: caja._id, fecha: "2024-03-15", categoria: catServicios._id, beneficiario: "SEAL", comprobante: { tipo: "recibo", numero: "R-001" } });
    assert.equal(e.categoria.description, "Servicios básicos");
    await mov({ tipo: "egreso", monto: 30, fondo: caja._id, fecha: "2024-03-15", categoria: catServicios._id, clase: "diezmo" }, 400);
  });

  it("el saldo se calcula y no permite gastar de más", async () => {
    // 100 + 150.5 + 80 + 45.3 + 20 − 30 = 365.8
    assert.equal(await saldo(caja), 365.8);
    const r = await api.req("POST", "/finanzas/movimientos", { tipo: "egreso", monto: 1000, fondo: caja._id, fecha: "2024-03-16", categoria: catServicios._id }, tk.tesorero);
    assert.equal(r.status, 409);
    assert.match(r.body.message, /Saldo insuficiente.*365\.80/);
  });

  it("transferencias entre fondos", async () => {
    await mov({ tipo: "transferencia", monto: 200, fondo: caja._id, fondo_destino: caja._id, fecha: "2024-03-20" }, 400);
    await mov({ tipo: "transferencia", monto: 200, fondo: caja._id, fondo_destino: banco._id, fecha: "2024-03-20", medio_pago: "deposito" });
    assert.equal(await saldo(caja), 165.8);
    assert.equal(await saldo(banco), 200);
    await mov({ tipo: "transferencia", monto: 1, fondo: caja._id, fecha: "2024-03-20" }, 400); // falta destino
  });

  it("rechaza fechas futuras o anteriores al inicio del fondo", async () => {
    await mov({ tipo: "ingreso", clase: "ofrenda", monto: 5, fondo: caja._id, fecha: "2099-01-01" }, 400);
    await mov({ tipo: "ingreso", clase: "ofrenda", monto: 5, fondo: caja._id, fecha: "2023-12-31" }, 400);
  });

  it("anular: deja de contar, no se repite y no deja fondos en negativo", async () => {
    const e = await mov({ tipo: "egreso", monto: 15.8, fondo: caja._id, fecha: "2024-03-21", categoria: catServicios._id });
    assert.equal(await saldo(caja), 150);
    await api.esperar(400, "POST", `/finanzas/movimientos/${e._id}/anular`, { motivo: "x" }, tk.tesorero); // motivo corto
    const anulado = await api.esperar(200, "POST", `/finanzas/movimientos/${e._id}/anular`, { motivo: "Registrado dos veces" }, tk.tesorero);
    assert.equal(anulado.anulado, true);
    assert.equal(anulado.anulacion.usuario.nombre, "tesorero 1");
    assert.equal(await saldo(caja), 165.8);
    await api.esperar(409, "POST", `/finanzas/movimientos/${e._id}/anular`, { motivo: "Otra vez" }, tk.tesorero);

    const lista = await api.esperar(200, "GET", "/finanzas/movimientos?tipo=egreso", null, tk.tesorero);
    assert.ok(lista.data.every((m) => !m.anulado));
    const conAnulados = await api.esperar(200, "GET", "/finanzas/movimientos?tipo=egreso&incluir_anulados=true", null, tk.tesorero);
    assert.equal(conAnulados.meta.total, lista.meta.total + 1);

    // Fondo Jóvenes: 50 + 20 − 60 = 10; anular el ingreso de 20 lo dejaría en −10
    const ing = await mov({ tipo: "ingreso", clase: "ofrenda", monto: 20, fondo: fondoJovenes._id, fecha: "2024-03-09" });
    await mov({ tipo: "egreso", monto: 60, fondo: fondoJovenes._id, fecha: "2024-03-09", categoria: catServicios._id });
    const r = await api.req("POST", `/finanzas/movimientos/${ing._id}/anular`, { motivo: "Prueba de negativo" }, tk.tesorero);
    assert.equal(r.status, 409);
    assert.match(r.body.message, /negativo/);
  });

  it("el líder solo ve el fondo de su departamento y sin diezmantes", async () => {
    const fondos = await api.esperar(200, "GET", "/finanzas/fondos", null, tk.lider);
    assert.deepEqual(fondos.map((f) => f.nombre), ["Fondo Jóvenes"]);
    await api.esperar(404, "GET", `/finanzas/fondos/${caja._id}`, null, tk.lider);

    const movs = await api.esperar(200, "GET", "/finanzas/movimientos", null, tk.lider);
    assert.equal(movs.meta.total, 2);
    assert.ok(movs.data.every((m) => String(m.fondo._id) === String(fondoJovenes._id) && !("miembro" in m)));
    const otro = await api.esperar(200, "GET", `/finanzas/movimientos?fondo=${caja._id}`, null, tk.lider);
    assert.equal(otro.meta.total, 0);
    await api.esperar(403, "GET", `/finanzas/movimientos?miembro=${datos.miembro._id}`, null, tk.lider);
    await api.esperar(403, "GET", "/finanzas/reportes/diezmos?anio=2024", null, tk.lider);
    await api.esperar(403, "GET", "/finanzas/cierres", null, tk.lider);
    await mov({ tipo: "ingreso", clase: "ofrenda", monto: 1, fondo: fondoJovenes._id, fecha: "2024-03-09" }, 403, tk.lider);

    const informe = await api.esperar(200, "GET", "/finanzas/reportes/mensual?periodo=2024-03", null, tk.lider);
    assert.deepEqual(informe.fondos.map((f) => f.nombre), ["Fondo Jóvenes"]);
    assert.equal(informe.ingresos.total, 20);
  });

  it("informe mensual y anual", async () => {
    const m = await api.esperar(200, "GET", "/finanzas/reportes/mensual?periodo=2024-03", null, tk.pastor);
    const c = m.fondos.find((f) => f.nombre === "Caja general");
    assert.deepEqual(
      { inicial: c.saldo_inicial, ingresos: c.ingresos, egresos: c.egresos, salida: c.transferencias_salida, final: c.saldo_final },
      { inicial: 100, ingresos: 295.8, egresos: 30, salida: 200, final: 165.8 },
    );
    const conceptos = Object.fromEntries(m.ingresos.detalle.map((d) => [d.concepto, d.total]));
    assert.deepEqual(conceptos, { Diezmos: 230.5, Ofrendas: 65.3, "Ofrenda de misiones": 20 });
    assert.equal(m.egresos.total, 90); // 30 caja + 60 jóvenes (el anulado no cuenta)
    assert.equal(m.resultado, 225.8);
    assert.equal(m.cerrado, false);
    await api.esperar(400, "GET", "/finanzas/reportes/mensual?periodo=2024-13", null, tk.pastor);

    const a = await api.esperar(200, "GET", "/finanzas/reportes/anual?anio=2024", null, tk.tesorero);
    const marzo = a.meses[2];
    assert.equal(marzo.diezmos, 230.5);
    assert.equal(marzo.ofrendas, 65.3);
    assert.equal(marzo.otros_ingresos, 20);
    assert.equal(a.meses[0].ingresos, 0);
  });

  it("diezmos: listado por miembro y constancia individual", async () => {
    const todos = await api.esperar(200, "GET", "/finanzas/reportes/diezmos?anio=2024", null, tk.pastor);
    assert.equal(todos.por_miembro.length, 1);
    assert.equal(todos.por_miembro[0].nombre, "Juan Pérez");
    assert.equal(todos.por_miembro[0].total, 150.5);
    assert.equal(todos.anonimos.total, 80);
    assert.equal(todos.total, 230.5);

    const constancia = await api.esperar(200, "GET", `/finanzas/reportes/diezmos?anio=2024&miembro=${datos.miembro._id}`, null, tk.tesorero);
    assert.equal(constancia.miembro.nombre, "Juan Pérez");
    assert.equal(constancia.cantidad, 1);
    assert.equal(constancia.diezmos[0].fondo.nombre, "Caja general");
    await api.esperar(409, "DELETE", `/miembro/${datos.miembro._id}`, null, tk.admin); // tiene diezmos
  });

  it("cierre mensual: en orden, bloquea el mes y solo el administrador reabre", async () => {
    await mov({ tipo: "ingreso", clase: "diezmo", monto: 10, fondo: caja._id, fecha: "2024-02-11" });
    const r = await api.req("POST", "/finanzas/cierres", { periodo: "2024-03" }, tk.tesorero);
    assert.equal(r.status, 409);
    assert.match(r.body.message, /2024-02/);
    await api.esperar(400, "POST", "/finanzas/cierres", { periodo: "2099-01" }, tk.tesorero);

    await api.esperar(201, "POST", "/finanzas/cierres", { periodo: "2024-02" }, tk.tesorero);
    const marzo = await api.esperar(201, "POST", "/finanzas/cierres", { periodo: "2024-03", observacion: "Aprobado en sesión" }, tk.tesorero);
    const c = marzo.saldos.find((s) => s.nombre === "Caja general");
    assert.equal(c.saldo_inicial, 110); // 100 + diezmo de febrero
    assert.equal(c.saldo_final, 175.8);
    await api.esperar(409, "POST", "/finanzas/cierres", { periodo: "2024-03" }, tk.tesorero);

    // Mes cerrado: sin movimientos nuevos ni anulaciones
    await mov({ tipo: "ingreso", clase: "ofrenda", monto: 5, fondo: caja._id, fecha: "2024-03-25" }, 409);
    const unoDeMarzo = (await api.esperar(200, "GET", "/finanzas/movimientos?periodo=2024-03&tipo=ingreso", null, tk.tesorero)).data[0];
    await api.esperar(409, "POST", `/finanzas/movimientos/${unoDeMarzo._id}/anular`, { motivo: "Intento en mes cerrado" }, tk.tesorero);
    await api.esperar(409, "PUT", `/finanzas/fondos/${caja._id}`, { saldo_inicial: 0 }, tk.tesorero);
    assert.equal((await api.esperar(200, "GET", "/finanzas/reportes/mensual?periodo=2024-03", null, tk.tesorero)).cerrado, true);

    // Reabrir: solo administrador y solo el último mes cerrado
    await api.esperar(403, "POST", "/finanzas/cierres/2024-03/reabrir", { motivo: "Corrección" }, tk.tesorero);
    await api.esperar(409, "POST", "/finanzas/cierres/2024-02/reabrir", { motivo: "Corrección" }, tk.admin);
    await api.esperar(200, "POST", "/finanzas/cierres/2024-03/reabrir", { motivo: "Faltó una ofrenda" }, tk.admin);
    await mov({ tipo: "ingreso", clase: "ofrenda", monto: 5, fondo: caja._id, fecha: "2024-03-25" });

    const lista = await api.esperar(200, "GET", "/finanzas/cierres", null, tk.pastor);
    assert.deepEqual(lista.map((x) => x.periodo), ["2024-02"]);
    const bit = await api.esperar(200, "GET", "/bitacora?recurso=Cierre mensual&accion=eliminar", null, tk.admin);
    assert.match(bit.data[0].resumen, /Reabierto 2024-03: Faltó una ofrenda/);
  });

  it("fondos: no se borran con movimientos; desactivados no reciben más", async () => {
    await api.esperar(409, "DELETE", `/finanzas/fondos/${caja._id}`, null, tk.tesorero);
    await api.esperar(200, "PUT", `/finanzas/fondos/${banco._id}`, { activo: false }, tk.tesorero);
    await mov({ tipo: "ingreso", clase: "ofrenda", monto: 5, fondo: banco._id, fecha: "2024-04-01" }, 409);
    await api.esperar(409, "DELETE", `/departamento/${datos.departamento._id}`, null, tk.admin); // tiene fondo
    const vacio = await api.esperar(201, "POST", "/finanzas/fondos", { nombre: "Temporal", tipo: "caja", fecha_inicio: "2024-01-01" }, tk.tesorero);
    await api.esperar(204, "DELETE", `/finanzas/fondos/${vacio._id}`, null, tk.tesorero);
  });
});
