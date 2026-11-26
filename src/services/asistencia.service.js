import Boom from "@hapi/boom";
import BaseService from "./base.service.js";
import SesionServicioService from "./sesionServicio.service.js";
import { AsistenciaModel } from "../models/asistencia.model.js";
import { PersonaModel } from "../models/persona.model.js";
import { SesionServicioModel } from "../models/sesionServicio.model.js";
import { construirFiltroSesion } from "./filtros.js";

const sesionService = new SesionServicioService();

/** Asistencia de personas (miembros o no) a las sesiones de los servicios. */
class AsistenciaService extends BaseService {
  constructor() {
    super(AsistenciaModel, {
      nombre: "Asistencia",
      orden: { createdAt: -1 },
      paginado: true,
      populate: [{ path: "sesion", populate: { path: "service" } }, "person"],
      referencias: [
        { campo: "sesion", model: SesionServicioModel, nombre: "sesión" },
        { campo: "person", model: PersonaModel, nombre: "persona" },
      ],
    });
  }

  async construirFiltro({ persona, ...filtrosSesion } = {}) {
    return {
      ...(persona && { person: persona }),
      ...(await construirFiltroSesion(sesionService, filtrosSesion)),
    };
  }

  async crear(data) {
    if (await AsistenciaModel.exists({ sesion: data.sesion, person: data.person })) {
      throw Boom.conflict("La persona ya tiene asistencia registrada en esta sesión");
    }
    return super.crear(data);
  }
}

export default AsistenciaService;
