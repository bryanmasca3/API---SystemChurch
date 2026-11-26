/**
 * Libro de registros eclesiásticos: bautismos (adultos), matrimonios y disciplinas.
 * - Número correlativo por tipo, asignado dentro de la misma transacción (sin huecos ni repetidos).
 * - Las actas no se borran: se anulan con motivo (el número queda usado).
 * - Disciplina: confidencial; la bitácora no guarda el motivo.
 */
import Boom from "@hapi/boom";
import mongoose from "mongoose";
import BaseService from "./base.service.js";
import {
  ActaBautismoModel,
  ActaMatrimonioModel,
  ActaDisciplinaModel,
  ActaDedicacionModel,
  ContadorModel,
} from "../models/actas.model.js";
import { PersonaModel } from "../models/persona.model.js";
import { MiembroModel } from "../models/miembro.model.js";
import { FamiliaModel } from "../models/familia.model.js";
import { EventoMembresiaModel } from "../models/eventoMembresia.model.js";
import { registrarEvento, estadoPorNombre } from "./membresia.service.js";
import { construirFiltroFechas } from "./filtros.js";
import { bitacoraCrear, registrarEnBitacora } from "./auditoria.js";
import { marcarIntegradoPorBautismo } from "./pastoral.service.js";

const transaccion = (fn) => mongoose.connection.transaction(fn);

/** Siguiente número del libro (dentro de la transacción: si falla, el número no se consume). */
export async function siguienteNumero(libro, session) {
  const c = await ContadorModel.findOneAndUpdate(
    { _id: libro },
    { $inc: { secuencia: 1 } },
    { upsert: true, new: true, session },
  );
  return c.secuencia;
}

/** `persona` puede ser un id existente o los datos de una persona nueva. */
async function resolverPersona(persona, session, etiqueta = "persona") {
  if (persona && typeof persona === "object") {
    const [creada] = await PersonaModel.create([persona], { session });
    return creada._id;
  }
  if (!(await PersonaModel.exists({ _id: persona }).session(session))) {
    throw Boom.badRequest(`No existe: ${etiqueta}`);
  }
  return persona;
}

const POP_PERSONA = "name surname doi dob";
const POP_ANULACION = { path: "anulacion.usuario", select: "nombre" };

/** Base común: listado con filtro de anuladas y anulación con motivo. */
class LibroService extends BaseService {
  construirFiltroBase({ desde, hasta, incluir_anuladas } = {}) {
    return { ...(!incluir_anuladas && { anulada: false }), ...construirFiltroFechas(desde, hasta, "fecha") };
  }

  async marcarAnulada(id, motivo, usuarioId, session) {
    const acta = await this.model.findById(id, null, { session });
    if (!acta) throw this.noEncontrado();
    if (acta.anulada) throw Boom.conflict("El acta ya está anulada");
    acta.anulada = true;
    acta.anulacion = { fecha: new Date(), motivo, usuario: usuarioId };
    await acta.save({ session });
    return acta;
  }
}

// ---------------------------------------------------------------------------
export class BautismoService extends LibroService {
  constructor() {
    super(ActaBautismoModel, {
      nombre: "Acta de bautismo",
      orden: { numero: -1 },
      paginado: true,
      populate: [{ path: "persona", select: POP_PERSONA }, { path: "registrado_por", select: "nombre" }, POP_ANULACION],
    });
  }

  construirFiltro({ persona, ...resto } = {}) {
    return { ...this.construirFiltroBase(resto), ...(persona && { persona }) };
  }

