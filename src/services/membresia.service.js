import Boom from "@hapi/boom";
import mongoose from "mongoose";
import BaseService from "./base.service.js";
import { EventoMembresiaModel, ESTADO_POR_EVENTO, SOLO_SISTEMA } from "../models/eventoMembresia.model.js";
import { MiembroModel } from "../models/miembro.model.js";
import { EstadoModel } from "../models/catalogo.model.js";
import { construirFiltroFechas } from "./filtros.js";
import { registrarEnBitacora } from "./auditoria.js";
import { ServicioModel } from "../models/servicio.model.js";
import { SesionServicioModel } from "../models/sesionServicio.model.js";
import { AsistenciaModel } from "../models/asistencia.model.js";
import { edadA, diaDe, periodoDe, periodoActual, periodoAnterior } from "../libs/fechas.js";

const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Estado del catálogo por descripción (sin distinguir mayúsculas); lo crea si no existe. */
export async function estadoPorNombre(nombre, session) {
  const existente = await EstadoModel.findOne({ description: new RegExp(`^${escapar(nombre)}$`, "i") }, null, { session });
  if (existente) return existente;
  const [creado] = await EstadoModel.create([{ description: nombre }], { session });
  return creado;
}

/** Último evento del miembro (por fecha y, a igual fecha, por orden de registro). */
export const ultimoEvento = (miembroId, session) =>
  EventoMembresiaModel.findOne({ miembro: miembroId }, null, { session }).sort({ fecha: -1, createdAt: -1 });

/**
 * Registra un evento y actualiza el estado del miembro. Usar dentro de una transacción.
 * @param {object} datos  { miembro, tipo, fecha, acta_consistorio, iglesia, observacion, acta }
 * @param {object} [opciones]
 *   - session, usuarioId
 *   - estadoForzado: id de estado a aplicar en lugar del que indica el tipo (p. ej. al restaurar).
 *   - esNuevo: el miembro se acaba de crear (no tenía estado anterior).
 *   - permitirHistorico: si hay eventos posteriores, se guarda como dato histórico SIN cambiar
 *     el estado actual (p. ej. el acta de un bautismo de hace años). Si es false, se rechaza.
 */
export async function registrarEvento(
  datos,
  { session, usuarioId, estadoForzado, esNuevo = false, permitirHistorico = false } = {},
) {
  const miembro = await MiembroModel.findById(datos.miembro, null, { session });
  if (!miembro) throw Boom.badRequest("No existe: miembro");

  const ultimo = await ultimoEvento(miembro._id, session);
  if (ultimo && new Date(datos.fecha) < ultimo.fecha) {
    if (!permitirHistorico) {
      throw Boom.conflict(
        `Hay un evento posterior (${ultimo.tipo}, ${ultimo.fecha.toISOString().slice(0, 10)}): ` +
          "el historial debe registrarse en orden",
      );
    }
    const [historico] = await EventoMembresiaModel.create(
      [{ ...datos, estado_anterior: miembro.state, estado_nuevo: miembro.state, registrado_por: usuarioId }],
      { session },
    );
    return historico;
  }

  const nombreEstado = ESTADO_POR_EVENTO[datos.tipo];
  const estadoNuevo = estadoForzado ?? (nombreEstado ? (await estadoPorNombre(nombreEstado, session))._id : miembro.state);

  const [evento] = await EventoMembresiaModel.create(
    [
      {
        ...datos,
        estado_anterior: esNuevo ? null : miembro.state,
        estado_nuevo: estadoNuevo,
        registrado_por: usuarioId,
      },
    ],
    { session },
  );
  if (String(estadoNuevo) !== String(miembro.state)) {
    miembro.state = estadoNuevo;
    await miembro.save({ session });
  }
  return evento;
}

class MembresiaService extends BaseService {
  constructor() {
    super(EventoMembresiaModel, {
      nombre: "Evento de membresía",
      orden: { fecha: -1, createdAt: -1 },
      paginado: true,
      populate: [
        { path: "miembro", select: "person", populate: { path: "person", select: "name surname" } },
        { path: "estado_anterior", select: "description" },
        { path: "estado_nuevo", select: "description" },
        { path: "registrado_por", select: "nombre" },
      ],
      auditar: false,
    });
  }

  construirFiltro({ miembro, tipo, desde, hasta } = {}) {
    return {
      ...(miembro && { miembro }),
      ...(tipo && { tipo }),
      ...construirFiltroFechas(desde, hasta, "fecha"),
    };
  }

  async historial(miembroId) {
    if (!(await MiembroModel.exists({ _id: miembroId }))) throw Boom.notFound("Miembro no encontrado");
    return this.buscar({ miembro: miembroId });
  }

