/**
 * Resuelve a qué departamento(s) pertenece lo que una petición quiere modificar,
 * para que el rol "lider" solo pueda escribir en su departamento.
 *
 * Cada resolvedor recibe `req` y devuelve un arreglo de ids de departamento.
 * Un valor vacío (null/undefined) significa "sin departamento" y el líder no puede tocarlo.
 * Al actualizar se incluyen el departamento actual y el nuevo (no puede "mover" algo a otro).
 */
import { MiembroDepartamentoModel } from "../models/miembroDepartamento.model.js";
import { ServicioModel } from "../models/servicio.model.js";
import { SesionServicioModel } from "../models/sesionServicio.model.js";
import { ReunionModel } from "../models/reunion.model.js";
import { BienModel } from "../models/bien.model.js";
import { OficialModel } from "../models/oficial.model.js";
import { EventoModel } from "../models/evento.model.js";

const texto = (v) => (v == null ? null : String(v));

/** Oficios activos (anciano, diácono, evangelista...) del miembro vinculado al usuario. */
export const oficiosDelUsuario = async (usuario) => {
  if (!usuario?.miembro) return [];
  return OficialModel.distinct("oficio", { miembro: usuario.miembro, estado: "activo" });
};

/** Departamentos donde el miembro vinculado al usuario es integrante. */
export const departamentosDelUsuario = async (usuario) => {
  if (!usuario?.miembro) return [];
  const filas = await MiembroDepartamentoModel.find({ member: usuario.miembro }, { departament: 1 }).lean();
  return filas.map((f) => String(f.departament));
};

const deServicio = async (id) =>
  id && texto((await ServicioModel.findById(id, { departament: 1 }).lean())?.departament);

const deSesion = async (id) => {
  if (!id) return null;
  const sesion = await SesionServicioModel.findById(id, { service: 1 }).lean();
  return deServicio(sesion?.service);
};

const deReunion = async (id) =>
  id && texto((await ReunionModel.findById(id, { departament: 1 }).lean())?.departament);

const deBien = async (id) =>
  id && texto((await BienModel.findById(id, { departamento: 1 }).lean())?.departamento);

/** Une el departamento del registro existente (:id) con el que llega en el body. */
const combinar = async (req, delExistente, campoBody, delBody = async (v) => texto(v)) => {
  const resultado = [];
  if (req.params.id) resultado.push(await delExistente(req.params.id));
  if (campoBody in (req.body ?? {})) resultado.push(await delBody(req.body[campoBody]));
  return resultado;
};

export const alcance = {
  // /departamento/:id/integrantes...
  integrantes: async (req) => [texto(req.params.id)],

  reunion: (req) => combinar(req, deReunion, "departament"),
  // /reunion/:id/asistentes...
  asistentesReunion: async (req) => [await deReunion(req.params.id)],

  sesion: (req) => combinar(req, async (id) => deSesion(id), "service", deServicio),

  /** Asistencias (normal o Santa Cena): el departamento sale de la sesión. */
  asistencia: (model) => (req) =>
    combinar(
      req,
      async (id) => deSesion((await model.findById(id, { sesion: 1 }).lean())?.sesion),
      "sesion",
      deSesion,
    ),

  bien: (req) => combinar(req, deBien, "departamento"),

  evento: (req) =>
    combinar(req, async (id) => id && texto((await EventoModel.findById(id, { departamento: 1 }).lean())?.departamento), "departamento"),

  /** Generar sesiones: departamentos de los servicios indicados (o de todos, si no se indican). */
  generarSesiones: async (req) => {
    const ids = req.body?.servicios;
    const servicios = await ServicioModel.find(ids?.length ? { _id: { $in: ids } } : {}, { departament: 1 }).lean();
    return servicios.length ? servicios.map((s) => texto(s.departament)) : [null];
  },
  // /inventario/:id/movimientos
  movimientoBien: async (req) => [await deBien(req.params.id)],
};
