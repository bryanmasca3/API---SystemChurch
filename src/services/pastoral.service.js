/**
 * Pastoral: visitas, necesitados y enfermos (diaconado), peticiones de oración,
 * seguimiento de nuevos (evangelismo y discipulado) y alertas de inasistencia.
 *
 * Confidencialidad:
 *  - Visitas "solo_pastor": solo rol pastor/administrador (ni los ancianos).
 *  - Peticiones "confidencial": solo pastor, administrador, ancianos activos y quien la registró.
 */
import Boom from "@hapi/boom";
import BaseService from "./base.service.js";
import {
  VisitaModel,
  CasoDiaconiaModel,
  PeticionOracionModel,
  SeguimientoModel,
} from "../models/pastoral.model.js";
import { PersonaModel } from "../models/persona.model.js";
import { MiembroModel } from "../models/miembro.model.js";
import { FamiliaModel } from "../models/familia.model.js";
import { MovimientoFinancieroModel } from "../models/movimientoFinanciero.model.js";
import { ServicioModel } from "../models/servicio.model.js";
import { SesionServicioModel } from "../models/sesionServicio.model.js";
import { AsistenciaModel } from "../models/asistencia.model.js";
import { ROLES, esPastoral } from "../config/permisos.js";
import { construirFiltroFechas, regexBusqueda } from "./filtros.js";
import { diaDe, periodoDe, periodoActual } from "../libs/fechas.js";
import { estadoPorNombre } from "./membresia.service.js";
import PersonaService from "./persona.service.js";
import { registrarEnBitacora } from "./auditoria.js";

const personaService = new PersonaService();
const esPastorORol = (usuario) => [ROLES.ADMINISTRADOR, ROLES.PASTOR].includes(usuario?.rol);
const POP_PERSONA = { select: "name surname phone address" };
const POP_MIEMBRO = (path) => ({ path, select: "person", populate: { path: "person", select: "name surname phone" } });

const validarExisten = async (model, ids, etiqueta) => {
  const lista = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
  if (!lista.length) return;
  const n = await model.countDocuments({ _id: { $in: lista } });
  if (n !== new Set(lista.map(String)).size) throw Boom.badRequest(`No existe: ${etiqueta}`);
};

/** `persona` puede ser un id o los datos de una persona nueva. */
const resolverPersona = async (persona) => {
  if (persona && typeof persona === "object") return (await personaService.crear(persona))._id;
  await validarExisten(PersonaModel, persona, "persona");
  return persona;
};

// ---------------------------------------------------------------------------
export class VisitaService extends BaseService {
  constructor() {
    super(VisitaModel, {
      nombre: "Visita pastoral",
      orden: { fecha: -1 },
      paginado: true,
      populate: [
        { path: "persona", ...POP_PERSONA },
        { path: "familia", select: "nombre direccion" },
        POP_MIEMBRO("visitantes"),
        { path: "caso", select: "tipo estado prioridad" },
        { path: "registrado_por", select: "nombre" },
      ],
    });
  }

  /** Quien no es pastor/administrador no ve las visitas "solo pastor". */
  visibilidad(usuario) {
    return esPastorORol(usuario) ? {} : { solo_pastor: { $ne: true } };
  }

  construirFiltro({ persona, familia, motivo, proximas, desde, hasta } = {}) {
    return {
      ...(persona && { persona }),
      ...(familia && { familia }),
      ...(motivo && { motivo }),
      ...(proximas && { proxima_visita: { $gte: new Date(new Date().toDateString()) } }),
      ...construirFiltroFechas(desde, hasta, "fecha"),
    };
  }

  async listar({ pagina = 1, limite = 20, ...filtros } = {}, usuario) {
    const filtro = { ...this.construirFiltro(filtros), ...this.visibilidad(usuario) };
    const orden = filtros.proximas ? { proxima_visita: 1 } : this.orden;
    const [data, total] = await Promise.all([
      VisitaModel.find(filtro).populate(this.populate).sort(orden).skip((pagina - 1) * limite).limit(limite),
      VisitaModel.countDocuments(filtro),
    ]);
    return { data, meta: { total, pagina, limite, paginas: Math.ceil(total / limite) } };
  }