  /** Evento registrado a mano (traslados, reafirmación, baja, fallecimiento). */
  async registrar(miembroId, data, usuarioId) {
    const id = await mongoose.connection.transaction(async (session) => {
      const evento = await registrarEvento({ ...data, miembro: miembroId }, { session, usuarioId });
      return evento._id;
    });
    const evento = await this.obtener(id);
    await registrarEnBitacora({
      accion: "crear",
      recurso: this.nombre,
      documento: miembroId,
      resumen: `${data.tipo} (${evento.estado_anterior?.description ?? "-"} → ${evento.estado_nuevo?.description ?? "-"})`,
    });
    return evento;
  }

  /** Deshace el último evento manual y devuelve al miembro a su estado anterior. */
  async deshacerUltimo(miembroId, eventoId) {
    await mongoose.connection.transaction(async (session) => {
      const ultimo = await ultimoEvento(miembroId, session);
      if (!ultimo || String(ultimo._id) !== String(eventoId)) {
        throw Boom.conflict("Solo se puede deshacer el último evento del historial");
      }
      if (SOLO_SISTEMA.includes(ultimo.tipo)) {
        throw Boom.conflict("Este evento lo generó un acta o el sistema: anula el acta correspondiente");
      }
      await MiembroModel.updateOne({ _id: miembroId }, { state: ultimo.estado_anterior }, { session });
      await ultimo.deleteOne({ session });
      await registrarEnBitacora({
        accion: "eliminar",
        recurso: this.nombre,
        documento: miembroId,
        resumen: `Deshecho: ${ultimo.tipo} del ${ultimo.fecha.toISOString().slice(0, 10)}`,
        cambios: { antes: ultimo.toObject() },
      });
    });
  }

  /**
   * Padrón de miembros: lista numerada por apellido con los datos que pide la cartilla
   * (DNI, edad, contacto, cómo y cuándo ingresó, bautismo, estado).
   */
  async padron({ estado } = {}) {
    const [miembros, ingresos] = await Promise.all([
      MiembroModel.find(estado ? { state: estado } : {})
        .populate("person", "name surname doi dob phone address")
        .populate("state", "description")
        .populate("typemembership", "description")
        .lean(),
      // Primer evento de ingreso de cada miembro (o su registro en el sistema)
      EventoMembresiaModel.aggregate([
        { $match: { tipo: { $in: ["admision_bautismo", "traslado_recibido", "reafirmacion_fe", "registro"] } } },
        { $sort: { fecha: 1 } },
        {
          $group: {
            _id: "$miembro",
            ingresos: { $push: { tipo: "$tipo", fecha: "$fecha", iglesia: "$iglesia" } },
          },
        },
      ]),
    ]);
    const ingresoDe = new Map(
      ingresos.map((i) => [String(i._id), i.ingresos.find((x) => x.tipo !== "registro") ?? i.ingresos[0]]),
    );
    const FORMA = {
      admision_bautismo: "Bautismo",
      traslado_recibido: "Carta de traslado",
      reafirmacion_fe: "Reafirmación de fe",
      registro: "Registro en el sistema",
    };

    const filas = miembros
      .map((m) => {
        const ingreso = ingresoDe.get(String(m._id));
        return {
          miembro: m._id,
          apellidos: m.person?.surname ?? "",
          nombres: m.person?.name ?? "",
          doi: m.person?.doi ?? null,
          fecha_nacimiento: m.person?.dob ?? null,
          edad: edadA(m.person?.dob),
          telefono: m.person?.phone ?? null,
          direccion: m.person?.address ?? null,
          estado: m.state?.description ?? null,
          tipo_membresia: m.typemembership?.description ?? null,
          forma_ingreso: ingreso ? FORMA[ingreso.tipo] : null,
          fecha_ingreso: ingreso?.fecha ?? null,
          iglesia_procedencia: ingreso?.iglesia ?? null,
          fecha_bautismo: m.datebaptism ?? null,
          lugar_bautismo: m.placebaptism ?? null,
        };
      })
      .sort((a, b) => `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`, "es"))
      .map((f, i) => ({ numero: i + 1, ...f }));

