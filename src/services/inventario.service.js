import Boom from "@hapi/boom";
import mongoose from "mongoose";
import BaseService from "./base.service.js";
import { construirFiltroFechas, regexBusqueda } from "./filtros.js";
import { BienModel } from "../models/bien.model.js";
import { MovimientoInventarioModel } from "../models/movimientoInventario.model.js";
import { CategoriaInventarioModel } from "../models/catalogo.model.js";
import { DepartamentoModel } from "../models/departamento.model.js";
import { MiembroModel } from "../models/miembro.model.js";
import { PersonaModel } from "../models/persona.model.js";
import { bitacoraCrear, registrarEnBitacora } from "./auditoria.js";
import config from "../config/env.config.js";

const POPULATE_BIEN = [
  "categoria",
  "departamento",
  { path: "encargado", populate: { path: "person", select: "name surname phone" } },
];
const POPULATE_MOVIMIENTO = [
  { path: "bien", select: "codigo nombre" },
  { path: "persona", select: "name surname phone doi" },
  { path: "registrado_por", select: "nombre correo" },
];

// Unidades en la iglesia (no prestadas) >= n
const hayDisponibles = (n) => ({
  $expr: { $gte: [{ $subtract: ["$cantidad", "$cantidad_prestada"] }, n] },
});

/** Historial de movimientos (lectura paginada). */
class MovimientoService extends BaseService {
  constructor() {
    super(MovimientoInventarioModel, {
      nombre: "Movimiento",
      orden: { fecha: -1 },
      paginado: true,
      populate: POPULATE_MOVIMIENTO,
    });
  }

  construirFiltro({ bien, tipo, persona, desde, hasta } = {}) {
    return {
      ...(bien && { bien }),
      ...(tipo && { tipo }),
      ...(persona && { persona }),
      ...construirFiltroFechas(desde, hasta, "fecha"),
    };
  }
}

/** Préstamos, con su estado de devolución. */
class PrestamoService extends MovimientoService {
  construirFiltro({ estado = "pendiente", bien, persona } = {}) {
    const pendiente = { $expr: { $lt: ["$cantidad_devuelta", "$cantidad"] } };
    const porEstado = {
      pendiente,
      vencido: { ...pendiente, fecha_devolucion_prevista: { $lt: new Date() } },
      devuelto: { $expr: { $gte: ["$cantidad_devuelta", "$cantidad"] } },
      todos: {},
    }[estado];
    return { tipo: "prestamo", ...porEstado, ...(bien && { bien }), ...(persona && { persona }) };
  }
}

class InventarioService extends BaseService {
  constructor() {
    super(BienModel, {
      nombre: "Bien",
      orden: { nombre: 1 },
      paginado: true,
      populate: POPULATE_BIEN,
      referencias: [
        { campo: "categoria", model: CategoriaInventarioModel, nombre: "categoría" },
        { campo: "departamento", model: DepartamentoModel, nombre: "departamento" },
        { campo: "encargado", model: MiembroModel, nombre: "miembro encargado" },
      ],
      dependencias: [
        {
          model: MovimientoInventarioModel,
          campo: "bien",
          nombre: "su historial de movimientos (registra una baja en su lugar)",
        },
      ],
    });
    this.movimientos = new MovimientoService();
    this.prestamos = new PrestamoService();
  }

  construirFiltro({ buscar, categoria, departamento, estado, encargado, prestados } = {}) {
    const regex = buscar && regexBusqueda(buscar);
    return {
      ...(regex && { $or: [{ nombre: regex }, { codigo: regex }, { descripcion: regex }] }),
      ...(categoria && { categoria }),
      ...(departamento && { departamento }),
      ...(estado && { estado }),
      ...(encargado && { encargado }),
      ...(prestados === true && { cantidad_prestada: { $gt: 0 } }),
    };
  }

  /**
   * Registra un bien. La cantidad inicial queda como un movimiento de "entrada",
   * así el historial explica siempre de dónde salió cada unidad.
   */
  async crear({ cantidad = 0, ...data }, usuarioId) {
    await this.validarReferencias(data);
    const id = await mongoose.connection.transaction(async (session) => {
      const [bien] = await BienModel.create([{ ...data, cantidad }], { session });
      if (cantidad > 0) {
        await MovimientoInventarioModel.create(
          [
            {
              bien: bien._id,
              tipo: "entrada",
              cantidad,
              fecha: data.fecha_adquisicion || new Date(),
              motivo: "Registro inicial",
              registrado_por: usuarioId,
            },
          ],
          { session },
        );
      }
      return bien._id;
    });
    const creado = await this.obtener(id);
    await bitacoraCrear(this.nombre, creado);
    return creado;
  }

