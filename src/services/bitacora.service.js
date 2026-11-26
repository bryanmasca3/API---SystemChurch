import BaseService from "./base.service.js";
import { BitacoraModel } from "../models/bitacora.model.js";
import { construirFiltroFechas } from "./filtros.js";

/** Consulta de la bitácora (solo lectura; se escribe desde services/auditoria.js). */
class BitacoraService extends BaseService {
  constructor() {
    super(BitacoraModel, {
      nombre: "Registro de bitácora",
      orden: { fecha: -1 },
      paginado: true,
      populate: [{ path: "usuario", select: "nombre correo rol" }],
      auditar: false,
    });
  }

  construirFiltro({ usuario, accion, recurso, documento, desde, hasta } = {}) {
    return {
      ...(usuario && { usuario }),
      ...(accion && { accion }),
      ...(recurso && { recurso }),
      ...(documento && { documento }),
      ...construirFiltroFechas(desde, hasta, "fecha"),
    };
  }
}

export default BitacoraService;