  async obtener(id, usuario) {
    const v = await VisitaModel.findOne({ _id: id, ...this.visibilidad(usuario) }).populate(this.populate);
    if (!v) throw this.noEncontrado();
    return v;
  }

  async validar(data, usuario) {
    if (data.solo_pastor && !esPastorORol(usuario)) {
      throw Boom.forbidden("Solo el pastor puede marcar una visita como 'solo pastor'");
    }
    await validarExisten(PersonaModel, data.persona, "persona");
    await validarExisten(FamiliaModel, data.familia, "familia");
    await validarExisten(MiembroModel, data.visitantes, "alguno de los visitantes");
    await validarExisten(CasoDiaconiaModel, data.caso, "caso");
  }

  async crear(data, usuario) {
    await this.validar(data, usuario);
    const v = await super.crear({ ...data, registrado_por: usuario.sub });
    return this.obtener(v._id, usuario);
  }

  async actualizar(id, data, usuario) {
    await this.obtener(id, usuario); // 404 si no puede verla
    await this.validar(data, usuario);
    return super.actualizar(id, data);
  }

  async eliminar(id, usuario) {
    await this.obtener(id, usuario);
    return super.eliminar(id);
  }
}

// ---------------------------------------------------------------------------
export class CasoService extends BaseService {
  constructor() {
    super(CasoDiaconiaModel, {
      nombre: "Caso de diaconía",
      orden: { fecha_inicio: -1 },
      paginado: true,
      populate: [
        { path: "persona", ...POP_PERSONA },
        POP_MIEMBRO("responsable"),
        { path: "ayudas.movimiento_financiero", select: "monto fecha anulado fondo" },
        { path: "ayudas.registrado_por", select: "nombre" },
        { path: "registrado_por", select: "nombre" },
      ],
      referencias: [
        { campo: "persona", model: PersonaModel, nombre: "persona" },
        { campo: "responsable", model: MiembroModel, nombre: "responsable" },
      ],
    });
  }

  construirFiltro({ estado, tipo, prioridad, persona, abiertos } = {}) {
    return {
      ...(estado && { estado }),
      ...(abiertos && { estado: { $ne: "cerrado" } }),
      ...(tipo && { tipo }),
      ...(prioridad && { prioridad }),
      ...(persona && { persona }),
    };
  }

  async crear(data, usuario) {
    data.persona = await resolverPersona(data.persona);
    return super.crear({ ...data, registrado_por: usuario.sub });
  }

  /** Cerrar exige motivo; reabrir limpia la fecha de cierre. */
  async actualizar(id, data) {
    if (data.estado === "cerrado") {
      const actual = await CasoDiaconiaModel.findById(id).lean();
      if (!actual) throw this.noEncontrado();
      if (!data.motivo_cierre && !actual.motivo_cierre) throw Boom.badRequest("Indica el motivo_cierre");
      data.fecha_cierre ??= new Date();
    } else if (data.estado) {
      data.fecha_cierre = null;
      data.motivo_cierre = null;
    }
    return super.actualizar(id, data);
  }

  async agregarAyuda(id, ayuda, usuario) {
    const caso = await CasoDiaconiaModel.findById(id);
    if (!caso) throw this.noEncontrado();
    if (caso.estado === "cerrado") throw Boom.conflict("El caso está cerrado: reábrelo para registrar ayudas");

    if (ayuda.movimiento_financiero) {
      const mov = await MovimientoFinancieroModel.findById(ayuda.movimiento_financiero).lean();
      if (!mov) throw Boom.badRequest("No existe: movimiento financiero");
      if (mov.tipo !== "egreso" || mov.anulado) throw Boom.badRequest("El movimiento debe ser un egreso no anulado");
      if (await CasoDiaconiaModel.exists({ "ayudas.movimiento_financiero": mov._id })) {
        throw Boom.conflict("Ese egreso ya está asociado a otra ayuda");
      }
      ayuda.monto ??= mov.monto;
    }
    caso.ayudas.push({ ...ayuda, registrado_por: usuario.sub });
    if (caso.estado === "abierto") caso.estado = "en_seguimiento";
    await caso.save();
    await registrarEnBitacora({
      accion: "actualizar",
      recurso: this.nombre,
      documento: caso._id,
      resumen: `Ayuda registrada: ${ayuda.tipo}${ayuda.monto ? ` S/ ${ayuda.monto}` : ""}`,
    });
    return this.obtener(id);
  }