  /** Registra un movimiento y ajusta las cantidades del bien en una sola transacción. */
  async registrarMovimiento(idBien, data, usuarioId) {
    const { tipo, cantidad: n } = data;
    const bienActual = await BienModel.findById(idBien).lean();
    if (!bienActual) throw this.noEncontrado();
    if (data.persona && !(await PersonaModel.exists({ _id: data.persona }))) {
      throw Boom.badRequest("No existe: persona");
    }

    const idMovimiento = await mongoose.connection.transaction(async (session) => {
      const extra = {};

      if (tipo === "entrada") {
        await BienModel.updateOne({ _id: idBien }, { $inc: { cantidad: n } }, { session });
      }

      if (tipo === "baja" || tipo === "prestamo") {
        const campo = tipo === "baja" ? "cantidad" : "cantidad_prestada";
        const r = await BienModel.updateOne(
          { _id: idBien, ...hayDisponibles(n) },
          { $inc: { [campo]: tipo === "baja" ? -n : n } },
          { session },
        );
        if (!r.modifiedCount) {
          const disp = bienActual.cantidad - bienActual.cantidad_prestada;
          throw Boom.conflict(
            `Solo hay ${disp} unidad(es) disponible(s) de "${bienActual.nombre}"` +
              (bienActual.cantidad_prestada ? ` (${bienActual.cantidad_prestada} prestada(s))` : ""),
          );
        }
        if (tipo === "prestamo") extra.cantidad_devuelta = 0;
      }

      if (tipo === "devolucion") {
        const prestamo = await MovimientoInventarioModel.findOneAndUpdate(
          {
            _id: data.prestamo,
            bien: idBien,
            tipo: "prestamo",
            $expr: { $lte: [{ $add: ["$cantidad_devuelta", n] }, "$cantidad"] },
          },
          { $inc: { cantidad_devuelta: n } },
          { session, new: true },
        );
        if (!prestamo) {
          const original = await MovimientoInventarioModel.findOne(
            { _id: data.prestamo, bien: idBien, tipo: "prestamo" },
            null,
            { session },
          ).lean();
          if (!original) throw Boom.notFound("Ese préstamo no existe para este bien");
          const pendiente = original.cantidad - original.cantidad_devuelta;
          throw Boom.conflict(`Ese préstamo solo tiene ${pendiente} unidad(es) pendiente(s) de devolver`);
        }
        await BienModel.updateOne(
          { _id: idBien },
          { $inc: { cantidad_prestada: -n } },
          { session },
        );
        // Si no se indica, devuelve la misma persona que se lo llevó
        extra.persona = data.persona || prestamo.persona;
      }

      const [movimiento] = await MovimientoInventarioModel.create(
        [{ ...data, ...extra, bien: idBien, registrado_por: usuarioId }],
        { session },
      );
      return movimiento._id;
    });

    const [movimiento, bien] = await Promise.all([
      this.movimientos.obtener(idMovimiento),
      this.obtener(idBien),
    ]);
    await registrarEnBitacora({
      accion: "movimiento",
      recurso: this.nombre,
      documento: bien._id,
      resumen: `${tipo} de ${n} · ${bien.nombre}`,
      cambios: { movimiento: idMovimiento, cantidad: bien.cantidad, cantidad_prestada: bien.cantidad_prestada },
    });
    return { movimiento, bien };
  }

  async listarMovimientos(idBien, filtros) {
    if (!(await BienModel.exists({ _id: idBien }))) throw this.noEncontrado();
    return this.movimientos.listar({ ...filtros, bien: idBien });
  }

