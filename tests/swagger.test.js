import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import SwaggerParser from "@apidevtools/swagger-parser";
import { iniciarServidor } from "./helpers/servidor.js";

describe("Documentación Swagger", () => {
  let api;
  before(async () => {
    process.env.SWAGGER_ENABLED = "true";
    api = await iniciarServidor();
  });
  after(() => api.cerrar());

  it("sirve la interfaz y una especificación OpenAPI válida", async () => {
    const raiz = api.base.replace("/v1", "");
    const ui = await fetch(`${raiz}/docs/`);
    assert.equal(ui.status, 200);
    assert.match(await ui.text(), /swagger-ui/);

    const spec = await (await fetch(`${raiz}/docs.json`)).json();
    await SwaggerParser.validate(structuredClone(spec));
    assert.ok(Object.keys(spec.paths).length > 50);
  });

  it("documenta los roles de cada endpoint desde la matriz de permisos", async () => {
    const spec = await (await fetch(`${api.base.replace("/v1", "")}/docs.json`)).json();
    assert.match(spec.paths["/usuario"].get.summary, /administrador/);
    assert.match(spec.paths["/inventario"].post.summary, /lider solo en su departamento/);
    assert.match(spec.info.description, /\| tesorero \|/);
  });
});