  /** Registra el bautismo y admite a la persona como miembro (o actualiza al miembro existente). */
  async crear(data, usuarioId) {
    const id = await transaccion(async (session) => {
      const persona = await resolverPersona(data.persona, session);
      const previa = await ActaBautismoModel.findOne({ persona, anulada: false }, { numero: 1 }, { session }).lean();
      if (previa) throw Boom.conflict(`Esta persona ya tiene el acta de bautismo N.º ${previa.numero}`);

      const numero = await siguienteNumero("bautismo", session);
      let miembro = await MiembroModel.findOne({ person: persona }, null, { session });
      const esNuevo = !miembro;
      if (esNuevo) {
        const activo = await estadoPorNombre("ACTIVO", session);
        [miembro] = await MiembroModel.create(
          [{ person: persona, state: activo._id, datebaptism: data.fecha, placebaptism: data.lugar }],
          { session },
        );
      } else {
        miembro.datebaptism = data.fecha;
        miembro.placebaptism = data.lugar;
        await miembro.save({ session });
      }

      const [acta] = await ActaBautismoModel.create(
        [{ ...data, persona, miembro: miembro._id, numero, registrado_por: usuarioId }],
        { session },
      );
      await registrarEvento(
        {
          miembro: miembro._id,
          tipo: "admision_bautismo",
          fecha: data.fecha,
          observacion: `Bautismo N.º ${numero}`,
          acta: acta._id,
        },
        // Un bautismo antiguo de un miembro ya registrado queda como dato histórico
        { session, usuarioId, esNuevo, permitirHistorico: true },
      );
      return acta._id;
    });
    const acta = await this.obtener(id);
    await bitacoraCrear(this.nombre, acta);
    // Si estaba en seguimiento de evangelismo/discipulado, pasa a "integrado"
    await marcarIntegradoPorBautismo(acta.persona._id, acta.numero, acta.fecha);
    return acta;
  }

  async actualizar(id, data) {
    const acta = await super.actualizar(id, data);
    if ("lugar" in data && acta.miembro) await MiembroModel.updateOne({ _id: acta.miembro }, { placebaptism: data.lugar });
    return acta;
  }

  async anular(id, motivo, usuarioId) {
    await transaccion(async (session) => {
      const acta = await this.marcarAnulada(id, motivo, usuarioId, session);
      if (acta.miembro) {
        await MiembroModel.updateOne({ _id: acta.miembro }, { $unset: { datebaptism: "", placebaptism: "" } }, { session });
      }
    });
    await registrarEnBitacora({ accion: "actualizar", recurso: this.nombre, documento: id, resumen: `Anulada: ${motivo}` });
    return this.obtener(id);
  }
}

// ---------------------------------------------------------------------------
const apellido = (surname = "") => surname.trim().split(/\s+/)[0] ?? "";

export class MatrimonioService extends LibroService {
  constructor() {
    super(ActaMatrimonioModel, {
      nombre: "Acta de matrimonio",
      orden: { numero: -1 },
      paginado: true,
      populate: [
        { path: "contrayente1", select: POP_PERSONA },
        { path: "contrayente2", select: POP_PERSONA },
        { path: "familia", select: "nombre" },
        { path: "registrado_por", select: "nombre" },
        POP_ANULACION,
      ],
    });
  }

  construirFiltro({ persona, ...resto } = {}) {
    return {
      ...this.construirFiltroBase(resto),
      ...(persona && { $or: [{ contrayente1: persona }, { contrayente2: persona }] }),
    };
  }

  /**
   * Enlaza a los contrayentes como cónyuges: si ninguno tiene familia se crea una;
   * si solo uno la tiene, el otro se suma como cónyuge. Si están en familias distintas no se toca nada.
   */
  async enlazarFamilia(c1, c2, session) {
    const [f1, f2] = await Promise.all([
      FamiliaModel.findOne({ "integrantes.persona": c1 }, null, { session }),
      FamiliaModel.findOne({ "integrantes.persona": c2 }, null, { session }),
    ]);
    if (f1 && f2) {
      return String(f1._id) === String(f2._id)
        ? { familia: f1._id }
        : { familia: null, aviso: `Los contrayentes están en familias distintas ("${f1.nombre}" y "${f2.nombre}"): únelos manualmente` };
    }
    if (f1 || f2) {
      const familia = f1 ?? f2;
      familia.integrantes.push({ persona: f1 ? c2 : c1, parentesco: "conyuge" });
      await familia.save({ session });
      return { familia: familia._id };
    }
    const [p1, p2] = await Promise.all([
      PersonaModel.findById(c1, { surname: 1 }, { session }).lean(),
      PersonaModel.findById(c2, { surname: 1 }, { session }).lean(),
    ]);
    const [nueva] = await FamiliaModel.create(
      [
        {
          nombre: `Familia ${apellido(p1.surname)} ${apellido(p2.surname)}`.trim(),
          integrantes: [
            { persona: c1, parentesco: "cabeza" },
            { persona: c2, parentesco: "conyuge" },
          ],
        },
      ],
      { session },
    );
    return { familia: nueva._id };
  }

