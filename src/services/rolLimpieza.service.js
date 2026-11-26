import Boom from "@hapi/boom";
import BaseService from "./base.service.js";
import { RolLimpiezaModel } from "../models/rolLimpieza.model.js";
import { MiembroModel } from "../models/miembro.model.js";

const POPULATE_MIEMBRO = { path: "membermain", populate: { path: "person" } };

class RolLimpiezaService extends BaseService {
  constructor() {
    super(RolLimpiezaModel, {
      nombre: "Turno de limpieza",
      orden: { date: -1 },
      paginado: true,
      populate: [POPULATE_MIEMBRO],
      referencias: [{ campo: "membermain", model: MiembroModel, nombre: "miembro" }],
    });
  }

  /** Próximo turno de limpieza (el más cercano desde hoy). */
  async obtenerActual() {
    const turno = await RolLimpiezaModel.findOne({ date: { $gte: new Date() } })
      .sort({ date: 1 })
      .populate(POPULATE_MIEMBRO);
    if (!turno) throw Boom.notFound("No hay turnos de limpieza programados");
    return turno;
  }
}

export default RolLimpiezaService;