  async quitarAyuda(id, ayudaId) {
    const r = await CasoDiaconiaModel.updateOne({ _id: id }, { $pull: { ayudas: { _id: ayudaId } } });
    if (!r.matchedCount) throw this.noEncontrado();
    if (!r.modifiedCount) throw Boom.notFound("Ayuda no encontrada en este caso");
    await registrarEnBitacora({ accion: "actualizar", recurso: this.nombre, documento: id, resumen: "Ayuda eliminada" });
    return this.obtener(id);
  }
}

// ---------------------------------------------------------------------------
export class PeticionService extends BaseService {
  constructor() {
    super(PeticionOracionModel, {
      nombre: "Petición de oración",
      orden: { fecha: -1 },
      paginado: true,
      populate: [{ path: "persona", select: "name surname" }, { path: "registrado_por", select: "nombre" }],
      referencias: [{ campo: "persona", model: PersonaModel, nombre: "persona" }],
    });
  }

  /** Las confidenciales solo las ven el equipo pastoral y quien la registró. */
  visibilidad(usuario) {
    return esPastoral(usuario) ? {} : { $or: [{ confidencial: { $ne: true } }, { registrado_por: usuario.sub }] };
  }

  construirFiltro({ estado, persona, confidencial } = {}) {
    return {
      ...(estado && { estado }),
      ...(persona && { persona }),
      ...(confidencial !== undefined && { confidencial }),
    };
  }

  async listar({ pagina = 1, limite = 20, ...filtros } = {}, usuario) {
    const filtro = { $and: [this.construirFiltro(filtros), this.visibilidad(usuario)] };
    const [data, total] = await Promise.all([
      PeticionOracionModel.find(filtro).populate(this.populate).sort(this.orden).skip((pagina - 1) * limite).limit(limite),
      PeticionOracionModel.countDocuments(filtro),
    ]);
    return { data, meta: { total, pagina, limite, paginas: Math.ceil(total / limite) } };
  }

  async obtener(id, usuario) {
    const p = await PeticionOracionModel.findOne({ $and: [{ _id: id }, this.visibilidad(usuario)] }).populate(this.populate);
    if (!p) throw this.noEncontrado();
    return p;
  }

  async crear(data, usuario) {
    const p = await super.crear({ ...data, registrado_por: usuario.sub });
    return this.obtener(p._id, usuario);
  }

  /** Solo quien la registró o el equipo pastoral la edita, marca respondida o elimina. */
  async validarAutor(id, usuario) {
    const p = await this.obtener(id, usuario);
    if (!esPastoral(usuario) && String(p.registrado_por?._id) !== String(usuario.sub)) {
      throw Boom.forbidden("Solo quien registró la petición o el equipo pastoral puede modificarla");
    }
    return p;
  }

  async actualizar(id, data, usuario) {
    await this.validarAutor(id, usuario);
    if (data.estado === "respondida") data.fecha_respuesta ??= new Date();
    await super.actualizar(id, data);
    return this.obtener(id, usuario);
  }

  async eliminar(id, usuario) {
    await this.validarAutor(id, usuario);
    return super.eliminar(id);
  }
}

// ---------------------------------------------------------------------------
const ETAPAS_CERRADAS = ["integrado", "sin_seguimiento"];

export class SeguimientoService extends BaseService {
  constructor() {
    super(SeguimientoModel, {
      nombre: "Seguimiento de nuevo",
      orden: { fecha_inicio: -1 },
      paginado: true,
      populate: [
        { path: "persona", ...POP_PERSONA },
        POP_MIEMBRO("invitado_por"),
        POP_MIEMBRO("discipulador"),
        { path: "avances.registrado_por", select: "nombre" },
      ],
      referencias: [
        { campo: "invitado_por", model: MiembroModel, nombre: "miembro que invitó" },
        { campo: "discipulador", model: MiembroModel, nombre: "discipulador" },
      ],
    });
  }