  async crear(data, usuarioId) {
    let aviso;
    const id = await transaccion(async (session) => {
      const c1 = await resolverPersona(data.contrayente1, session, "contrayente 1");
      const c2 = await resolverPersona(data.contrayente2, session, "contrayente 2");
      if (String(c1) === String(c2)) throw Boom.badRequest("Los contrayentes deben ser personas distintas");
      const repetida = await ActaMatrimonioModel.findOne(
        { anulada: false, $or: [{ contrayente1: c1, contrayente2: c2 }, { contrayente1: c2, contrayente2: c1 }] },
        { numero: 1 },
        { session },
      ).lean();
      if (repetida) throw Boom.conflict(`Este matrimonio ya está registrado (acta N.º ${repetida.numero})`);

      const numero = await siguienteNumero("matrimonio", session);
      const enlace = await this.enlazarFamilia(c1, c2, session);
      aviso = enlace.aviso;
      const [acta] = await ActaMatrimonioModel.create(
        [{ ...data, contrayente1: c1, contrayente2: c2, numero, familia: enlace.familia, registrado_por: usuarioId }],
        { session },
      );
      return acta._id;
    });
    const acta = await this.obtener(id);
    await bitacoraCrear(this.nombre, acta);
    return aviso ? { ...acta.toJSON(), aviso_familia: aviso } : acta;
  }

  async anular(id, motivo, usuarioId) {
    await transaccion((session) => this.marcarAnulada(id, motivo, usuarioId, session));
    await registrarEnBitacora({ accion: "actualizar", recurso: this.nombre, documento: id, resumen: `Anulada: ${motivo}` });
    return this.obtener(id);
  }
}

// ---------------------------------------------------------------------------
/** Dedicación de niños: los padres presentan al niño (distinto del bautismo). */
export class DedicacionService extends LibroService {
  constructor() {
    super(ActaDedicacionModel, {
      nombre: "Acta de dedicación",
      orden: { numero: -1 },
      paginado: true,
      populate: [
        { path: "nino", select: POP_PERSONA },
        { path: "padres", select: POP_PERSONA },
        { path: "familia", select: "nombre" },
        { path: "registrado_por", select: "nombre" },
        POP_ANULACION,
      ],
    });
  }

  construirFiltro({ persona, ...resto } = {}) {
    return { ...this.construirFiltroBase(resto), ...(persona && { $or: [{ nino: persona }, { padres: persona }] }) };
  }

