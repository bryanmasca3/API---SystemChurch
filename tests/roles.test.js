import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { iniciarServidor, sembrarBasico } from "./helpers/servidor.js";

describe("Roles y permisos", () => {
  let api, datos, otroDepartamento, tokens;

  before(async () => {
    api = await iniciarServidor();
    datos = await sembrarBasico(api);
    otroDepartamento = await api.esperar(201, "POST", "/departamento", { description: "Liga Femenina" }, api.tokenAdmin);

    // El líder es integrante de "Jóvenes" (datos.departamento), no de "Liga Femenina"
    const rol = await api.esperar(201, "POST", "/catalogo/rol-miembro", { description: "Presidente" }, api.tokenAdmin);
    await api.esperar(
      201,
      "POST",
      `/departamento/${datos.departamento._id}/integrantes`,
      { member: datos.miembro._id, role: rol._id },
      api.tokenAdmin,
    );
    datos.rolMiembro = rol;

    tokens = {};
    for (const r of ["pastor", "secretario", "tesorero", "lector"]) tokens[r] = (await api.crearUsuario(r)).token;
    tokens.lider = (await api.crearUsuario("lider", { miembro: datos.miembro._id })).token;
  });
  after(() => api.cerrar());

  it("todos los roles pueden leer miembros", async () => {
    for (const token of Object.values(tokens)) await api.esperar(200, "GET", "/miembro", null, token);
  });

  it("solo administrador, pastor y secretario registran personas", async () => {
    const persona = { name: "X", surname: "Y" };
    for (const r of ["pastor", "secretario"]) await api.esperar(201, "POST", "/persona", persona, tokens[r]);
    for (const r of ["tesorero", "lector", "lider"]) await api.esperar(403, "POST", "/persona", persona, tokens[r]);
  });

  it("solo el administrador gestiona usuarios", async () => {
    for (const token of Object.values(tokens)) await api.esperar(403, "GET", "/usuario", null, token);
    await api.esperar(200, "GET", "/usuario", null, api.tokenAdmin);
  });

  it("la bitácora la ven administrador y pastor", async () => {
    await api.esperar(200, "GET", "/bitacora", null, tokens.pastor);
    for (const r of ["secretario", "tesorero", "lector", "lider"]) {
      await api.esperar(403, "GET", "/bitacora", null, tokens[r]);
    }
  });

  it("el líder gestiona integrantes solo de su departamento", async () => {
    const { miembro } = await nuevoMiembro(api, datos, "Luis");
    await api.esperar(
      201,
      "POST",
      `/departamento/${datos.departamento._id}/integrantes`,
      { member: miembro._id, role: datos.rolMiembro._id },
      tokens.lider,
    );
    const r = await api.req(
      "POST",
      `/departamento/${otroDepartamento._id}/integrantes`,
      { member: miembro._id, role: datos.rolMiembro._id },
      tokens.lider,
    );
    assert.equal(r.status, 403);
    assert.match(r.body.message, /tu departamento/);
    // Pero no puede crear ni renombrar departamentos
    await api.esperar(403, "PUT", `/departamento/${datos.departamento._id}`, { description: "Otro" }, tokens.lider);
  });

  it("el líder registra reuniones de su departamento y no puede moverlas a otro", async () => {
    const tipo = await api.esperar(201, "POST", "/catalogo/tipo-reunion", { description: "Ordinaria" }, api.tokenAdmin);
    const base = { subject: "S", description: "D", typemeeting: tipo._id, date: "2024-04-01T19:00:00-05:00" };
    const propia = await api.esperar(201, "POST", "/reunion", { ...base, departament: datos.departamento._id }, tokens.lider);
    await api.esperar(403, "POST", "/reunion", { ...base, departament: otroDepartamento._id }, tokens.lider);
    await api.esperar(200, "PUT", `/reunion/${propia._id}`, { subject: "Editada" }, tokens.lider);
    await api.esperar(403, "PUT", `/reunion/${propia._id}`, { departament: otroDepartamento._id }, tokens.lider);
    await api.esperar(201, "POST", `/reunion/${propia._id}/asistentes`, { member: datos.miembro._id }, tokens.lider);

    const ajena = await api.esperar(201, "POST", "/reunion", { ...base, departament: otroDepartamento._id }, api.tokenAdmin);
    await api.esperar(403, "DELETE", `/reunion/${ajena._id}`, null, tokens.lider);
    await api.esperar(403, "POST", `/reunion/${ajena._id}/asistentes`, { member: datos.miembro._id }, tokens.lider);
  });

  it("el líder toma asistencia solo en sesiones de servicios de su departamento", async () => {
    const t = api.tokenAdmin;
    const servicio = await api.esperar(201, "POST", "/servicio", { description: "Culto juvenil", day: "sábado", departament: datos.departamento._id }, t);
    const servicioAjeno = await api.esperar(201, "POST", "/servicio", { description: "Liga", day: "sábado", departament: otroDepartamento._id }, t);
    const sesion = await api.esperar(201, "POST", "/sesion-servicio", { service: servicio._id, date: "2024-03-09T17:00:00-05:00" }, tokens.lider);
    await api.esperar(403, "POST", "/sesion-servicio", { service: servicioAjeno._id, date: "2024-03-09T17:00:00-05:00" }, tokens.lider);
    const sesionAjena = await api.esperar(201, "POST", "/sesion-servicio", { service: servicioAjeno._id, date: "2024-03-09T17:00:00-05:00" }, t);

    const persona = datos.miembro.person._id;
    const asis = await api.esperar(201, "POST", "/asistencia", { sesion: sesion._id, person: persona }, tokens.lider);
    await api.esperar(403, "POST", "/asistencia", { sesion: sesionAjena._id, person: persona }, tokens.lider);
    await api.esperar(403, "PUT", `/asistencia/${asis._id}`, { sesion: sesionAjena._id }, tokens.lider);
    await api.esperar(204, "DELETE", `/asistencia/${asis._id}`, null, tokens.lider);
    await api.esperar(201, "POST", "/asistencia-santa-cena", { sesion: sesion._id, miembro: datos.miembro._id }, tokens.lider);
  });

  it("el líder maneja el inventario de su departamento", async () => {
    const cat = await api.esperar(201, "POST", "/catalogo/categoria-inventario", { description: "Sonido" }, api.tokenAdmin);
    const propio = await api.esperar(201, "POST", "/inventario", { nombre: "Parlante", categoria: cat._id, cantidad: 2, departamento: datos.departamento._id }, tokens.lider);
    await api.esperar(403, "POST", "/inventario", { nombre: "Sin depto", categoria: cat._id }, tokens.lider);
    await api.esperar(403, "PUT", `/inventario/${propio._id}`, { departamento: otroDepartamento._id }, tokens.lider);
    await api.esperar(201, "POST", `/inventario/${propio._id}/movimientos`, { tipo: "baja", cantidad: 1 }, tokens.lider);

    const ajeno = await api.esperar(201, "POST", "/inventario", { nombre: "Mesa", categoria: cat._id, cantidad: 1, departamento: otroDepartamento._id }, api.tokenAdmin);
    await api.esperar(403, "POST", `/inventario/${ajeno._id}/movimientos`, { tipo: "baja", cantidad: 1 }, tokens.lider);
    // El secretario sí puede en cualquier departamento
    await api.esperar(201, "POST", `/inventario/${ajeno._id}/movimientos`, { tipo: "baja", cantidad: 1 }, tokens.secretario);
  });

  it("un líder necesita un miembro vinculado", async () => {
    await api.esperar(400, "POST", "/usuario", { nombre: "L", correo: "l@example.com", contrasena: "clave123", rol: "lider" }, api.tokenAdmin);
    const { usuario } = await api.crearUsuario("lector");
    await api.esperar(400, "PUT", `/usuario/${usuario._id}`, { rol: "lider" }, api.tokenAdmin);
    await api.esperar(200, "PUT", `/usuario/${usuario._id}`, { rol: "lider", miembro: datos.miembro._id }, api.tokenAdmin);
  });

  it("desactivar un usuario corta su acceso al instante", async () => {
    const { usuario, token } = await api.crearUsuario("lector");
    await api.esperar(200, "GET", "/miembro", null, token);
    await api.esperar(200, "PUT", `/usuario/${usuario._id}`, { activo: false }, api.tokenAdmin);
    await api.esperar(401, "GET", "/miembro", null, token);
    await api.esperar(401, "POST", "/login", { correo: usuario.correo, contrasena: "clave123" });
  });

  it("no se puede quitar al último administrador activo", async () => {
    const lista = await api.esperar(200, "GET", "/usuario?rol=administrador", null, api.tokenAdmin);
    assert.equal(lista.meta.total, 1);
    const admin = lista.data[0];
    await api.esperar(409, "PUT", `/usuario/${admin._id}`, { rol: "lector" }, api.tokenAdmin);
    await api.esperar(409, "PUT", `/usuario/${admin._id}`, { activo: false }, api.tokenAdmin);
    await api.esperar(409, "DELETE", `/usuario/${admin._id}`, null, api.tokenAdmin);
    // Con un segundo administrador sí se puede
    await api.crearUsuario("administrador");
    await api.esperar(200, "PUT", `/usuario/${admin._id}`, { nombre: "Admin principal" }, api.tokenAdmin);
  });

  it("rechaza roles inexistentes", async () => {
    const r = await api.req("POST", "/usuario", { nombre: "X", correo: "x@example.com", contrasena: "clave123", rol: "jefe" }, api.tokenAdmin);
    assert.equal(r.status, 400);
    assert.match(r.body.message, /administrador, pastor/);
  });
});

async function nuevoMiembro(api, datos, nombre) {
  const miembro = await api.esperar(
    201,
    "POST",
    "/miembro",
    { state: datos.estado._id, person: { name: nombre, surname: "Test" } },
    api.tokenAdmin,
  );
  return { miembro };
}
