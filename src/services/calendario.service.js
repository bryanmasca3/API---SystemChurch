import Boom from "@hapi/boom";
import BaseService from "./base.service.js";
import { EventoModel } from "../models/evento.model.js";
import { DepartamentoModel } from "../models/departamento.model.js";
import { MiembroModel } from "../models/miembro.model.js";
import { ServicioModel } from "../models/servicio.model.js";
import { SesionServicioModel, FUNCIONES } from "../models/sesionServicio.model.js";
import { POPULATE_SESION, funcionesPendientes } from "./sesionServicio.service.js";

const ETIQUETA_FUNCION = { director: "Director", predicador: "Predicador", lectura_biblica: "Lectura bíblica" };

/** Eventos que se cruzan con el rango [desde, hasta]. */
const filtroSolapa = (desde, hasta) => ({
  ...(hasta && { fecha_inicio: { $lte: hasta } }),
  ...(desde && { fecha_fin: { $gte: desde } }),
});

export class EventoService extends BaseService {
  constructor() {
    super(EventoModel, {
      nombre: "Evento",
      orden: { fecha_inicio: 1 },
      paginado: true,
      populate: [
        { path: "departamento", select: "description" },
        { path: "responsable", select: "person", populate: { path: "person", select: "name surname phone" } },
      ],
      referencias: [
        { campo: "departamento", model: DepartamentoModel, nombre: "departamento" },
        { campo: "responsable", model: MiembroModel, nombre: "responsable" },
      ],
    });
  }

  construirFiltro({ desde, hasta, tipo, departamento, estado } = {}) {
    return {
      ...filtroSolapa(desde, hasta),
      ...(tipo && { tipo }),
      ...(departamento && { departamento }),
      ...(estado && { estado }),
    };
  }

  async validarFechas(id, data) {
    const actual = id ? await EventoModel.findById(id, { fecha_inicio: 1, fecha_fin: 1 }).lean() : {};
    if (id && !actual) throw this.noEncontrado();
    const inicio = data.fecha_inicio ?? actual.fecha_inicio;
    const fin = data.fecha_fin ?? actual.fecha_fin;
    if (inicio && fin && new Date(fin) < new Date(inicio)) {
      throw Boom.badRequest("La fecha de fin no puede ser anterior a la de inicio");
    }
  }

  async crear(data, usuarioId) {
    data.fecha_fin ??= data.fecha_inicio;
    await this.validarFechas(null, data);
    return super.crear({ ...data, registrado_por: usuarioId });
  }

  async actualizar(id, data) {
    await this.validarFechas(id, data);
    return super.actualizar(id, data);
  }
}

const nombreAsignado = (a) => {
  if (!a) return null;
  if (a.miembro?.person) return `${a.miembro.person.name} ${a.miembro.person.surname}`;
  return a.invitado ? `${a.invitado}${a.iglesia ? ` (${a.iglesia})` : ""}` : null;
};

/** Resumen de una sesión para el calendario. */
const itemSesion = (s) => ({
  tipo: "culto",
  _id: s._id,
  titulo: s.service?.description,
  fecha_inicio: s.date,
  departamento: s.service?.departament?.description ?? null,
  programa: Object.fromEntries(
    FUNCIONES.map((f) => [
      f,
      s.programa?.[f]
        ? {
            nombre: nombreAsignado(s.programa[f]),
            ...(f === "predicador" && { tema: s.programa[f].tema, texto_biblico: s.programa[f].texto_biblico }),
            ...(f === "lectura_biblica" && { pasaje: s.programa[f].pasaje }),
          }
        : null,
    ]),
  ),
  funciones_pendientes: funcionesPendientes(s),
});

const itemEvento = (e) => ({
  tipo: "evento",
  _id: e._id,
  titulo: e.titulo,
  tipo_evento: e.tipo,
  fecha_inicio: e.fecha_inicio,
  fecha_fin: e.fecha_fin,
  lugar: e.lugar ?? null,
  departamento: e.departamento?.description ?? null,
  estado: e.estado,
});

/**
 * Calendario unificado: cultos (con su programa) y eventos entre dos fechas.
 * `departamento` filtra ambos por el departamento organizador.
 */
export async function calendario({ desde, hasta, departamento } = {}) {
  const inicio = desde ?? new Date();
  const fin = hasta ?? new Date(new Date(inicio).getTime() + 31 * 864e5);
  if (fin < inicio) throw Boom.badRequest("`hasta` debe ser posterior a `desde`");

  const servicios = departamento ? await ServicioModel.find({ departament: departamento }, { _id: 1 }).lean() : null;
  const [sesiones, eventos] = await Promise.all([
    SesionServicioModel.find({
      date: { $gte: inicio, $lte: fin },
      ...(servicios && { service: { $in: servicios.map((s) => s._id) } }),
    }).populate(POPULATE_SESION),
    EventoModel.find({ ...filtroSolapa(inicio, fin), ...(departamento && { departamento }) }).populate("departamento", "description"),
  ]);

  const items = [...sesiones.map(itemSesion), ...eventos.map(itemEvento)].sort(
    (a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio),
  );
  return {
    desde: inicio,
    hasta: fin,
    cultos: sesiones.length,
    eventos: eventos.length,
    cultos_con_programa_incompleto: items.filter((i) => i.tipo === "culto" && i.funciones_pendientes.length).length,
    items,
  };
}

/** Funciones asignadas al miembro del usuario desde una fecha (por defecto, hoy). */
export async function misAsignaciones(miembroId, { desde } = {}) {
  if (!miembroId) throw Boom.badRequest("Tu usuario no está vinculado a un miembro de la iglesia");
  const sesiones = await SesionServicioModel.find({
    date: { $gte: desde ?? new Date(new Date().toDateString()) },
    $or: FUNCIONES.map((f) => ({ [`programa.${f}.miembro`]: miembroId })),
  })
    .sort({ date: 1 })
    .populate(POPULATE_SESION);

  return sesiones.flatMap((s) =>
    FUNCIONES.filter((f) => String(s.programa?.[f]?.miembro?._id) === String(miembroId)).map((f) => ({
      sesion: s._id,
      servicio: s.service?.description,
      fecha: s.date,
      funcion: f,
      funcion_etiqueta: ETIQUETA_FUNCION[f],
      ...(f === "predicador" && { tema: s.programa[f].tema, texto_biblico: s.programa[f].texto_biblico }),
      ...(f === "lectura_biblica" && { pasaje: s.programa[f].pasaje }),
    })),
  );
}
