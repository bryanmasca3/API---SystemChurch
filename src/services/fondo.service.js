import Boom from "@hapi/boom";
import BaseService from "./base.service.js";
import { FondoModel } from "../models/fondo.model.js";
import { DepartamentoModel } from "../models/departamento.model.js";
import { MovimientoFinancieroModel } from "../models/movimientoFinanciero.model.js";
import { CierreMensualModel } from "../models/cierreMensual.model.js";
import { totalesPorFondo, totalesDe, aplicar } from "./saldos.js";

/** Filtro de fondos visibles según el alcance (null = todos; líder = los de su departamento). */
export const filtroFondosVisibles = (alcance) =>
  alcance ? { departamento: { $in: alcance.departamentos } } : {};

export const idsFondosVisibles = async (alcance) =>
  alcance ? (await FondoModel.find(filtroFondosVisibles(alcance), { _id: 1 }).lean()).map((f) => f._id) : null;

class FondoService extends BaseService {
  constructor() {
    super(FondoModel, {
      nombre: "Fondo",
      orden: { nombre: 1 },
      populate: [{ path: "departamento", select: "description" }],
      referencias: [{ campo: "departamento", model: DepartamentoModel, nombre: "departamento" }],
      dependencias: [
        { model: MovimientoFinancieroModel, campo: "fondo", nombre: "movimientos (desactívalo en su lugar)" },
        { model: MovimientoFinancieroModel, campo: "fondo_destino", nombre: "transferencias recibidas" },
        { model: CierreMensualModel, campo: "saldos.fondo", nombre: "meses cerrados" },
      ],
    });
  }

  /** Agrega saldo_actual y los totales históricos a cada fondo. */
  async conSaldo(fondos) {
    const totales = await totalesPorFondo();
    return fondos.map((f) => {
      const obj = f.toJSON();
      const t = totalesDe(totales, f._id);
      return { ...obj, ...t, saldo_actual: aplicar(f.saldo_inicial, t) };
    });
  }

  async listar({ activo, departamento } = {}, alcance = null) {
    const fondos = await this.buscar({
      ...(activo !== undefined && { activo }),
      ...(departamento && { departamento }),
      ...filtroFondosVisibles(alcance),
    });
    return this.conSaldo(fondos);
  }

  async obtener(id, alcance = null) {
    const fondo = await FondoModel.findOne({ _id: id, ...filtroFondosVisibles(alcance) }).populate(this.populate);
    if (!fondo) throw this.noEncontrado();
    return (await this.conSaldo([fondo]))[0];
  }

  /** El saldo inicial y la fecha de inicio quedan fijos cuando hay meses cerrados o movimientos previos. */
  async actualizar(id, data) {
    if ("saldo_inicial" in data || "fecha_inicio" in data) {
      if (await CierreMensualModel.exists({ "saldos.fondo": id })) {
        throw Boom.conflict("No se puede cambiar el saldo inicial ni la fecha de inicio: hay meses cerrados con este fondo");
      }
      if (data.fecha_inicio) {
        const anterior = await MovimientoFinancieroModel.exists({
          $or: [{ fondo: id }, { fondo_destino: id }],
          fecha: { $lt: data.fecha_inicio },
        });
        if (anterior) throw Boom.conflict("Hay movimientos anteriores a esa fecha de inicio");
      }
    }
    return super.actualizar(id, data);
  }
}

export default FondoService;
