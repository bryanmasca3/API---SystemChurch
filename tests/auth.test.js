import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { iniciarServidor, ADMIN } from "./helpers/servidor.js";

describe("Autenticación y errores generales", () => {
  let api;
  before(async () => {
    api = await iniciarServidor();
  });
  after(() => api.cerrar());

  it("responde en la raíz y 404 en rutas inexistentes", async () => {
    const raiz = await fetch(api.base.replace("/api/v1", "/"));
    assert.equal(raiz.status, 200);
    await api.esperar(404, "GET", "/no-existe", null, api.tokenAdmin);
  });

  it("exige token válido", async () => {
    await api.esperar(401, "GET", "/miembro");
    await api.esperar(401, "GET", "/miembro", null, "token-falso");
  });

  it("valida el body del login y rechaza JSON mal formado", async () => {
    await api.esperar(400, "POST", "/login", {});
    const r = await api.req("POST", "/login", "{malo");
    assert.equal(r.status, 400);
    assert.match(r.body.message, /JSON/);
  });

  it("acepta el correo sin distinguir mayúsculas y devuelve rol y permisos", async () => {
    const body = await api.esperar(200, "POST", "/login", {
      correo: ADMIN.correo.toUpperCase(),
      contrasena: ADMIN.contrasena,
    });
    assert.ok(body.token);
    assert.equal(body.user.rol, "administrador");
    assert.equal(body.user.permisos.usuarios.escribir, true);
    assert.equal(body.user.contrasena, undefined);
  });

  it("el perfil de un líder indica que escribe solo en su departamento", async () => {
    const { miembro } = await crearMiembro(api);
    const { token } = await api.crearUsuario("lider", { miembro: miembro._id });
    const perfil = await api.esperar(200, "GET", "/login/perfil", null, token);
    assert.equal(perfil.permisos.inventario.escribir, "departamento");
    assert.equal(perfil.permisos.usuarios.leer, false);
  });

  it("cambia la contraseña propia y exige mínimo 6 caracteres", async () => {
    const { usuario, token } = await api.crearUsuario("lector");
    await api.esperar(400, "POST", "/login/actualizar-contrasena", { nuevaContrasena: "123" }, token);
    const r = await api.esperar(200, "POST", "/login/actualizar-contrasena", { nuevaContrasena: "nueva123" }, token);
    assert.equal(r.user.login_inicial, false);
    await api.login(usuario.correo, "nueva123");
  });

  it("bloquea tras varios intentos fallidos (429)", async () => {
    const intento = () => api.req("POST", "/login", { correo: "nadie@example.com", contrasena: "mala" });
    for (let i = 0; i < 5; i++) assert.equal((await intento()).status, 401);
    const bloqueado = await intento();
    assert.equal(bloqueado.status, 429);
    assert.ok(bloqueado.headers.get("retry-after"));
  });
});

async function crearMiembro(api) {
  const estado = await api.esperar(201, "POST", "/catalogo/estado", { description: "Activo" }, api.tokenAdmin);
  const miembro = await api.esperar(
    201,
    "POST",
    "/miembro",
    { state: estado._id, person: { name: "Ana", surname: "Ríos" } },
    api.tokenAdmin,
  );
  return { miembro };
}
