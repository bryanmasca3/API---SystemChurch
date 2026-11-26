import Boom from "@hapi/boom";
import BaseService from "./base.service.js";
import { PersonaModel } from "../models/persona.model.js";
import { GeneroModel, EstadoCivilModel } from "../models/catalogo.model.js";
import {
  UbigeoDepartamentoModel,
  UbigeoProvinciaModel,
  UbigeoDistritoModel,
} from "../models/ubigeo.model.js";
import { MiembroModel } from "../models/miembro.model.js";
import { AdherenteModel } from "../models/adherente.model.js";
import { AsistenciaModel } from "../models/asistencia.model.js";
import { MovimientoInventarioModel } from "../models/movimientoInventario.model.js";
import { regexBusqueda } from "./filtros.js";
import { FamiliaModel } from "../models/familia.model.js";
import { ActaBautismoModel, ActaMatrimonioModel, ActaDedicacionModel } from "../models/actas.model.js";
import { InscripcionModel } from "../models/inscripcion.model.js";
import { DonModel } from "../models/catalogo.model.js";
import { VisitaModel, CasoDiaconiaModel, PeticionOracionModel, SeguimientoModel } from "../models/pastoral.model.js";

// Los dos grupos de ubigeo de una persona: lugar de nacimiento y domicilio
const GRUPOS_UBIGEO = [
  { etiqueta: "nacimiento", dep: "departamentdob", prov: "provincedob", dist: "districtdob" },
  { etiqueta: "domicilio", dep: "departament", prov: "province", dist: "district" },
];


class PersonaService extends BaseService {
  constructor() {
    super(PersonaModel, {
      nombre: "Persona",
      orden: { surname: 1, name: 1 },
      paginado: true,
      populate: ["gender", "civilstatus"],
      referencias: [
        { campo: "gender", model: GeneroModel, nombre: "género" },
        { campo: "civilstatus", model: EstadoCivilModel, nombre: "estado civil" },
        { campo: "departamentdob", model: UbigeoDepartamentoModel, nombre: "departamento de nacimiento" },
        { campo: "provincedob", model: UbigeoProvinciaModel, nombre: "provincia de nacimiento" },
        { campo: "districtdob", model: UbigeoDistritoModel, nombre: "distrito de nacimiento" },
        { campo: "departament", model: UbigeoDepartamentoModel, nombre: "departamento" },
        { campo: "province", model: UbigeoProvinciaModel, nombre: "provincia" },
        { campo: "district", model: UbigeoDistritoModel, nombre: "distrito" },
      ],
      dependencias: [
        { model: MiembroModel, campo: "person", nombre: "un miembro" },
        { model: AdherenteModel, campo: "person", nombre: "un adherente" },
        { model: AsistenciaModel, campo: "person", nombre: "registros de asistencia" },
        { model: MovimientoInventarioModel, campo: "persona", nombre: "préstamos o donaciones del inventario" },
        { model: FamiliaModel, campo: "integrantes.persona", nombre: "una familia (quítala de la familia primero)" },
        { model: ActaBautismoModel, campo: "persona", nombre: "un acta de bautismo" },
        { model: ActaMatrimonioModel, campo: "contrayente1", nombre: "un acta de matrimonio" },
        { model: ActaMatrimonioModel, campo: "contrayente2", nombre: "un acta de matrimonio" },
        { model: ActaDedicacionModel, campo: "nino", nombre: "un acta de dedicación" },
        { model: ActaDedicacionModel, campo: "padres", nombre: "un acta de dedicación (como padre o madre)" },
        { model: InscripcionModel, campo: "persona", nombre: "una inscripción en un ministerio" },
        { model: InscripcionModel, campo: "apoderado", nombre: "inscripciones (como apoderado)" },
        { model: VisitaModel, campo: "persona", nombre: "visitas pastorales" },
        { model: CasoDiaconiaModel, campo: "persona", nombre: "casos de diaconía" },
        { model: PeticionOracionModel, campo: "persona", nombre: "peticiones de oración" },
        { model: SeguimientoModel, campo: "persona", nombre: "un seguimiento de discipulado" },
      ],
    });
  }

