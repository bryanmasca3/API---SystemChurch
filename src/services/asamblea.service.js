import Boom from "@hapi/boom";
import mongoose from "mongoose";
import BaseService from "./base.service.js";
import { AsambleaModel } from "../models/asamblea.model.js";
import { MiembroModel } from "../models/miembro.model.js";
import { calcularHabiles, criteriosPorDefecto } from "./habiles.service.js";
import { siguienteNumero } from "./actas.service.js";
import { construirFiltroFechas } from "./filtros.js";
import { bitacoraCrear, registrarEnBitacora } from "./auditoria.js";

/** Quórum: mitad más uno de los miembros hábiles. */
const quorum = (totalHabiles, asistentesHabiles) => {
  const minimo = Math.floor(totalHabiles / 2) + 1;
  return { total_habiles: totalHabiles, asistentes_habiles: asistentesHabiles, minimo, hay_quorum: totalHabiles > 0 && asistentesHabiles >= minimo };
};

class AsambleaService extends BaseService {
  constructor() {
    super(AsambleaModel, {
      nombre: "Asamblea",
      orden: { fecha: -1 },
      paginado: true,
      populate: [{ path: "asistentes.miembro", select: "person", populate: { path: "person", select: "name surname" } }],
    });
  }

  construirFiltro({ tipo, desde, hasta } = {}) {
    return { ...(tipo && { tipo }), ...construirFiltroFechas(desde, hasta, "fecha") };
  }

  async conQuorum(asamblea) {
    const total = asamblea.habiles_congelados
      ? asamblea.habiles.length
      : (await calcularHabiles(asamblea.fecha, asamblea.criterios)).total_habiles;
    const obj = asamblea.toJSON();
    obj.quorum = quorum(total, asamblea.asistentes.filter((a) => a.habil).length);
    return obj;
  }

  async obtener(id) {
    return this.conQuorum(await super.obtener(id));
  }

  async crear(data, usuarioId) {
    const criterios = { ...criteriosPorDefecto(), ...(data.criterios ?? {}) };
    const id = await mongoose.connection.transaction(async (session) => {
      const numero = await siguienteNumero("asamblea", session);
      const [a] = await AsambleaModel.create([{ ...data, criterios, numero, registrado_por: usuarioId }], { session });
      return a._id;
    });
    const asamblea = await super.obtener(id);
    await bitacoraCrear(this.nombre, asamblea);
    return this.conQuorum(asamblea);
  }

  async actualizar(id, data) {
    const actual = await AsambleaModel.findById(id).lean();
    if (!actual) throw this.noEncontrado();
    if (actual.habiles_congelados && (data.criterios || data.fecha)) {
      throw Boom.conflict("El padrón de hábiles está congelado: no se pueden cambiar la fecha ni los criterios");
    }
    if (data.criterios) data.criterios = { ...actual.criterios, ...data.criterios };
    await super.actualizar(id, data);
    return this.obtener(id);
  }

  async eliminar(id) {
    const a = await AsambleaModel.findById(id).lean();
    if (!a) throw this.noEncontrado();
    if (a.asistentes.length) throw Boom.conflict("No se puede eliminar: la asamblea ya tiene asistentes registrados");
    return super.eliminar(id);
  }

  /** Lista de hábiles con el detalle de cada requisito. Si está congelada, respeta esa lista. */
  async habiles(id) {
    const a = await AsambleaModel.findById(id).lean();
    if (!a) throw this.noEncontrado();
    const calculo = await calcularHabiles(a.fecha, a.criterios);
    if (!a.habiles_congelados) return { congelado: false, ...calculo };

    const congelados = new Set(a.habiles.map(String));
    const miembros = calculo.miembros.map((m) => ({ ...m, habil: congelados.has(String(m.miembro)) }));
    return { congelado: true, ...calculo, total_habiles: congelados.size, miembros };
  }

  /** Fija el padrón de hábiles de esta asamblea (antes de registrar asistentes). */
  async congelar(id) {
    const a = await AsambleaModel.findById(id);
    if (!a) throw this.noEncontrado();
    if (a.habiles_congelados) throw Boom.conflict("El padrón de hábiles ya está congelado");
    if (a.asistentes.length) throw Boom.conflict("Congela el padrón antes de registrar asistentes");
    const calculo = await calcularHabiles(a.fecha, a.criterios);
    a.habiles = calculo.miembros.filter((m) => m.habil).map((m) => m.miembro);
    a.habiles_congelados = true;
    await a.save();
    await registrarEnBitacora({
      accion: "actualizar",
      recurso: this.nombre,
      documento: a._id,
      resumen: `Padrón de hábiles congelado: ${a.habiles.length} de ${calculo.total_miembros} miembros`,
    });
    return this.habiles(id);
  }

  /** Registra la asistencia de un miembro (indicando si es hábil para votar). */
  async registrarAsistente(id, miembroId) {
    const a = await AsambleaModel.findById(id);
    if (!a) throw this.noEncontrado();
    if (!(await MiembroModel.exists({ _id: miembroId }))) throw Boom.badRequest("No existe: miembro");
    if (a.asistentes.some((x) => String(x.miembro) === String(miembroId))) {
      throw Boom.conflict("El miembro ya está registrado como asistente");
    }
    const habil = a.habiles_congelados
      ? a.habiles.some((h) => String(h) === String(miembroId))
      : (await calcularHabiles(a.fecha, a.criterios, { soloMiembros: [miembroId] })).miembros[0]?.habil ?? false;
    a.asistentes.push({ miembro: miembroId, habil });
    await a.save();
    return this.obtener(id);
  }

  async quitarAsistente(id, miembroId) {
    const r = await AsambleaModel.updateOne({ _id: id }, { $pull: { asistentes: { miembro: miembroId } } });
    if (!r.matchedCount) throw this.noEncontrado();
    if (!r.modifiedCount) throw Boom.notFound("El miembro no está registrado como asistente");
    return this.obtener(id);
  }
}

export default AsambleaService;
