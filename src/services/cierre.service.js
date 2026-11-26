import Boom from "@hapi/boom";
import { CierreMensualModel } from "../models/cierreMensual.model.js";
import { MovimientoFinancieroModel } from "../models/movimientoFinanciero.model.js";
import { FondoModel } from "../models/fondo.model.js";
import { periodoActual, periodoDe } from "../libs/fechas.js";
import { totalesPorFondo, totalesDe, aplicar } from "./saldos.js";
import { bitacoraCrear, registrarEnBitacora } from "./auditoria.js";

/**
 * Saldos de cada fondo en un periodo: inicial (todo lo anterior), movimientos del mes y final.
 * Solo incluye fondos que ya existían en ese periodo.
 */
export async function saldosDelPeriodo(periodo, filtroFondos = {}) {
  const [fondos, previos, delMes] = await Promise.all([
    FondoModel.find(filtroFondos).sort({ nombre: 1 }).lean(),
    totalesPorFondo({ periodo: { $lt: periodo } }),
    totalesPorFondo({ periodo }),
  ]);
  return fondos
    .filter((f) => periodoDe(f.fecha_inicio) <= periodo)
    .map((f) => {
      const saldoInicial = aplicar(f.saldo_inicial, totalesDe(previos, f._id));
      const t = totalesDe(delMes, f._id);
      return { fondo: f._id, nombre: f.nombre, saldo_inicial: saldoInicial, ...t, saldo_final: aplicar(saldoInicial, t) };
    });
}

class CierreService {
  async listar() {
    return CierreMensualModel.find().sort({ periodo: -1 }).populate("cerrado_por", "nombre");
  }

  async obtener(periodo) {
    const cierre = await CierreMensualModel.findOne({ periodo }).populate("cerrado_por", "nombre");
    if (!cierre) throw Boom.notFound(`El mes ${periodo} no está cerrado`);
    return cierre;
  }

  /** Cierra un mes: los anteriores con movimientos deben estar cerrados. */
  async cerrar(periodo, observacion, usuarioId) {
    if (periodo > periodoActual()) throw Boom.badRequest("No se puede cerrar un mes futuro");
    if (await CierreMensualModel.exists({ periodo })) throw Boom.conflict(`El mes ${periodo} ya está cerrado`);

    const [conMovimientos, cerrados] = await Promise.all([
      MovimientoFinancieroModel.distinct("periodo", { periodo: { $lt: periodo } }),
      CierreMensualModel.distinct("periodo"),
    ]);
    const pendientes = conMovimientos.filter((p) => !cerrados.includes(p)).sort();
    if (pendientes.length) {
      throw Boom.conflict(`Primero cierra los meses anteriores con movimientos: ${pendientes.join(", ")}`);
    }

    const cierre = await CierreMensualModel.create({
      periodo,
      observacion,
      cerrado_por: usuarioId,
      saldos: await saldosDelPeriodo(periodo),
    });
    await bitacoraCrear("Cierre mensual", cierre);
    return this.obtener(periodo);
  }

  /** Reabre el último mes cerrado (solo administradores). */
  async reabrir(periodo, motivo) {
    const cierre = await CierreMensualModel.findOne({ periodo });
    if (!cierre) throw Boom.notFound(`El mes ${periodo} no está cerrado`);
    const posterior = await CierreMensualModel.findOne({ periodo: { $gt: periodo } }).sort({ periodo: -1 }).lean();
    if (posterior) throw Boom.conflict(`Primero reabre ${posterior.periodo}: solo se puede reabrir el último mes cerrado`);

    await cierre.deleteOne();
    await registrarEnBitacora({
      accion: "eliminar",
      recurso: "Cierre mensual",
      documento: cierre._id,
      resumen: `Reabierto ${periodo}: ${motivo}`,
      cambios: { antes: cierre.toObject() },
    });
    return { periodo, reabierto: true };
  }
}

export default CierreService;