  /**
   * Inventario anual (cartilla: Diaconado): por cada bien, unidades al 1 de enero, entradas
   * y bajas del año, unidades al 31 de diciembre y préstamos pendientes al cierre.
   */
  async reporteAnual(anio) {
    const anioDe = { $year: { date: "$fecha", timezone: config.ZONA_HORARIA } };
    const suma = (cond) => ({ $sum: { $cond: [cond, "$cantidad", 0] } });
    const tipo = (t) => ({ $eq: ["$tipo", t] });
    const antes = { $lt: [anioDe, anio] };
    const durante = { $eq: [anioDe, anio] };

    const filas = await MovimientoInventarioModel.aggregate([
      { $match: { $expr: { $lte: [anioDe, anio] } } },
      {
        $group: {
          _id: "$bien",
          entradas_previas: suma({ $and: [antes, tipo("entrada")] }),
          bajas_previas: suma({ $and: [antes, tipo("baja")] }),
          entradas: suma({ $and: [durante, tipo("entrada")] }),
          bajas: suma({ $and: [durante, tipo("baja")] }),
          prestado: suma(tipo("prestamo")),
          devuelto: suma(tipo("devolucion")),
        },
      },
    ]);
    const bienes = await BienModel.find({ _id: { $in: filas.map((f) => f._id) } })
      .populate("categoria", "description")
      .populate("departamento", "description")
      .lean();
    const porId = new Map(bienes.map((b) => [String(b._id), b]));

    const detalle = filas
      .map((f) => {
        const b = porId.get(String(f._id));
        const inicio = f.entradas_previas - f.bajas_previas;
        return {
          bien: f._id,
          codigo: b?.codigo ?? null,
          nombre: b?.nombre ?? "(eliminado)",
          categoria: b?.categoria?.description ?? null,
          departamento: b?.departamento?.description ?? null,
          ubicacion: b?.ubicacion ?? null,
          estado_actual: b?.estado ?? null,
          cantidad_inicio: inicio,
          entradas: f.entradas,
          bajas: f.bajas,
          cantidad_cierre: inicio + f.entradas - f.bajas,
          prestadas_al_cierre: f.prestado - f.devuelto,
          valor_unitario: b?.valor ?? null,
        };
      })
      .filter((d) => d.cantidad_inicio || d.entradas || d.bajas || d.cantidad_cierre)
      .sort((a, b) => `${a.categoria} ${a.nombre}`.localeCompare(`${b.categoria} ${b.nombre}`, "es"));

    const total = (campo) => detalle.reduce((s, d) => s + d[campo], 0);
    return {
      anio,
      bienes: detalle.length,
      totales: {
        cantidad_inicio: total("cantidad_inicio"),
        entradas: total("entradas"),
        bajas: total("bajas"),
        cantidad_cierre: total("cantidad_cierre"),
        prestadas_al_cierre: total("prestadas_al_cierre"),
        valor_cierre: Math.round(detalle.reduce((s, d) => s + (d.valor_unitario ?? 0) * d.cantidad_cierre, 0) * 100) / 100,
      },
      detalle,
    };
  }

  /** Totales para un tablero: bienes, unidades, prestados, vencidos y por categoría. */
  async resumen() {
    const [totales, porCategoria, vencidos] = await Promise.all([
      BienModel.aggregate([
        {
          $group: {
            _id: null,
            bienes: { $sum: 1 },
            unidades: { $sum: "$cantidad" },
            prestadas: { $sum: "$cantidad_prestada" },
            valor_total: { $sum: { $multiply: [{ $ifNull: ["$valor", 0] }, "$cantidad"] } },
            en_mal_estado: { $sum: { $cond: [{ $in: ["$estado", ["malo", "inservible"]] }, 1, 0] } },
          },
        },
      ]),
      BienModel.aggregate([
        { $group: { _id: "$categoria", bienes: { $sum: 1 }, unidades: { $sum: "$cantidad" } } },
        {
          $lookup: {
            from: CategoriaInventarioModel.collection.name,
            localField: "_id",
            foreignField: "_id",
            as: "categoria",
          },
        },
        {
          $project: {
            _id: 0,
            categoria: { $ifNull: [{ $first: "$categoria.description" }, "Sin categoría"] },
            bienes: 1,
            unidades: 1,
          },
        },
        { $sort: { categoria: 1 } },
      ]),
      MovimientoInventarioModel.countDocuments(this.prestamos.construirFiltro({ estado: "vencido" })),
    ]);
    const t = totales[0] || { bienes: 0, unidades: 0, prestadas: 0, valor_total: 0, en_mal_estado: 0 };
    delete t._id;
    return { ...t, prestamos_vencidos: vencidos, por_categoria: porCategoria };
  }
}

export default InventarioService;
