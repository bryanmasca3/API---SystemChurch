import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { iniciarServidor, sembrarBasico } from "./helpers/servidor.js";

describe("Inventario", () => {
  let api, datos, t, cat, persona, bien;
  const mov = (body, status = 201) =>
    api.esperar(status, "POST", `/inventario/${bien._id}/movimientos`, body, t);

  before(async () => {
    api = await iniciarServidor();
    t = api.tokenAdmin;
    datos = await sembrarBasico(api);
    cat = await api.esperar(201, "POST", "/catalogo/categoria-inventario", { description: "Sonido" }, t);
    persona = await api.esperar(201, "POST", "/persona", { name: "Luis", surname: "Quispe" }, t);
  });
  after(() => api.cerrar());

  it("registra un bien y su cantidad inicial como entrada", async () => {
    bien = await api.esperar(201, "POST", "/inventario", {
      codigo: "snd-001", nombre: "Micrófono inalámbrico", categoria: cat._id, cantidad: 4,
      departamento: datos.departamento._id, encargado: datos.miembro._id, valor: 250,
    }, t);
    assert.equal(bien.codigo, "SND-001");
    assert.equal(bien.disponible, 4);
    assert.equal(bien.categoria.description, "Sonido");
    assert.equal(bien.encargado.person.name, "Juan");

    const hist = await api.esperar(200, "GET", `/inventario/${bien._id}/movimientos`, null, t);
    assert.equal(hist.data[0].tipo, "entrada");
    assert.equal(hist.data[0].motivo, "Registro inicial");
    assert.ok(hist.data[0].registrado_por.nombre);
    await api.esperar(409, "POST", "/inventario", { codigo: "SND-001", nombre: "Otro", categoria: cat._id }, t);
  });

  it("no permite editar la cantidad a mano", async () => {
    const r = await api.req("PUT", `/inventario/${bien._id}`, { cantidad: 99 }, t);
    assert.equal(r.status, 400);
    assert.match(r.body.message, /movimiento/);
    await api.esperar(200, "PUT", `/inventario/${bien._id}`, { estado: "regular" }, t);
  });

  it("entrada, préstamo, devolución parcial y total, baja", async () => {
    assert.equal((await mov({ tipo: "entrada", cantidad: 2, persona: persona._id })).bien.cantidad, 6);

    const p = await mov({ tipo: "prestamo", cantidad: 3, persona: persona._id, fecha_devolucion_prevista: "2020-01-01" });
    assert.equal(p.bien.disponible, 3);
    await mov({ tipo: "prestamo", cantidad: 4, persona: persona._id }, 409);
    await mov({ tipo: "baja", cantidad: 4 }, 409);
    await mov({ tipo: "prestamo", cantidad: 1 }, 400); // falta persona
    await mov({ tipo: "devolucion", cantidad: 1 }, 400); // falta préstamo

    const pend = await api.esperar(200, "GET", "/inventario/prestamos", null, t);
    assert.equal(pend.meta.total, 1);
    const venc = await api.esperar(200, "GET", "/inventario/prestamos?estado=vencido", null, t);
    assert.equal(venc.meta.total, 1);

    const d1 = await mov({ tipo: "devolucion", cantidad: 2, prestamo: p.movimiento._id });
    assert.equal(d1.bien.cantidad_prestada, 1);
    assert.equal(d1.movimiento.persona.name, "Luis"); // hereda quién se lo llevó
    await mov({ tipo: "devolucion", cantidad: 2, prestamo: p.movimiento._id }, 409);
    await mov({ tipo: "devolucion", cantidad: 1, prestamo: p.movimiento._id });
    assert.equal((await api.esperar(200, "GET", "/inventario/prestamos?estado=devuelto", null, t)).meta.total, 1);

    assert.equal((await mov({ tipo: "baja", cantidad: 1, motivo: "Se malogró" })).bien.cantidad, 5);
  });

  it("préstamos simultáneos nunca sacan más de lo disponible", async () => {
    const intentos = await Promise.all(
      Array.from({ length: 5 }, () =>
        api.req("POST", `/inventario/${bien._id}/movimientos`, { tipo: "prestamo", cantidad: 2, persona: persona._id }, t),
      ),
    );
    assert.equal(intentos.filter((r) => r.status === 201).length, 2);
    const final = await api.esperar(200, "GET", `/inventario/${bien._id}`, null, t);
    assert.equal(final.cantidad_prestada, 4);
    assert.equal(final.disponible, 1);
  });

  it("filtros, búsqueda sin tildes y resumen", async () => {
    await api.esperar(201, "POST", "/inventario", { nombre: "Silla plástica", categoria: cat._id, cantidad: 50, estado: "malo" }, t);
    const total = async (q) => (await api.esperar(200, "GET", `/inventario?${q}`, null, t)).meta.total;
    assert.equal(await total("buscar=micro"), 1);
    assert.equal(await total("buscar=MICR%C3%93("), 0); // regex escapada
    assert.equal(await total("prestados=true"), 1);
    assert.equal(await total("estado=malo"), 1);

    const r = await api.esperar(200, "GET", "/inventario/resumen", null, t);
    assert.equal(r.bienes, 2);
    assert.equal(r.unidades, 55);
    assert.equal(r.prestadas, 4);
    assert.equal(r.valor_total, 1250);
    assert.equal(r.en_mal_estado, 1);
    assert.equal(r.por_categoria[0].categoria, "Sonido");
  });

  it("integridad referencial", async () => {
    await api.esperar(409, "DELETE", `/inventario/${bien._id}`, null, t);
    await api.esperar(409, "DELETE", `/catalogo/categoria-inventario/${cat._id}`, null, t);
    await api.esperar(409, "DELETE", `/departamento/${datos.departamento._id}`, null, t);
    await api.esperar(409, "DELETE", `/miembro/${datos.miembro._id}`, null, t);
    await api.esperar(409, "DELETE", `/persona/${persona._id}`, null, t);
    await api.esperar(400, "POST", "/inventario", { nombre: "X", categoria: "507f1f77bcf86cd799439011" }, t);
    const vacio = await api.esperar(201, "POST", "/inventario", { nombre: "Atril", categoria: cat._id }, t);
    await api.esperar(204, "DELETE", `/inventario/${vacio._id}`, null, t);
  });
});
