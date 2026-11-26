import Boom from "@hapi/boom";
import BaseService from "./base.service.js";
import { SesionServicioModel, FUNCIONES } from "../models/sesionServicio.model.js";
import { ServicioModel } from "../models/servicio.model.js";
import { AsistenciaModel } from "../models/asistencia.model.js";
import { AsistenciaSantaCenaModel } from "../models/asistenciaSantaCena.model.js";
import { MiembroModel } from "../models/miembro.model.js";
import { construirFiltroFechas } from "./filtros.js";
import { MovimientoFinancieroModel } from "../models/movimientoFinanciero.model.js";
import { diaDe } from "../libs/fechas.js";
import { registrarEnBitacora } from "./auditoria.js";

const POP_ASIGNADO = (funcion) => ({
  path: `programa.${funcion}.miembro`,
  select: "person",
  populate: { path: "person", select: "name surname phone" },
});
export const POPULATE_SESION = [
  { path: "service", populate: { path: "departament", select: "description" } },
  ...FUNCIONES.map(POP_ASIGNADO),
];

/** Funciones del programa que siguen sin asignar. */
export const funcionesPendientes = (sesion) =>
  FUNCIONES.filter((f) => !sesion.programa?.[f]?.miembro && !sesion.programa?.[f]?.invitado);

/** Hora local (America/Lima, sin horario de verano) -> Date. */
const fechaLocal = (dia, hora) => new Date(`${dia}T${hora}:00-05:00`);
const diaSiguiente = (dia) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
// getUTCDay(): 0 = domingo ... 6 = sábado
const DIA_JS = { domingo: 0, lunes: 1, martes: 2, "miércoles": 3, jueves: 4, viernes: 5, "sábado": 6 };

class SesionServicioService extends BaseService {
  constructor() {
    super(SesionServicioModel, {
      nombre: "Sesión de servicio",
      orden: { date: -1 },
      paginado: true,
      populate: POPULATE_SESION,
      referencias: [{ campo: "service", model: ServicioModel, nombre: "servicio" }],
      dependencias: [
        { model: AsistenciaModel, campo: "sesion", nombre: "registros de asistencia" },
        { model: AsistenciaSantaCenaModel, campo: "sesion", nombre: "asistencias a Santa Cena" },
        { model: MovimientoFinancieroModel, campo: "sesion", nombre: "ofrendas o diezmos registrados" },
      ],
    });
  }

  construirFiltro({ servicio, desde, hasta, programa_incompleto } = {}) {
    return {
      ...(servicio && { service: servicio }),
      ...construirFiltroFechas(desde, hasta),
      ...(programa_incompleto && {
        $or: FUNCIONES.map((f) => ({
          [`programa.${f}.miembro`]: { $exists: false },
          [`programa.${f}.invitado`]: { $in: [null, ""] },
        })),
      }),
    };
  }

  /** Ids de las sesiones que cumplen los filtros (para filtrar asistencias por servicio/fecha). */
  async idsQueCumplen(filtros) {
    const sesiones = await SesionServicioModel.find(this.construirFiltro(filtros), { _id: 1 }).lean();
    return sesiones.map((s) => s._id);
  }

  /**
   * Asigna (o quita, con null) director, predicador y lectura bíblica. Solo se envían las
   * funciones que cambian. Cada una es { miembro } o { invitado, iglesia }.
   */
  async asignarPrograma(id, programa) {
    const sesion = await SesionServicioModel.findById(id).lean();
    if (!sesion) throw this.noEncontrado();
    const miembros = Object.values(programa).filter((a) => a?.miembro).map((a) => String(a.miembro));
    if (miembros.length) {
      const existentes = await MiembroModel.countDocuments({ _id: { $in: [...new Set(miembros)] } });
      if (existentes !== new Set(miembros).size) throw Boom.badRequest("No existe: alguno de los miembros asignados");
    }
    const cambios = Object.fromEntries(Object.entries(programa).map(([f, a]) => [`programa.${f}`, a]));
    await super.actualizar(id, cambios);
    return this.conPendientes(await this.obtener(id));
  }

  conPendientes(sesion) {
    return { ...sesion.toJSON(), funciones_pendientes: funcionesPendientes(sesion) };
  }

  /**
   * Crea las sesiones de los servicios en un rango de fechas según su día y hora de inicio.
   * No duplica: si ya hay una sesión ese día para ese servicio, la omite.
   * Los servicios sin hora de inicio no se pueden programar (se informan).
   */
  async generar({ desde, hasta, servicios: ids }) {
    const inicio = diaDe(desde);
    const fin = diaDe(hasta);
    if (fin < inicio) throw Boom.badRequest("`hasta` debe ser posterior a `desde`");
    const dias = [];
    for (let d = inicio; d <= fin; d = diaSiguiente(d)) dias.push(d);
    if (dias.length > 93) throw Boom.badRequest("Máximo 3 meses por vez");

    const servicios = await ServicioModel.find(ids?.length ? { _id: { $in: ids } } : {}).lean();
    if (ids?.length && servicios.length !== new Set(ids.map(String)).size) throw Boom.badRequest("No existe: alguno de los servicios");

    const existentes = await SesionServicioModel.find(
      { service: { $in: servicios.map((s) => s._id) }, date: { $gte: fechaLocal(inicio, "00:00"), $lte: fechaLocal(fin, "23:59") } },
      { service: 1, date: 1 },
    ).lean();
    const ocupado = new Set(existentes.map((s) => `${s.service}|${diaDe(s.date)}`));

    const nuevas = [];
    const sinHorario = [];
    let omitidas = 0;
    for (const s of servicios) {
      if (!s.begintime) {
        sinHorario.push(s.description);
        continue;
      }
      for (const dia of dias) {
        if (new Date(`${dia}T12:00:00Z`).getUTCDay() !== DIA_JS[s.day]) continue;
        if (ocupado.has(`${s._id}|${dia}`)) {
          omitidas += 1;
          continue;
        }
        nuevas.push({ service: s._id, date: fechaLocal(dia, s.begintime) });
      }
    }
    if (nuevas.length) await SesionServicioModel.insertMany(nuevas);
    await registrarEnBitacora({
      accion: "crear",
      recurso: this.nombre,
      resumen: `Generadas ${nuevas.length} sesiones del ${inicio} al ${fin}`,
    });
    return {
      desde: inicio,
      hasta: fin,
      creadas: nuevas.length,
      ya_existian: omitidas,
      ...(sinHorario.length && {
        servicios_sin_horario: sinHorario,
        aviso: "Estos servicios no tienen hora de inicio: complétala en /servicio para poder programarlos",
      }),
    };
  }
}

export default SesionServicioService;
