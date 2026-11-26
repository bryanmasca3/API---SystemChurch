import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { iniciarServidor, ADMIN } from "./helpers/servidor.js";

describe("Bitácora", () => {
  let api, secretario;
  before(async () => {
    api = await iniciarServidor();
    secretario = await api.crearUsuario("secretario");
  });
  after(() => api.cerrar());

  const buscar = (query) => api.esperar(200, "GET", `/bitacora?${query}`, null, api.tokenAdmin);

  it("registra creación, edición (solo lo que cambió) y eliminación con el usuario", async () => {
    const persona = await api.esperar(201, "POST", "/persona", { name: "Ana", surname: "Ríos" }, secretario.token);
    await api.esperar(200, "PUT", `/persona/${persona._id}`, { surname: "Ríos Vega", name: "Ana" }, secretario.token);
    await api.esperar(204, "DELETE", `/persona/${persona._id}`, null, secretario.token);

    const { data } = await buscar(`documento=${persona._id}`);
    assert.deepEqual(data.map((r) => r.accion), ["eliminar", "actualizar", "crear"]);
    assert.ok(data.every((r) => r.usuario?.correo === secretario.usuario.correo && r.recurso === "Persona"));
    assert.deepEqual(data[1].cambios, { surname: { antes: "Ríos", despues: "Ríos Vega" } });
    assert.equal(data[0].cambios.antes.name, "Ana");
    assert.ok(data[2].ip);
  });

  it("no registra ediciones que no cambian nada", async () => {
    const p = await api.esperar(201, "POST", "/persona", { name: "Igual", surname: "X" }, api.tokenAdmin);
    await api.esperar(200, "PUT", `/persona/${p._id}`, { name: "Igual" }, api.tokenAdmin);
    const { meta } = await buscar(`documento=${p._id}&accion=actualizar`);
    assert.equal(meta.total, 0);
  });

  it("oculta las contraseñas", async () => {
    const { usuario } = await api.crearUsuario("lector");
    await api.esperar(200, "PUT", `/usuario/${usuario._id}`, { contrasena: "otra123" }, api.tokenAdmin);
    const { data } = await buscar(`documento=${usuario._id}`);
    const texto = JSON.stringify(data);
    assert.ok(!texto.includes("$2"), "no debe guardar hashes bcrypt");
    assert.ok(data.some((r) => r.resumen === "Contraseña restablecida por un administrador"));
    assert.equal(data.find((r) => r.accion === "crear").cambios.despues.contrasena, "[oculto]");
  });

  it("registra inicios de sesión correctos y fallidos", async () => {
    await api.req("POST", "/login", { correo: ADMIN.correo, contrasena: "mala" });
    await api.login(ADMIN.correo, ADMIN.contrasena);
    const fallidos = await buscar("accion=login_fallido");
    assert.ok(fallidos.data.some((r) => r.resumen.includes(ADMIN.correo)));
    const ok = await buscar("accion=login");
    assert.ok(ok.meta.total >= 1);
  });

  it("registra los movimientos de inventario", async () => {
    const cat = await api.esperar(201, "POST", "/catalogo/categoria-inventario", { description: "Cocina" }, api.tokenAdmin);
    const bien = await api.esperar(201, "POST", "/inventario", { nombre: "Olla", categoria: cat._id, cantidad: 3 }, api.tokenAdmin);
    await api.esperar(201, "POST", `/inventario/${bien._id}/movimientos`, { tipo: "baja", cantidad: 1, motivo: "Rota" }, api.tokenAdmin);
    const { data } = await buscar(`documento=${bien._id}`);
    assert.deepEqual(data.map((r) => r.accion), ["movimiento", "crear"]);
    assert.equal(data[0].resumen, "baja de 1 · Olla");
  });

  it("filtra por recurso y fechas", async () => {
    // "Hoy" en Perú: los filtros por día se interpretan en hora de Lima
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
    const r = await buscar(`recurso=Persona&desde=${hoy}`);
    assert.ok(r.meta.total >= 1 && r.data.every((x) => x.recurso === "Persona"));
    const vacio = await buscar("desde=2099-01-01");
    assert.equal(vacio.meta.total, 0);
  });
});
