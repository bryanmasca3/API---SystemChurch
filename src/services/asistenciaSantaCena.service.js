import Boom from "@hapi/boom";
import BaseService from "./base.service.js";
import SesionServicioService from "./sesionServicio.service.js";
import { AsistenciaSantaCenaModel } from "../models/asistenciaSantaCena.model.js";
import { MiembroModel } from "../models/miembro.model.js";
import { SesionServicioModel } from "../models/sesionServicio.model.js";
import { construirFiltroSesion } from "./filtros.js";

const sesionService = new SesionServicioService();

/** Asistencia de miembros a la Santa Cena. */
class AsistenciaSantaCenaService extends BaseService {
  constructor() {
    super(AsistenciaSantaCenaModel, {
      nombre: "Asistencia a Santa Cena",
      orden: { createdAt: -1 },
      paginado: true,
      populate: [
        { path: "sesion", populate: { path: "service" } },
        { path: "miembro", populate: { path: "person" } },
      ],
      referencias: [
        { campo: "sesion", model: SesionServicioModel, nombre: "sesión" },
        { campo: "miembro", model: MiembroModel, nombre: "miembro" },
      ],
    });
  }

  async construirFiltro({ miembro, ...filtrosSesion } = {}) {
    return {
      ...(miembro && { miembro }),
      ...(await construirFiltroSesion(sesionService, filtrosSesion)),
    };
  }

  async crear(data) {
    if (await AsistenciaSantaCenaModel.exists({ sesion: data.sesion, miembro: data.miembro })) {
      throw Boom.conflict("El miembro ya tiene asistencia a Santa Cena registrada en esta sesión");
    }
    return super.crear(data);
  }
}

export default AsistenciaSantaCenaService;
