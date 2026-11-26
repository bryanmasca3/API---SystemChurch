import Boom from "@hapi/boom";
import BaseService from "./base.service.js";
import { InscripcionModel } from "../models/inscripcion.model.js";
import { DepartamentoModel } from "../models/departamento.model.js";
import { PersonaModel } from "../models/persona.model.js";
import PersonaService from "./persona.service.js";
import { edadA } from "../libs/fechas.js";

const personaService = new PersonaService();

/** Personas inscritas en un ministerio (niños, adolescentes, jóvenes...), sean o no miembros. */
class InscripcionService extends BaseService {
  constructor() {
    super(InscripcionModel, {
      nombre: "Inscripción",
      orden: { fecha_inscripcion: -1 },
      populate: [
        { path: "persona", select: "name surname dob phone" },
        { path: "apoderado", select: "name surname phone" },
      ],
      referencias: [{ campo: "apoderado", model: PersonaModel, nombre: "apoderado" }],
    });
  }

  async validarDepartamento(id) {
    const dep = await DepartamentoModel.findById(id, { description: 1 }).lean();
    if (!dep) throw Boom.notFound("Departamento no encontrado");
    return dep;
  }

  /** Lista con la edad actual de cada inscrito (para agrupar niños por edad, por ejemplo). */
  async listarDe(departamentoId, { activo = true } = {}) {
    await this.validarDepartamento(departamentoId);
    const inscritos = await this.buscar({ departamento: departamentoId, ...(activo !== "todos" && { activo }) });
    return inscritos.map((i) => ({ ...i.toJSON(), edad: edadA(i.persona?.dob) }));
  }

  /** `persona` puede ser un id existente o los datos de una persona nueva (p. ej. un niño). */
  async inscribir(departamentoId, { persona, ...data }) {
    await this.validarDepartamento(departamentoId);
    let personaId = persona;
    let creada = null;
    if (persona && typeof persona === "object") {
      creada = await personaService.crear(persona);
      personaId = creada._id;
    } else if (!(await PersonaModel.exists({ _id: persona }))) {
      throw Boom.badRequest("No existe: persona");
    }
    if (data.apoderado && String(data.apoderado) === String(personaId)) {
      throw Boom.badRequest("La persona no puede ser su propio apoderado");
    }
    if (await InscripcionModel.exists({ departamento: departamentoId, persona: personaId, activo: true })) {
      throw Boom.conflict("La persona ya está inscrita en este ministerio");
    }
    try {
      return await this.crear({ ...data, departamento: departamentoId, persona: personaId });
    } catch (error) {
      if (creada) await PersonaModel.findByIdAndDelete(creada._id);
      throw error;
    }
  }

  async buscarDe(departamentoId, inscripcionId) {
    const existe = await InscripcionModel.exists({ _id: inscripcionId, departamento: departamentoId });
    if (!existe) throw Boom.notFound("Inscripción no encontrada en este ministerio");
  }

  /** Editar apoderado/observación, o retirar (activo: false con fecha_retiro). */
  async actualizarDe(departamentoId, inscripcionId, data) {
    await this.buscarDe(departamentoId, inscripcionId);
    if (data.activo === false && !data.fecha_retiro) data.fecha_retiro = new Date();
    if (data.activo === true) data.fecha_retiro = null;
    return this.actualizar(inscripcionId, data);
  }

  async eliminarDe(departamentoId, inscripcionId) {
    await this.buscarDe(departamentoId, inscripcionId);
    return this.eliminar(inscripcionId);
  }
}

export default InscripcionService;