  /** Filtros: nombre/apellido/documento, don, capacidad, profesión y grado de instrucción. */
  construirFiltro({ buscar, don, capacidad, profesion, grado_instruccion } = {}) {
    return {
      ...(buscar && {
        $or: [{ name: regexBusqueda(buscar) }, { surname: regexBusqueda(buscar) }, { doi: regexBusqueda(buscar) }],
      }),
      ...(don && { dones: don }),
      ...(capacidad && { capacidades: regexBusqueda(capacidad) }),
      ...(profesion && { $and: [{ $or: [{ profesion: regexBusqueda(profesion) }, { ocupacion: regexBusqueda(profesion) }] }] }),
      ...(grado_instruccion && { grado_instruccion }),
    };
  }

  async validarDones(dones) {
    if (!dones?.length) return;
    const existentes = await DonModel.countDocuments({ _id: { $in: dones } });
    if (existentes !== dones.length) throw Boom.badRequest("No existe: alguno de los dones");
  }

  /**
   * Registro de dones, capacidades y profesiones: cuántas personas y quiénes tienen cada uno
   * (para formar equipos de servicio).
   */
  async resumenDones() {
    const persona = { $concat: ["$surname", ", ", "$name"] };
    const agrupar = (campo) => [
      { $unwind: `$${campo}` },
      { $group: { _id: `$${campo}`, cantidad: { $sum: 1 }, personas: { $push: { _id: "$_id", nombre: persona } } } },
      { $sort: { cantidad: -1, _id: 1 } },
    ];
    const [porDon, porCapacidad, porProfesion, porGrado] = await Promise.all([
      PersonaModel.aggregate([
        ...agrupar("dones"),
        { $lookup: { from: DonModel.collection.name, localField: "_id", foreignField: "_id", as: "d" } },
        { $project: { _id: 0, don: { $first: "$d.description" }, cantidad: 1, personas: 1 } },
      ]),
      PersonaModel.aggregate([...agrupar("capacidades"), { $project: { _id: 0, capacidad: "$_id", cantidad: 1, personas: 1 } }]),
      PersonaModel.aggregate([
        { $match: { profesion: { $nin: [null, ""] } } },
        { $group: { _id: "$profesion", cantidad: { $sum: 1 }, personas: { $push: { _id: "$_id", nombre: persona } } } },
        { $sort: { cantidad: -1, _id: 1 } },
        { $project: { _id: 0, profesion: "$_id", cantidad: 1, personas: 1 } },
      ]),
      PersonaModel.aggregate([
        { $group: { _id: { $ifNull: ["$grado_instruccion", "sin_dato"] }, cantidad: { $sum: 1 } } },
        { $project: { _id: 0, grado: "$_id", cantidad: 1 } },
      ]),
    ]);
    return { dones: porDon, capacidades: porCapacidad, profesiones: porProfesion, grado_instruccion: porGrado };
  }

  /**
   * Verifica que distrito ⊂ provincia ⊂ departamento en cada grupo.
   * `actual` son los valores ya guardados (al actualizar solo llega lo que cambia).
   */
  async validarUbigeo(data, actual = {}) {
    for (const { etiqueta, dep, prov, dist } of GRUPOS_UBIGEO) {
      const tocaGrupo = [dep, prov, dist].some((campo) => campo in data);
      if (!tocaGrupo) continue;

      const valor = (campo) => (campo in data ? data[campo] : actual[campo]);
      const [departamento, provincia, distrito] = await Promise.all([
        valor(dep) && UbigeoDepartamentoModel.findById(valor(dep)).lean(),
        valor(prov) && UbigeoProvinciaModel.findById(valor(prov)).lean(),
        valor(dist) && UbigeoDistritoModel.findById(valor(dist)).lean(),
      ]);

      if (departamento && provincia && provincia.id_padre_ubigeo !== departamento.id_ubigeo) {
        throw Boom.badRequest(
          `La provincia de ${etiqueta} (${provincia.nombre_ubigeo}) no pertenece al departamento ${departamento.nombre_ubigeo}`,
        );
      }
      if (provincia && distrito && distrito.id_padre_ubigeo !== provincia.id_ubigeo) {
        throw Boom.badRequest(
          `El distrito de ${etiqueta} (${distrito.nombre_ubigeo}) no pertenece a la provincia ${provincia.nombre_ubigeo}`,
        );
      }
    }
  }

  async crear(data) {
    await this.validarUbigeo(data);
    await this.validarDones(data.dones);
    return super.crear(data);
  }

  async actualizar(id, data) {
    const actual = await PersonaModel.findById(id).lean();
    if (!actual) throw this.noEncontrado();
    await this.validarUbigeo(data, actual);
    await this.validarDones(data.dones);
    return super.actualizar(id, data);
  }
}

export default PersonaService;
