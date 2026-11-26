/**
 * Levanta la API completa contra una MongoDB en memoria (replica set, para que
 * funcionen las transacciones). Nunca toca la base de datos real.
 *
 *   const api = await iniciarServidor();
 *   const { status, body } = await api.req("GET", "/miembro", null, api.tokenAdmin);
 *   await api.cerrar();
 */
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";

export const ADMIN = { correo: "admin@example.com", contrasena: "admin123" };

export async function iniciarServidor() {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri("iep_test");

  // Deben definirse ANTES de importar la app: dotenv no sobrescribe variables existentes
  Object.assign(process.env, {
    NODE_ENV: "test",
    MONGO_URI: uri,
    TOKEN_JWT: "secreto-de-pruebas",
    ADMIN_CORREO: ADMIN.correo,
    ADMIN_CONTRASENA: ADMIN.contrasena,
    LOGIN_MAX_ATTEMPTS: "5",
  });

  const { default: config } = await import("../../src/config/env.config.js");
  // Salvaguarda: jamás correr las pruebas contra Atlas u otra BD real
  assert.ok(config.MONGO_URI.startsWith("mongodb://127.0.0.1"), "Las pruebas deben usar la BD en memoria");

  const { default: mongoose } = await import("mongoose");
  const { connectDB, disconnectDB } = await import("../../src/libs/mongoose.js");
  const { default: app } = await import("../../src/app.js");
  const { usuarioService } = await import("../../src/controllers/usuario.controller.js");

  await connectDB();
  await usuarioService.asegurarAdminInicial();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init())); // índices listos

  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;

  /** Petición HTTP. `body` puede ser objeto o string crudo (para probar JSON inválido). */
  const req = async (method, path, body, token) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body == null ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const texto = await res.text();
    return { status: res.status, body: texto ? JSON.parse(texto) : null, headers: res.headers };
  };

  /** Hace la petición y verifica el status; devuelve el body. */
  const esperar = async (status, method, path, body, token) => {
    const r = await req(method, path, body, token);
    assert.equal(r.status, status, `${method} ${path} -> ${r.status}: ${JSON.stringify(r.body)}`);
    return r.body;
  };

  const login = async (correo, contrasena) =>
    (await esperar(200, "POST", "/login", { correo, contrasena })).token;

  const tokenAdmin = await login(ADMIN.correo, ADMIN.contrasena);

  /** Crea un usuario con el rol indicado y devuelve { usuario, token }. */
  let contador = 0;
  const crearUsuario = async (rol, extra = {}) => {
    contador += 1;
    const correo = `${rol}${contador}@example.com`;
    const usuario = await esperar(
      201,
      "POST",
      "/usuario",
      { nombre: `${rol} ${contador}`, correo, contrasena: "clave123", rol, ...extra },
      tokenAdmin,
    );
    return { usuario, token: await login(correo, "clave123") };
  };

  const cerrar = async () => {
    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
    await replSet.stop();
  };

  return { req, esperar, login, crearUsuario, tokenAdmin, cerrar, uri, base, mongoose };
}

/** Datos mínimos reutilizables: catálogos, un miembro y un departamento. */
export async function sembrarBasico(api) {
  const { esperar, tokenAdmin: t } = api;
  const estado = await esperar(201, "POST", "/catalogo/estado", { description: "Activo" }, t);
  const genero = await esperar(201, "POST", "/catalogo/genero", { description: "Masculino" }, t);
  const miembro = await esperar(
    201,
    "POST",
    "/miembro",
    { state: estado._id, person: { name: "Juan", surname: "Pérez", gender: genero._id } },
    t,
  );
  const departamento = await esperar(201, "POST", "/departamento", { description: "Jóvenes" }, t);
  return { estado, genero, miembro, departamento };
}
