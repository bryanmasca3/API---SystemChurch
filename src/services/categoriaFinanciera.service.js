import BaseService from "./base.service.js";
import { CategoriaFinancieraModel } from "../models/categoriaFinanciera.model.js";
import { MovimientoFinancieroModel } from "../models/movimientoFinanciero.model.js";

class CategoriaFinancieraService extends BaseService {
  constructor() {
    super(CategoriaFinancieraModel, {
      nombre: "Categoría financiera",
      orden: { tipo: 1, description: 1 },
      dependencias: [{ model: MovimientoFinancieroModel, campo: "categoria", nombre: "movimientos registrados" }],
    });
  }

  construirFiltro({ tipo } = {}) {
    return tipo ? { tipo } : {};
  }
}

export default CategoriaFinancieraService;
