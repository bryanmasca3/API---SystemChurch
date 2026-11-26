import Boom from "@hapi/boom";
import BaseService from "./base.service.js";
import { FamiliaModel } from "../models/familia.model.js";
import { PersonaModel } from "../models/persona.model.js";
import { regexBusqueda } from "./filtros.js";
import { VisitaModel } from "../models/pastoral.model.js";

const nombreDe = (p) => (p ? `${p.name} ${p.surname}` : "la persona");

class FamiliaService extends BaseService {
  constructor() {
    super(FamiliaModel, {
      nombre: "Familia",
      orden: { nombre: 1 },
      paginado: true,
      populate: [{ path: "integrantes.persona", select: "name surname phone dob" }],
      dependencias: [{ model: VisitaModel, campo: "familia", nombre: "visitas pastorales" }],
    });
  }

  construirFiltro({ buscar, persona } = {}) {
    return {
      ...(buscar && { nombre: regexBusqueda(buscar) }),
      ...(persona && { "integrantes.persona": persona }),
    };
  }

  /** Personas existentes, sin repetir, con un solo "cabeza" y que no estén en otra familia. */
  async validarIntegrantes(integrantes, familiaId = null) {
    const ids = integrantes.map((i) => String(i.persona));
    if (new Set(ids).size !== ids.length) throw Boom.badRequest("Una persona aparece dos veces en la familia");
    if (integrantes.filter((i) => i.parentesco === "cabeza").length > 1) {
      throw Boom.badRequest("Una familia solo puede tener una cabeza de familia");
    }
    const personas = await PersonaModel.find({ _id: { $in: ids } }, { name: 1, surname: 1 }).lean();
    if (personas.length !== ids.length) throw Boom.badRequest("No existe: alguna de las personas");

    const otra = await FamiliaModel.findOne({
      "integrantes.persona": { $in: ids },
      ...(familiaId && { _id: { $ne: familiaId } }),
    }).lean();
    if (otra) {
      const repetida = otra.integrantes.find((i) => ids.includes(String(i.persona)));
      const persona = personas.find((p) => String(p._id) === String(repetida.persona));
      throw Boom.conflict(`${nombreDe(persona)} ya pertenece a la familia "${otra.nombre}"`);
    }
  }

  async crear(data) {
    await this.validarIntegrantes(data.integrantes ?? []);
    return super.crear(data);
  }

  async actualizar(id, data) {
    if (data.integrantes) await this.validarIntegrantes(data.integrantes, id);
    return super.actualizar(id, data);
  }

  async agregarIntegrante(id, integrante) {
    const familia = await FamiliaModel.findById(id).lean();
    if (!familia) throw this.noEncontrado();
    return this.actualizar(id, { integrantes: [...familia.integrantes, integrante] });
  }

  async cambiarParentesco(id, personaId, parentesco) {
    const familia = await FamiliaModel.findById(id).lean();
    if (!familia) throw this.noEncontrado();
    if (!familia.integrantes.some((i) => String(i.persona) === String(personaId))) {
      throw Boom.notFound("La persona no pertenece a esta familia");
    }
    const integrantes = familia.integrantes.map((i) =>
      String(i.persona) === String(personaId) ? { ...i, parentesco } : i,
    );
    return this.actualizar(id, { integrantes });
  }

  async quitarIntegrante(id, personaId) {
    const familia = await FamiliaModel.findById(id).lean();
    if (!familia) throw this.noEncontrado();
    const integrantes = familia.integrantes.filter((i) => String(i.persona) !== String(personaId));
    if (integrantes.length === familia.integrantes.length) {
      throw Boom.notFound("La persona no pertenece a esta familia");
    }
    return this.actualizar(id, { integrantes });
  }
}

export default FamiliaService;