  construirFiltro({ etapa, discipulador, activos, buscar } = {}) {
    return {
      ...(etapa && { etapa }),
      ...(activos && { etapa: { $nin: ETAPAS_CERRADAS } }),
      ...(discipulador && { discipulador }),
      ...(buscar && { observacion: regexBusqueda(buscar) }),
    };
  }

  async crear({ persona, ...data }, usuario) {
    const personaId = await resolverPersona(persona);
    if (await SeguimientoModel.exists({ persona: personaId })) {
      throw Boom.conflict("Esta persona ya tiene un seguimiento: registra un avance en el existente");
    }
    const miembro = await MiembroModel.findOne({ person: personaId }).populate("state", "description").lean();
    if (miembro?.state?.description?.toUpperCase() === "ACTIVO") {
      throw Boom.conflict("Esta persona ya es miembro activo");
    }
    const etapa = data.etapa ?? "contacto";
    return super.crear({
      ...data,
      persona: personaId,
      etapa,
      registrado_por: usuario.sub,
      avances: [{ fecha: data.fecha_inicio, tipo: "cambio_etapa", etapa, observacion: "Inicio del seguimiento", registrado_por: usuario.sub }],
    });
  }

  /** Sesión de discipulado, nota o cambio de etapa. */
  async registrarAvance(id, avance, usuario) {
    const s = await SeguimientoModel.findById(id);
    if (!s) throw this.noEncontrado();
    if (avance.tipo === "cambio_etapa") {
      if (avance.etapa === s.etapa) throw Boom.badRequest(`Ya está en la etapa "${s.etapa}"`);
      s.etapa = avance.etapa;
    }
    s.avances.push({ ...avance, registrado_por: usuario.sub });
    await s.save();
    await registrarEnBitacora({
      accion: "actualizar",
      recurso: this.nombre,
      documento: s._id,
      resumen: avance.tipo === "cambio_etapa" ? `Etapa: ${avance.etapa}` : `Avance: ${avance.tipo}`,
    });
    return this.obtener(id);
  }
}

/** Al bautizar a alguien que estaba en seguimiento, pasa a "integrado" (lo llama el acta de bautismo). */
export async function marcarIntegradoPorBautismo(personaId, numeroActa, fecha) {
  const s = await SeguimientoModel.findOne({ persona: personaId, etapa: { $ne: "integrado" } });
  if (!s) return;
  s.etapa = "integrado";
  s.avances.push({ fecha, tipo: "cambio_etapa", etapa: "integrado", observacion: `Bautizado (acta N.º ${numeroActa})` });
  await s.save();
}

// ---------------------------------------------------------------------------
/**
 * Alertas de inasistencia: miembros ACTIVOS que no asistieron a ninguno de los últimos
 * N domingos con culto registrado. Incluye su última asistencia, la última visita y si tiene
 * un caso abierto de diaconía (p. ej. está enfermo).
 */
