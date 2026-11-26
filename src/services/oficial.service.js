import Boom from "@hapi/boom";
import BaseService from "./base.service.js";
import { OficialModel, OFICIOS_SERVICIO } from "../models/oficial.model.js";
import { MiembroModel } from "../models/miembro.model.js";

const POPULATE = [
  {
    path: "miembro",
    select: "person state",
    populate: [{ path: "person", select: "name surname phone" }, { path: "state", select: "description" }],
  },
];
const ORDEN_OFICIO = { pastor: 0, anciano: 1, diacono: 2, misionero: 3, predicador: 4, evangelista: 5, maestro: 6 };

class OficialService extends BaseService {
  constructor() {
    super(OficialModel, {
      nombre: "Oficial",
      orden: { estado: 1, oficio: 1, fecha_inicio: -1 },
      populate: POPULATE,
      referencias: [{ campo: "miembro", model: MiembroModel, nombre: "miembro" }],
    });
  }

  construirFiltro({ oficio, estado, condicion, consistorio, miembro } = {}) {
    return {
      ...(oficio && { oficio }),
      ...(estado && { estado }),
      ...(condicion && { condicion }),
      ...(consistorio !== undefined && { integra_consistorio: consistorio }),
      ...(miembro && { miembro }),
    };
  }

  /** Solo un miembro ACTIVO puede iniciar un periodo como oficial. */
  async validarMiembroActivo(miembroId) {
    const miembro = await MiembroModel.findById(miembroId).populate("state", "description").lean();
    if (!miembro) throw Boom.badRequest("No existe: miembro");
    if (miembro.state?.description?.toUpperCase() !== "ACTIVO") {
      throw Boom.conflict(`Solo un miembro activo puede ser oficial (estado actual: ${miembro.state?.description ?? "sin estado"})`);
    }
  }

  async crear(data) {
    await this.validarMiembroActivo(data.miembro);
    if (await OficialModel.exists({ miembro: data.miembro, oficio: data.oficio, estado: "activo" })) {
      throw Boom.conflict(`El miembro ya tiene un periodo activo como ${data.oficio}`);
    }
    return super.crear(data);
  }

  async actualizar(id, data) {
    const actual = await OficialModel.findById(id).lean();
    if (!actual) throw this.noEncontrado();
    const oficio = data.oficio ?? actual.oficio;
    const condicion = "condicion" in data ? data.condicion : actual.condicion;
    if (OFICIOS_SERVICIO.includes(oficio) && (data.integra_consistorio ?? actual.integra_consistorio)) {
      throw Boom.badRequest("Solo pastores, ancianos y diáconos integran el consistorio");
    }
    if (oficio === "anciano" && !condicion) throw Boom.badRequest("Un anciano debe ser ordenado o a prueba");
    if (oficio !== "anciano" && condicion) throw Boom.badRequest("La condición solo aplica a ancianos");
    const estado = data.estado ?? actual.estado;
    const fechaFin = "fecha_fin" in data ? data.fecha_fin : actual.fecha_fin;
    if (estado !== "activo" && !fechaFin) {
      throw Boom.badRequest("Indica la fecha_fin al terminar el periodo");
    }
    if (fechaFin && new Date(fechaFin) < new Date(data.fecha_inicio ?? actual.fecha_inicio)) {
      throw Boom.badRequest("La fecha_fin no puede ser anterior a la fecha_inicio");
    }
    // Pasar de "a prueba" a "ordenado" exige la fecha de ordenación
    if (condicion === "ordenado" && actual.condicion === "a_prueba" && !(data.fecha_ordenacion ?? actual.fecha_ordenacion)) {
      throw Boom.badRequest("Indica la fecha_ordenacion al ordenar al anciano");
    }
    return super.actualizar(id, data);
  }

  /** Composición actual del consistorio y la junta de oficiales en funciones. */
  async consistorio() {
    const activos = await this.buscar({ estado: "activo" });
    const orden = (a, b) =>
      ORDEN_OFICIO[a.oficio] - ORDEN_OFICIO[b.oficio] ||
      `${a.miembro?.person?.surname}`.localeCompare(`${b.miembro?.person?.surname}`, "es");
    const consistorio = activos.filter((o) => o.integra_consistorio).sort(orden);
    return {
      consistorio,
      ancianos: activos.filter((o) => o.oficio === "anciano").sort(orden),
      diaconos: activos.filter((o) => o.oficio === "diacono").sort(orden),
      pastores: activos.filter((o) => o.oficio === "pastor").sort(orden),
      // Misioneros, predicadores, evangelistas y maestros (cartilla: Educación Teológica / Evangelismo)
      servicio: activos.filter((o) => OFICIOS_SERVICIO.includes(o.oficio)).sort(orden),
    };
  }
}

export default OficialService;
