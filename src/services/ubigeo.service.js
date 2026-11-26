import Boom from "@hapi/boom";
import {
  UbigeoDepartamentoModel,
  UbigeoProvinciaModel,
  UbigeoDistritoModel,
} from "../models/ubigeo.model.js";

const NIVELES = {
  departamento: UbigeoDepartamentoModel,
  provincia: UbigeoProvinciaModel,
  distrito: UbigeoDistritoModel,
};

/** Ubigeo de solo lectura (datos de referencia del INEI). */
class UbigeoService {
  modelo(nivel) {
    const model = NIVELES[nivel];
    if (!model) throw Boom.notFound(`Nivel de ubigeo desconocido: ${nivel}`);
    return model;
  }

  /** Lista un nivel; opcionalmente filtra por id_padre_ubigeo (provincias de un departamento, etc.). */
  async listar(nivel, { padre } = {}) {
    const filtro = padre ? { id_padre_ubigeo: padre } : {};
    return this.modelo(nivel).find(filtro).sort({ nombre_ubigeo: 1 }).lean();
  }

  async obtener(nivel, id) {
    const doc = await this.modelo(nivel).findById(id).lean();
    if (!doc) throw Boom.notFound("Ubigeo no encontrado");
    return doc;
  }
}

export default UbigeoService;