  /**
   * Suma al niño (como hijo) y a los padres a una familia: la de algún padre, o la del niño,
   * o una nueva. Quien ya esté en OTRA familia no se mueve (se devuelve un aviso).
   */
  async enlazarFamilia(nino, padres, session) {
    const personas = [...padres, nino];
    const familias = await FamiliaModel.find({ "integrantes.persona": { $in: personas } }, null, { session });
    const familiaDe = (id) => familias.find((f) => f.integrantes.some((i) => String(i.persona) === String(id)));
    let familia = padres.map(familiaDe).find(Boolean) ?? familiaDe(nino);

    if (!familia) {
      const p1 = await PersonaModel.findById(padres[0], { surname: 1 }, { session }).lean();
      [familia] = await FamiliaModel.create([{ nombre: `Familia ${apellido(p1.surname)}`, integrantes: [] }], { session });
    }
    const avisos = [];
    for (const [id, parentesco] of [...padres.map((p) => [p, null]), [nino, "hijo"]]) {
      const actual = familiaDe(id);
      if (actual && String(actual._id) !== String(familia._id)) {
        avisos.push(`Una de las personas ya pertenece a la familia "${actual.nombre}"`);
        continue;
      }
      if (familia.integrantes.some((i) => String(i.persona) === String(id))) continue;
      const tieneCabeza = familia.integrantes.some((i) => i.parentesco === "cabeza");
      familia.integrantes.push({ persona: id, parentesco: parentesco ?? (tieneCabeza ? "conyuge" : "cabeza") });
    }
    await familia.save({ session });
    return { familia: familia._id, aviso: avisos.length ? [...new Set(avisos)].join("; ") : undefined };
  }

  async crear(data, usuarioId) {
    let aviso;
    const id = await transaccion(async (session) => {
      const nino = await resolverPersona(data.nino, session, "niño");
      const padres = [];
      for (const p of data.padres) padres.push(await resolverPersona(p, session, "padre o madre"));
      if (padres.some((p) => String(p) === String(nino))) throw Boom.badRequest("El niño no puede ser su propio padre o madre");
      if (new Set(padres.map(String)).size !== padres.length) throw Boom.badRequest("Los padres deben ser personas distintas");
      const previa = await ActaDedicacionModel.findOne({ nino, anulada: false }, { numero: 1 }, { session }).lean();
      if (previa) throw Boom.conflict(`Este niño ya tiene el acta de dedicación N.º ${previa.numero}`);

      const numero = await siguienteNumero("dedicacion", session);
      const enlace = await this.enlazarFamilia(nino, padres, session);
      aviso = enlace.aviso;
      const [acta] = await ActaDedicacionModel.create(
        [{ ...data, nino, padres, numero, familia: enlace.familia, registrado_por: usuarioId }],
        { session },
      );
      return acta._id;
    });
    const acta = await this.obtener(id);
    await bitacoraCrear(this.nombre, acta);
    return aviso ? { ...acta.toJSON(), aviso_familia: aviso } : acta;
  }

  async anular(id, motivo, usuarioId) {
    await transaccion((session) => this.marcarAnulada(id, motivo, usuarioId, session));
    await registrarEnBitacora({ accion: "actualizar", recurso: this.nombre, documento: id, resumen: `Anulada: ${motivo}` });
    return this.obtener(id);
  }
}

// ---------------------------------------------------------------------------
const EVENTO_POR_MEDIDA = {
  suspension_santa_cena: "disciplina_suspension",
  exclusion: "disciplina_exclusion",
};

/** Actas de disciplina. CONFIDENCIAL: la bitácora solo registra que existen, nunca el motivo. */
export class DisciplinaService extends LibroService {
  constructor() {
    super(ActaDisciplinaModel, {
      nombre: "Acta de disciplina",
      orden: { numero: -1 },
      paginado: true,
      populate: [
        { path: "miembro", select: "person state", populate: [{ path: "person", select: "name surname" }, { path: "state", select: "description" }] },
        { path: "registrado_por", select: "nombre" },
        POP_ANULACION,
      ],
      auditar: false,
    });
  }

  construirFiltro({ miembro, estado, medida, ...resto } = {}) {
    return {
      ...this.construirFiltroBase(resto),
      ...(miembro && { miembro }),
      ...(estado && { estado }),
      ...(medida && { medida }),
    };
  }

