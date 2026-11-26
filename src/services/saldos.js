/**
 * Cálculo de saldos. El saldo nunca se guarda: siempre se deriva de
 * saldo_inicial + ingresos − egresos − transferencias enviadas + transferencias recibidas
 * (sin movimientos anulados). Así no puede desincronizarse.
 */
import { MovimientoFinancieroModel } from "../models/movimientoFinanciero.model.js";
import { redondear } from "../libs/fechas.js";

const totalesVacios = () => ({
  ingresos: 0,
  egresos: 0,
  transferencias_entrada: 0,
  transferencias_salida: 0,
});

/**
 * Totales por fondo para los movimientos que cumplen `filtro` (p. ej. { periodo: "2024-03" }).
 * @returns {Map<string, ReturnType<typeof totalesVacios>>}
 */
export async function totalesPorFondo(filtro = {}) {
  const base = { ...filtro, anulado: false };
  const [porTipo, entradas] = await Promise.all([
    MovimientoFinancieroModel.aggregate([
      { $match: base },
      { $group: { _id: { fondo: "$fondo", tipo: "$tipo" }, total: { $sum: "$monto" } } },
    ]),
    MovimientoFinancieroModel.aggregate([
      { $match: { ...base, tipo: "transferencia" } },
      { $group: { _id: "$fondo_destino", total: { $sum: "$monto" } } },
    ]),
  ]);

  const mapa = new Map();
  const de = (id) => {
    const clave = String(id);
    if (!mapa.has(clave)) mapa.set(clave, totalesVacios());
    return mapa.get(clave);
  };
  const campo = { ingreso: "ingresos", egreso: "egresos", transferencia: "transferencias_salida" };
  for (const r of porTipo) de(r._id.fondo)[campo[r._id.tipo]] += r.total;
  for (const r of entradas) de(r._id).transferencias_entrada += r.total;
  for (const t of mapa.values()) for (const k of Object.keys(t)) t[k] = redondear(t[k]);
  return mapa;
}

export const totalesDe = (mapa, fondoId) => mapa.get(String(fondoId)) ?? totalesVacios();

export const aplicar = (saldoInicial, t) =>
  redondear(saldoInicial + t.ingresos - t.egresos - t.transferencias_salida + t.transferencias_entrada);

/** Saldo actual de un fondo (todos los movimientos no anulados). */
export async function saldoActual(fondo) {
  return aplicar(fondo.saldo_inicial, totalesDe(await totalesPorFondo(), fondo._id));
}
