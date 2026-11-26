import Boom from "@hapi/boom";
import BaseService from "./base.service.js";
import PersonaService from "./persona.service.js";
import { MiembroModel } from "../models/miembro.model.js";
import { PersonaModel } from "../models/persona.model.js";
import { EstadoModel, TipoMembresiaModel } from "../models/catalogo.model.js";
import { RolLimpiezaModel } from "../models/rolLimpieza.model.js";
import { ReunionMiembroModel } from "../models/reunionMiembro.model.js";
import { MiembroDepartamentoModel } from "../models/miembroDepartamento.model.js";
import { AsistenciaSantaCenaModel } from "../models/asistenciaSantaCena.model.js";
import { AdherenteModel } from "../models/adherente.model.js";
import { UsuarioModel } from "../models/usuario.model.js";
import { BienModel } from "../models/bien.model.js";
import { MovimientoFinancieroModel } from "../models/movimientoFinanciero.model.js";
import { EventoMembresiaModel, ESTADO_POR_EVENTO } from "../models/eventoMembresia.model.js";
import { ActaBautismoModel, ActaDisciplinaModel } from "../models/actas.model.js";
import { OficialModel } from "../models/oficial.model.js";
import { VisitaModel, CasoDiaconiaModel, SeguimientoModel } from "../models/pastoral.model.js";
import { SesionServicioModel } from "../models/sesionServicio.model.js";
import { EventoModel } from "../models/evento.model.js";
import { registrarEvento, estadoPorNombre } from "./membresia.service.js";

const personaService = new PersonaService();

class MiembroService extends BaseService {
  constructor() {
    super(MiembroModel, {
      nombre: "Miembro",
      orden: { createdAt: -1 },
      paginado: true,
      populate: ["person", "state", "typemembership"],
      referencias: [
        { campo: "state", model: EstadoModel, nombre: "estado" },
        { campo: "typemembership", model: TipoMembresiaModel, nombre: "tipo de membresía" },
        { campo: "person", model: PersonaModel, nombre: "persona" },
      ],
      dependencias: [
        { model: RolLimpiezaModel, campo: "membermain", nombre: "el rol de limpieza" },
        { model: ReunionMiembroModel, campo: "member", nombre: "asistencias a reuniones" },
        { model: MiembroDepartamentoModel, campo: "member", nombre: "un departamento" },
        { model: AsistenciaSantaCenaModel, campo: "miembro", nombre: "asistencias a Santa Cena" },
        { model: AdherenteModel, campo: "relation", nombre: "adherentes invitados" },
        { model: UsuarioModel, campo: "miembro", nombre: "una cuenta de usuario" },
        { model: BienModel, campo: "encargado", nombre: "bienes del inventario a su cargo" },
        { model: MovimientoFinancieroModel, campo: "miembro", nombre: "diezmos registrados" },
        { model: ActaBautismoModel, campo: "miembro", nombre: "un acta de bautismo" },
        { model: ActaDisciplinaModel, campo: "miembro", nombre: "actas de disciplina" },
        { model: OficialModel, campo: "miembro", nombre: "periodos como oficial de la iglesia" },
        { model: VisitaModel, campo: "visitantes", nombre: "visitas pastorales (como visitante)" },
        { model: CasoDiaconiaModel, campo: "responsable", nombre: "casos de diaconía a su cargo" },
        { model: SeguimientoModel, campo: "discipulador", nombre: "personas que discipula" },
        { model: SeguimientoModel, campo: "invitado_por", nombre: "personas que invitó (seguimiento)" },
        { model: SesionServicioModel, campo: "programa.director.miembro", nombre: "programas de culto (director)" },
        { model: SesionServicioModel, campo: "programa.predicador.miembro", nombre: "programas de culto (predicador)" },
        { model: SesionServicioModel, campo: "programa.lectura_biblica.miembro", nombre: "programas de culto (lectura bíblica)" },
        { model: EventoModel, campo: "responsable", nombre: "eventos a su cargo" },
      ],
    });
  }

  /**
   * Crea un miembro. `person` puede ser:
   *  - el id de una persona existente, o
   *  - los datos de una persona nueva (se crea primero).
   * `ingreso` (opcional) registra cómo llegó (traslado recibido, reafirmación de fe) y define
   * su estado; sin `ingreso` se usa `state` y queda un evento "registro" en el historial.
   * Si algo falla, se revierte lo creado.
   */
  async crear({ person, ingreso, ...datosMiembro }, usuarioId) {
    if (ingreso) {
      datosMiembro.state = (await estadoPorNombre(ESTADO_POR_EVENTO[ingreso.tipo]))._id;
    }

    let personaCreada = null;
    if (typeof person !== "object" || person === null) {
      if (await MiembroModel.exists({ person })) {
        throw Boom.conflict("Esa persona ya está registrada como miembro");
      }
    } else {
      personaCreada = await personaService.crear(person);
      person = personaCreada._id;
    }

    let miembro;
    try {
      miembro = await super.crear({ ...datosMiembro, person });
      await registrarEvento(
        ingreso
          ? { ...ingreso, miembro: miembro._id }
          : { miembro: miembro._id, tipo: "registro", fecha: new Date(), observacion: "Alta en el sistema" },
        { usuarioId },
      );
      return miembro;
    } catch (error) {
      if (miembro) {
        await MiembroModel.findByIdAndDelete(miembro._id);
        await EventoMembresiaModel.deleteMany({ miembro: miembro._id });
      }
      if (personaCreada) await PersonaModel.findByIdAndDelete(personaCreada._id);
      throw error;
    }
  }

  /** Al eliminar un miembro (sin actas ni otros vínculos) se borra también su historial. */
  async eliminar(id) {
    const doc = await super.eliminar(id);
    await EventoMembresiaModel.deleteMany({ miembro: id });
    return doc;
  }
}

export default MiembroService;