  async crear(data, usuarioId) {
    const id = await transaccion(async (session) => {
      if (!(await MiembroModel.exists({ _id: data.miembro }).session(session))) throw Boom.badRequest("No existe: miembro");
      const tipoEvento = EVENTO_POR_MEDIDA[data.medida];
      if (tipoEvento) {
        const vigente = await ActaDisciplinaModel.findOne(
          { miembro: data.miembro, estado: "vigente", anulada: false },
          { numero: 1 },
          { session },
        ).lean();
        if (vigente) throw Boom.conflict(`El miembro ya tiene una medida vigente (acta N.º ${vigente.numero}): restáurala primero`);
      }

      const numero = await siguienteNumero("disciplina", session);
      const [acta] = await ActaDisciplinaModel.create(
        [{ ...data, numero, estado: tipoEvento ? "vigente" : "registrada", registrado_por: usuarioId }],
        { session },
      );
      // La amonestación no cambia el estado del miembro
      if (tipoEvento) {
        await registrarEvento(
          {
            miembro: data.miembro,
            tipo: tipoEvento,
            fecha: data.fecha,
            acta_consistorio: data.acta_consistorio,
            observacion: `Por acta de disciplina N.º ${numero}`,
            acta: acta._id,
          },
          { session, usuarioId },
        );
      }
      return acta._id;
    });
    const acta = await this.obtener(id);
    await registrarEnBitacora({
      accion: "crear",
      recurso: this.nombre,
      documento: id,
      resumen: `Acta de disciplina N.º ${acta.numero} registrada`,
    });
    return acta;
  }

  /** Estado que tenía el miembro antes de la medida (para devolverlo al restaurar o anular). */
  async estadoPrevio(actaId, session) {
    const evento = await EventoMembresiaModel.findOne(
      { acta: actaId, tipo: { $in: Object.values(EVENTO_POR_MEDIDA) } },
      { estado_anterior: 1 },
      { session },
    ).lean();
    return evento?.estado_anterior ?? (await estadoPorNombre("ACTIVO", session))._id;
  }

  async restaurar(id, data, usuarioId) {
    await transaccion(async (session) => {
      const acta = await ActaDisciplinaModel.findById(id, null, { session });
      if (!acta || acta.anulada) throw this.noEncontrado();
      if (acta.estado !== "vigente") throw Boom.conflict("Esta acta no tiene una medida vigente que levantar");
      if (new Date(data.fecha) < acta.fecha) throw Boom.badRequest("La restauración no puede ser anterior a la medida");

      acta.estado = "levantada";
      acta.restauracion = data;
      await acta.save({ session });
      await registrarEvento(
        {
          miembro: acta.miembro,
          tipo: "restauracion",
          fecha: data.fecha,
          acta_consistorio: data.acta_consistorio,
          observacion: `Restauración (acta de disciplina N.º ${acta.numero})`,
          acta: acta._id,
        },
        { session, usuarioId, estadoForzado: await this.estadoPrevio(acta._id, session) },
      );
    });
    await registrarEnBitacora({ accion: "actualizar", recurso: this.nombre, documento: id, resumen: "Restauración registrada" });
    return this.obtener(id);
  }

  async actualizar(id, data) {
    const acta = await super.actualizar(id, data);
    await registrarEnBitacora({ accion: "actualizar", recurso: this.nombre, documento: id, resumen: `Editados: ${Object.keys(data).join(", ")}` });
    return acta;
  }

  /** Anular una medida vigente devuelve al miembro a su estado previo. */
  async anular(id, motivo, usuarioId) {
    await transaccion(async (session) => {
      const acta = await this.marcarAnulada(id, motivo, usuarioId, session);
      if (acta.estado === "vigente") {
        await registrarEvento(
          {
            miembro: acta.miembro,
            tipo: "restauracion",
            fecha: new Date(),
            observacion: `Anulación del acta de disciplina N.º ${acta.numero}`,
            acta: acta._id,
          },
          { session, usuarioId, estadoForzado: await this.estadoPrevio(acta._id, session) },
        );
      }
    });
    await registrarEnBitacora({ accion: "actualizar", recurso: this.nombre, documento: id, resumen: "Acta anulada" });
    return this.obtener(id);
  }
}
