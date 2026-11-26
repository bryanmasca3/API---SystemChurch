import Boom from "@hapi/boom";
import BaseService from "./base.service.js";
import { ReunionModel } from "../models/reunion.model.js";
import { ReunionMiembroModel } from "../models/reunionMiembro.model.js";
import { TipoReunionModel } from "../models/catalogo.model.js";
import { DepartamentoModel } from "../models/departamento.model.js";
import { MiembroModel } from "../models/miembro.model.js";
import { construirFiltroFechas } from "./filtros.js";

class ReunionService extends BaseService {
  constructor() {
    super(ReunionModel, {
      nombre: "Reunión",
      orden: { date: -1 },
      paginado: true,
      populate: ["typemeeting", "departament"],
      referencias: [
        { campo: "typemeeting", model: TipoReunionModel, nombre: "tipo de reunión" },
        { campo: "departament", model: DepartamentoModel, nombre: "departamento" },
      ],
      dependencias: [{ model: ReunionMiembroModel, campo: "meeting", nombre: "sus asistentes" }],
    });
    this.asistentes = new BaseService(ReunionMiembroModel, {
      nombre: "Asistente",
      populate: [{ path: "member", populate: { path: "person" } }],
      referencias: [{ campo: "member", model: MiembroModel, nombre: "miembro" }],
    });
  }

  construirFiltro({ departamento, desde, hasta } = {}) {
    return {
      ...(departamento && { departament: departamento }),
      ...construirFiltroFechas(desde, hasta),
    };
  }

  async listarAsistentes(idReunion) {
    await this.obtener(idReunion);
    return this.asistentes.buscar({ meeting: idReunion });
  }

  async agregarAsistente(idReunion, { member, observacion }) {
    await this.obtener(idReunion);
    if (await ReunionMiembroModel.exists({ meeting: idReunion, member })) {
      throw Boom.conflict("El miembro ya está registrado en esta reunión");
    }
    return this.asistentes.crear({ meeting: idReunion, member, observacion });
  }

  async quitarAsistente(idReunion, idAsistente) {
    const existe = await ReunionMiembroModel.exists({ _id: idAsistente, meeting: idReunion });
    if (!existe) throw Boom.notFound("Asistente no encontrado en esta reunión");
    return this.asistentes.eliminar(idAsistente);
  }
}

export default ReunionService;
