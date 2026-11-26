import Boom from "@hapi/boom";
import { bitacoraCrear, bitacoraActualizar, bitacoraEliminar } from "./auditoria.js";

/**
 * Servicio CRUD genérico sobre un modelo de Mongoose.
 *
 * @param {import("mongoose").Model} model
 * @param {object}   opciones
 * @param {string}   opciones.nombre        Nombre legible para mensajes ("Miembro").
 * @param {Array}    opciones.populate      Rutas a poblar en las lecturas.
 * @param {object}   opciones.orden         Orden por defecto de listar().
 * @param {boolean}  opciones.paginado      true = listar() devuelve { data, meta } por páginas.
 * @param {Array<{campo, model, nombre}>} opciones.referencias
 *        Campos ObjectId cuya existencia se valida al crear/actualizar.
 * @param {Array<{model, campo, nombre}>} opciones.dependencias
 *        Colecciones que referencian a este modelo: si alguna lo usa, no se puede eliminar.
 * @param {boolean}  opciones.auditar       false = no registra en la bitácora (por defecto sí).
 */
export default class BaseService {
  constructor(
    model,
    {
      nombre,
      populate = [],
      orden = {},
      paginado = false,
      referencias = [],
      dependencias = [],
      auditar = true,
    } = {},
  ) {
    this.auditar = auditar;
    this.model = model;
    this.nombre = nombre || model.modelName;
    this.populate = populate;
    // _id al final: orden estable entre páginas aunque haya empates
    this.orden = { ...orden, _id: orden._id ?? 1 };
    this.paginado = paginado;
    this.referencias = referencias;
    this.dependencias = dependencias;
  }

  noEncontrado() {
    return Boom.notFound(`${this.nombre} no encontrado`);
  }

  /** Verifica que los ObjectId enviados apunten a documentos existentes. */
  async validarReferencias(data) {
    const faltantes = [];
    await Promise.all(
      this.referencias.map(async ({ campo, model, nombre }) => {
        const valor = data[campo];
        if (valor == null) return;
        if (!(await model.exists({ _id: valor }))) faltantes.push(nombre || campo);
      }),
    );
    if (faltantes.length) {
      throw Boom.badRequest(`No existe: ${faltantes.join(", ")}`);
    }
  }

  /** Impide eliminar un documento que otras colecciones siguen usando. */
  async validarSinDependencias(id) {
    for (const { model, campo, nombre } of this.dependencias) {
      if (await model.exists({ [campo]: id })) {
        throw Boom.conflict(`No se puede eliminar: está en uso por ${nombre}`);
      }
    }
  }

  /**
   * Traduce los filtros públicos (query ya validada) a un filtro de MongoDB.
   * Por defecto no se acepta ningún filtro; las subclases lo sobrescriben (puede ser async).
   */
  // eslint-disable-next-line no-unused-vars
  construirFiltro(filtros) {
    return {};
  }

  /**
   * Listado público (desde el controlador).
   * Si el servicio es paginado devuelve { data, meta: { total, pagina, limite, paginas } }.
   */
  async listar({ pagina = 1, limite = 20, ...filtros } = {}) {
    const filtro = await this.construirFiltro(filtros);
    if (!this.paginado) return this.buscar(filtro);

    const [data, total] = await Promise.all([
      this.model
        .find(filtro)
        .populate(this.populate)
        .sort(this.orden)
        .skip((pagina - 1) * limite)
        .limit(limite),
      this.model.countDocuments(filtro),
    ]);
    return { data, meta: { total, pagina, limite, paginas: Math.ceil(total / limite) } };
  }

  /** Búsqueda interna con un filtro de MongoDB ya construido. */
  async buscar(filtro = {}) {
    return this.model.find(filtro).populate(this.populate).sort(this.orden);
  }

  async obtener(id) {
    const doc = await this.model.findById(id).populate(this.populate);
    if (!doc) throw this.noEncontrado();
    return doc;
  }

  async crear(data) {
    await this.validarReferencias(data);
    const doc = await this.model.create(data);
    if (this.auditar) await bitacoraCrear(this.nombre, doc);
    return this.populate.length ? doc.populate(this.populate) : doc;
  }

  async actualizar(id, data) {
    await this.validarReferencias(data);
    const antes = await this.model.findById(id).lean();
    if (!antes) throw this.noEncontrado();
    const doc = await this.model
      .findByIdAndUpdate(id, data, { new: true, runValidators: true })
      .populate(this.populate);
    if (!doc) throw this.noEncontrado();
    if (this.auditar) await bitacoraActualizar(this.nombre, antes, doc);
    return doc;
  }

  async eliminar(id) {
    await this.validarSinDependencias(id);
    const doc = await this.model.findByIdAndDelete(id);
    if (!doc) throw this.noEncontrado();
    if (this.auditar) await bitacoraEliminar(this.nombre, doc);
    return doc;
  }
}
