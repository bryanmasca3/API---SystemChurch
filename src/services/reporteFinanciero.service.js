import Boom from "@hapi/boom";
import { MovimientoFinancieroModel } from "../models/movimientoFinanciero.model.js";
import { CategoriaFinancieraModel } from "../models/categoriaFinanciera.model.js";
import { CierreMensualModel } from "../models/cierreMensual.model.js";
import { MiembroModel } from "../models/miembro.model.js";
import { PersonaModel } from "../models/persona.model.js";
import { redondear } from "../libs/fechas.js";
import { saldosDelPeriodo } from "./cierre.service.js";
import { filtroFondosVisibles, idsFondosVisibles } from "./fondo.service.js";

const sumar = (lista, campo = "total") => redondear(lista.reduce((s, x) => s + x[campo], 0));
const NOMBRES_CLASE = { diezmo: "Diezmos", ofrenda: "Ofrendas" };

class ReporteFinancieroService {
  /** Filtro de movimientos no anulados restringido a los fondos visibles. */
  async base(alcance, extra = {}) {
    const visibles = await idsFondosVisibles(alcance);
    return { anulado: false, ...extra, ...(visibles && { fondo: { $in: visibles } }) };
  }

  /** Informe mensual para el consistorio: saldos por fondo e ingresos/egresos por concepto. */
  async mensual(periodo, alcance = null) {
    const filtro = await this.base(alcance, { periodo });
    const [saldos, ingresos, egresos, cierre] = await Promise.all([
      saldosDelPeriodo(periodo, filtroFondosVisibles(alcance)),
      MovimientoFinancieroModel.aggregate([
        { $match: { ...filtro, tipo: "ingreso" } },
        { $group: { _id: { clase: "$clase", categoria: "$categoria" }, total: { $sum: "$monto" }, cantidad: { $sum: 1 } } },
        {
          $lookup: {
            from: CategoriaFinancieraModel.collection.name,
            localField: "_id.categoria",
            foreignField: "_id",
            as: "cat",
          },
        },
      ]),
      MovimientoFinancieroModel.aggregate([
        { $match: { ...filtro, tipo: "egreso" } },
        { $group: { _id: "$categoria", total: { $sum: "$monto" }, cantidad: { $sum: 1 } } },
        { $lookup: { from: CategoriaFinancieraModel.collection.name, localField: "_id", foreignField: "_id", as: "cat" } },
      ]),
      CierreMensualModel.findOne({ periodo }, { fecha_cierre: 1, cerrado_por: 1, observacion: 1 })
        .populate("cerrado_por", "nombre")
        .lean(),
    ]);

    const concepto = (r) => ({
      concepto: NOMBRES_CLASE[r._id.clase] ?? r.cat[0]?.description ?? "Sin categoría",
      total: redondear(r.total),
      cantidad: r.cantidad,
    });
    const detalleIngresos = ingresos.map(concepto).sort((a, b) => b.total - a.total);
    const detalleEgresos = egresos
      .map((r) => ({ concepto: r.cat[0]?.description ?? "Sin categoría", total: redondear(r.total), cantidad: r.cantidad }))
      .sort((a, b) => b.total - a.total);
    const totalIngresos = sumar(detalleIngresos);
    const totalEgresos = sumar(detalleEgresos);

    return {
      periodo,
      cerrado: Boolean(cierre),
      cierre,
      fondos: saldos,
      ingresos: { total: totalIngresos, detalle: detalleIngresos },
      egresos: { total: totalEgresos, detalle: detalleEgresos },
      resultado: redondear(totalIngresos - totalEgresos),
      saldo_inicial: sumar(saldos, "saldo_inicial"),
      saldo_final: sumar(saldos, "saldo_final"),
    };
  }

  /** Ingresos y egresos de cada mes del año (para gráficos). */
  async anual(anio, alcance = null) {
    const filtro = await this.base(alcance, { periodo: { $regex: `^${anio}-` }, tipo: { $in: ["ingreso", "egreso"] } });
    const filas = await MovimientoFinancieroModel.aggregate([
      { $match: filtro },
      { $group: { _id: { periodo: "$periodo", tipo: "$tipo", clase: "$clase" }, total: { $sum: "$monto" } } },
    ]);
    const meses = Array.from({ length: 12 }, (_, i) => ({
      periodo: `${anio}-${String(i + 1).padStart(2, "0")}`,
      ingresos: 0,
      diezmos: 0,
      ofrendas: 0,
      otros_ingresos: 0,
      egresos: 0,
    }));
    for (const f of filas) {
      const mes = meses[Number(f._id.periodo.slice(5)) - 1];
      if (f._id.tipo === "egreso") mes.egresos += f.total;
      else {
        mes.ingresos += f.total;
        mes[{ diezmo: "diezmos", ofrenda: "ofrendas" }[f._id.clase] ?? "otros_ingresos"] += f.total;
      }
    }
    for (const m of meses) {
      for (const k of ["ingresos", "diezmos", "ofrendas", "otros_ingresos", "egresos"]) m[k] = redondear(m[k]);
      m.resultado = redondear(m.ingresos - m.egresos);
    }
    return {
      anio,
      meses,
      total_ingresos: sumar(meses, "ingresos"),
      total_egresos: sumar(meses, "egresos"),
      resultado: redondear(sumar(meses, "ingresos") - sumar(meses, "egresos")),
    };
  }

  /**
   * Diezmos del año. Con `miembro`: constancia con el detalle de sus diezmos.
   * Sin `miembro`: total por miembro (para emitir constancias en lote) y el total anónimo.
   */
  async diezmos(anio, miembroId) {
    const filtro = { anulado: false, tipo: "ingreso", clase: "diezmo", periodo: { $regex: `^${anio}-` } };

    if (miembroId) {
      const miembro = await MiembroModel.findById(miembroId).populate("person", "name surname doi").lean();
      if (!miembro) throw Boom.notFound("Miembro no encontrado");
      const diezmos = await MovimientoFinancieroModel.find(
        { ...filtro, miembro: miembroId },
        { fecha: 1, monto: 1, medio_pago: 1, fondo: 1 },
      )
        .sort({ fecha: 1 })
        .populate("fondo", "nombre")
        .lean();
      return {
        anio,
        miembro: { _id: miembro._id, nombre: `${miembro.person.name} ${miembro.person.surname}`, doi: miembro.person.doi ?? null },
        diezmos,
        cantidad: diezmos.length,
        total: sumar(diezmos, "monto"),
      };
    }

    const filas = await MovimientoFinancieroModel.aggregate([
      { $match: filtro },
      { $group: { _id: "$miembro", total: { $sum: "$monto" }, cantidad: { $sum: 1 } } },
      { $lookup: { from: MiembroModel.collection.name, localField: "_id", foreignField: "_id", as: "m" } },
      { $lookup: { from: PersonaModel.collection.name, localField: "m.person", foreignField: "_id", as: "p" } },
    ]);
    const anonimo = filas.find((f) => f._id === null);
    const porMiembro = filas
      .filter((f) => f._id !== null)
      .map((f) => ({
        miembro: f._id,
        nombre: f.p[0] ? `${f.p[0].name} ${f.p[0].surname}` : "(miembro eliminado)",
        doi: f.p[0]?.doi ?? null,
        total: redondear(f.total),
        cantidad: f.cantidad,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return {
      anio,
      por_miembro: porMiembro,
      anonimos: { total: redondear(anonimo?.total ?? 0), cantidad: anonimo?.cantidad ?? 0 },
      total: redondear(sumar(porMiembro) + (anonimo?.total ?? 0)),
    };
  }
}

export default ReporteFinancieroService;
