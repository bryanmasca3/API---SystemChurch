import Boom from "@hapi/boom";
import BaseService from "./base.service.js";
import { ServicioModel } from "../models/servicio.model.js";
import { DepartamentoModel } from "../models/departamento.model.js";
import { SesionServicioModel } from "../models/sesionServicio.model.js";

class ServicioService extends BaseService {
  constructor() {
    super(ServicioModel, {
      nombre: "Servicio",
      orden: { description: 1 },
      populate: ["departament"],
      referencias: [{ campo: "departament", model: DepartamentoModel, nombre: "departamento" }],
      // Las asistencias cuelgan de las sesiones, así que basta con revisar las sesiones
      dependencias: [{ model: SesionServicioModel, campo: "service", nombre: "sesiones del servicio" }],
    });
  }

  /** Al cambiar solo una hora, se compara con la otra ya guardada. */
  async actualizar(id, data) {
    if ("begintime" in data || "endtime" in data) {
      const actual = await ServicioModel.findById(id).lean();
      if (!actual) throw this.noEncontrado();
      const begintime = "begintime" in data ? data.begintime : actual.begintime;
      const endtime = "endtime" in data ? data.endtime : actual.endtime;
      if (begintime && endtime && endtime <= begintime) {
        throw Boom.badRequest("La hora de fin debe ser posterior a la de inicio");
      }
    }
    return super.actualizar(id, data);
  }
}

export default ServicioService;