export async function alertasInasistencia({ domingos = 4 } = {}) {
  const servicios = await ServicioModel.find({ day: "domingo" }, { _id: 1 }).lean();
  const sesiones = await SesionServicioModel.find(
    { service: { $in: servicios.map((s) => s._id) }, date: { $lte: new Date() } },
    { date: 1 },
  ).lean();
  const diaSesion = new Map(sesiones.map((s) => [String(s._id), diaDe(s.date)]));
  const dias = [...new Set(diaSesion.values())].sort().reverse(); // del más reciente al más antiguo

  if (dias.length < domingos) {
    return {
      domingos,
      advertencia: `Solo hay ${dias.length} domingo(s) con culto registrado: se necesitan al menos ${domingos} para generar alertas`,
      total: 0,
      alertas: [],
    };
  }

  const activo = await estadoPorNombre("ACTIVO");
  const miembros = await MiembroModel.find({ state: activo._id }).populate("person", "name surname phone").lean();
  const asistencias = await AsistenciaModel.find(
    { sesion: { $in: sesiones.map((s) => s._id) }, person: { $in: miembros.map((m) => m.person?._id) } },
    { person: 1, sesion: 1 },
  ).lean();
  const diasPorPersona = new Map();
  for (const a of asistencias) {
    const k = String(a.person);
    if (!diasPorPersona.has(k)) diasPorPersona.set(k, new Set());
    diasPorPersona.get(k).add(diaSesion.get(String(a.sesion)));
  }

  const ultimos = new Set(dias.slice(0, domingos));
  const enAlerta = miembros.filter((m) => {
    const asistio = diasPorPersona.get(String(m.person?._id)) ?? new Set();
    return ![...ultimos].some((d) => asistio.has(d));
  });

  const personas = enAlerta.map((m) => m.person?._id);
  const [visitas, casos] = await Promise.all([
    VisitaModel.aggregate([
      { $match: { persona: { $in: personas } } },
      { $group: { _id: "$persona", ultima: { $max: "$fecha" } } },
    ]),
    CasoDiaconiaModel.find({ persona: { $in: personas }, estado: { $ne: "cerrado" } }, { persona: 1, tipo: 1 }).lean(),
  ]);
  const ultimaVisita = new Map(visitas.map((v) => [String(v._id), v.ultima]));
  const casoAbierto = new Map(casos.map((c) => [String(c.persona), c.tipo]));

  const alertas = enAlerta
    .map((m) => {
      const asistio = diasPorPersona.get(String(m.person?._id)) ?? new Set();
      const consecutivos = dias.findIndex((d) => asistio.has(d));
      const ultima = [...asistio].sort().pop() ?? null;
      return {
        miembro: m._id,
        persona: m.person?._id,
        nombre: m.person ? `${m.person.surname}, ${m.person.name}` : "(sin persona)",
        telefono: m.person?.phone ?? null,
        domingos_sin_asistir: consecutivos === -1 ? dias.length : consecutivos,
        ultima_asistencia: ultima,
        ultima_visita: ultimaVisita.get(String(m.person?._id)) ?? null,
        caso_abierto: casoAbierto.get(String(m.person?._id)) ?? null,
      };
    })
    .sort((a, b) => b.domingos_sin_asistir - a.domingos_sin_asistir || a.nombre.localeCompare(b.nombre, "es"));

  return { domingos, ultimo_domingo: dias[0], total: alertas.length, alertas };
}

/** Tablero pastoral del mes. */
export async function resumenPastoral(usuario) {
  const periodo = periodoActual();
  const hoy = new Date(new Date().toDateString());
  const en7dias = new Date(hoy.getTime() + 7 * 24 * 3600 * 1000);
  const visible = esPastorORol(usuario) ? {} : { solo_pastor: { $ne: true } };

  const [visitas, proximas, casos, peticiones, seguimiento, alertas] = await Promise.all([
    VisitaModel.find(visible, { fecha: 1 }).lean(),
    VisitaModel.find({ ...visible, proxima_visita: { $gte: hoy, $lte: en7dias } })
      .populate("persona", "name surname")
      .populate("familia", "nombre")
      .sort({ proxima_visita: 1 })
      .lean(),
    CasoDiaconiaModel.aggregate([
      { $match: { estado: { $ne: "cerrado" } } },
      { $group: { _id: "$prioridad", cantidad: { $sum: 1 } } },
    ]),
    PeticionOracionModel.countDocuments({ estado: "activa" }),
    SeguimientoModel.aggregate([{ $group: { _id: "$etapa", cantidad: { $sum: 1 } } }]),
    alertasInasistencia(),
  ]);

  return {
    periodo,
    visitas_del_mes: visitas.filter((v) => periodoDe(v.fecha) === periodo).length,
    proximas_visitas: proximas.map((v) => ({
      _id: v._id,
      fecha: v.proxima_visita,
      a: v.persona ? `${v.persona.name} ${v.persona.surname}` : v.familia?.nombre,
    })),
    casos_abiertos: Object.fromEntries(casos.map((c) => [c._id, c.cantidad])),
    peticiones_activas: peticiones,
    nuevos_por_etapa: Object.fromEntries(seguimiento.map((s) => [s._id, s.cantidad])),
    alertas_inasistencia: alertas.total,
  };
}