    const porEstado = {};
    for (const f of filas) porEstado[f.estado ?? "Sin estado"] = (porEstado[f.estado ?? "Sin estado"] ?? 0) + 1;
    return { fecha: new Date(), total: filas.length, por_estado: porEstado, miembros: filas };
  }

  /**
   * Monitoreo de crecimiento/decrecimiento mes a mes: miembros activos al cierre de cada mes
   * (reconstruido desde el historial), altas, bajas y asistencia promedio a cultos dominicales.
   */
  async crecimiento({ desde, hasta } = {}) {
    const fin = hasta ?? periodoActual();
    let inicio = desde;
    if (!inicio) {
      inicio = fin;
      for (let i = 0; i < 11; i++) inicio = periodoAnterior(inicio);
    }
    if (inicio > fin) throw Boom.badRequest("`desde` debe ser anterior o igual a `hasta`");
    const periodos = [];
    for (let p = fin; p >= inicio; p = periodoAnterior(p)) periodos.unshift(p);
    if (periodos.length > 60) throw Boom.badRequest("Máximo 60 meses por consulta");

    const activo = await estadoPorNombre("ACTIVO");
    const [eventos, serviciosDomingo] = await Promise.all([
      EventoMembresiaModel.find({}, { miembro: 1, tipo: 1, fecha: 1, estado_nuevo: 1, createdAt: 1 })
        .sort({ fecha: 1, createdAt: 1 })
        .lean(),
      ServicioModel.find({ day: "domingo" }, { _id: 1 }).lean(),
    ]);
    const sesiones = await SesionServicioModel.find(
      { service: { $in: serviciosDomingo.map((s) => s._id) } },
      { date: 1 },
    ).lean();
    const asistencias = await AsistenciaModel.aggregate([
      { $match: { sesion: { $in: sesiones.map((s) => s._id) } } },
      { $group: { _id: "$sesion", personas: { $addToSet: "$person" } } },
    ]);

    // Asistentes distintos por domingo (si hay dos cultos el mismo domingo, se cuenta una vez)
    const diaSesion = new Map(sesiones.map((s) => [String(s._id), diaDe(s.date)]));
    const porDomingo = new Map();
    for (const a of asistencias) {
      const dia = diaSesion.get(String(a._id));
      if (!porDomingo.has(dia)) porDomingo.set(dia, new Set());
      for (const p of a.personas) porDomingo.get(dia).add(String(p));
    }
    for (const s of sesiones) if (!porDomingo.has(diaDe(s.date))) porDomingo.set(diaDe(s.date), new Set());

    const ALTAS = new Set(["admision_bautismo", "traslado_recibido", "reafirmacion_fe"]);
    const BAJAS = new Set(["traslado_enviado", "baja_inasistencia", "fallecimiento", "disciplina_exclusion"]);

    const estadoActual = new Map(); // miembro -> estado tras el último evento procesado
    let i = 0;
    const meses = periodos.map((periodo) => {
      let altas = 0;
      let bajas = 0;
      while (i < eventos.length && periodoDe(eventos[i].fecha) <= periodo) {
        const ev = eventos[i];
        if (periodoDe(ev.fecha) === periodo) {
          if (ALTAS.has(ev.tipo)) altas += 1;
          if (BAJAS.has(ev.tipo)) bajas += 1;
        }
        estadoActual.set(String(ev.miembro), String(ev.estado_nuevo));
        i += 1;
      }
      const activos = [...estadoActual.values()].filter((e) => e === String(activo._id)).length;
      const domingos = [...porDomingo.entries()].filter(([dia]) => dia.startsWith(periodo));
      const promedio = domingos.length
        ? Math.round((domingos.reduce((s, [, set]) => s + set.size, 0) / domingos.length) * 10) / 10
        : null;
      return { periodo, miembros_activos: activos, altas, bajas, neto: altas - bajas, domingos: domingos.length, asistencia_promedio_dominical: promedio };
    });

    const primero = meses[0];
    const ultimo = meses[meses.length - 1];
    return {
      desde: inicio,
      hasta: fin,
      meses,
      variacion: {
        miembros_activos: ultimo.miembros_activos - primero.miembros_activos,
        pct: primero.miembros_activos
          ? Math.round(((ultimo.miembros_activos - primero.miembros_activos) / primero.miembros_activos) * 1000) / 10
          : null,
        altas: meses.reduce((s, m) => s + m.altas, 0),
        bajas: meses.reduce((s, m) => s + m.bajas, 0),
      },
    };
  }

  /** Cuántos eventos de cada tipo hubo en el año (recibidos, trasladados, bajas...). */
  async resumen(anio) {
    const desde = new Date(Date.UTC(anio, 0, 1));
    const hasta = new Date(Date.UTC(anio + 1, 0, 1));
    const filas = await EventoMembresiaModel.aggregate([
      { $match: { fecha: { $gte: desde, $lt: hasta }, tipo: { $ne: "registro" } } },
      { $group: { _id: "$tipo", cantidad: { $sum: 1 } } },
    ]);
    const porTipo = Object.fromEntries(filas.map((f) => [f._id, f.cantidad]));
    const estados = await MiembroModel.aggregate([
      { $group: { _id: "$state", cantidad: { $sum: 1 } } },
      { $lookup: { from: EstadoModel.collection.name, localField: "_id", foreignField: "_id", as: "e" } },
      { $project: { _id: 0, estado: { $ifNull: [{ $first: "$e.description" }, "Sin estado"] }, cantidad: 1 } },
      { $sort: { estado: 1 } },
    ]);
    return { anio, eventos: porTipo, miembros_por_estado: estados };
  }
}

export default MembresiaService;
