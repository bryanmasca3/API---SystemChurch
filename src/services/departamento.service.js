import Boom from "@hapi/boom";
import BaseService from "./base.service.js";
import { DepartamentoModel } from "../models/departamento.model.js";
import { MiembroDepartamentoModel } from "../models/miembroDepartamento.model.js";
import { MiembroModel } from "../models/miembro.model.js";
import { RolMiembroModel } from "../models/catalogo.model.js";
import { ServicioModel } from "../models/servicio.model.js";
import { ReunionModel } from "../models/reunion.model.js";
import { BienModel } from "../models/bien.model.js";
import { FondoModel } from "../models/fondo.model.js";
import { InscripcionModel } from "../models/inscripcion.model.js";
import { EventoModel } from "../models/evento.model.js";

const POPULATE_INTEGRANTE = [{ path: "member", populate: { path: "person" } }, "role"];

class DepartamentoService extends BaseService {
  constructor() {
    super(DepartamentoModel, {
      nombre: "Departamento",
      orden: { description: 1 },
      dependencias: [
        { model: ServicioModel, campo: "departament", nombre: "servicios" },
        { model: ReunionModel, campo: "departament", nombre: "reuniones" },
        { model: MiembroDepartamentoModel, campo: "departament", nombre: "sus integrantes" },
        { model: BienModel, campo: "departamento", nombre: "bienes del inventario" },
        { model: FondoModel, campo: "departamento", nombre: "fondos financieros" },
        { model: InscripcionModel, campo: "departamento", nombre: "personas inscritas" },
        { model: EventoModel, campo: "departamento", nombre: "eventos del calendario" },
      ],
    });
    this.integrantes = new BaseService(MiembroDepartamentoModel, {
      nombre: "Integrante",
      populate: POPULATE_INTEGRANTE,
      referencias: [
        { campo: "member", model: MiembroModel, nombre: "miembro" },
        { campo: "role", model: RolMiembroModel, nombre: "rol" },
      ],
    });
  }

  async listarIntegrantes(idDepartamento) {
    await this.obtener(idDepartamento);
    return this.integrantes.buscar({ departament: idDepartamento });
  }

  async agregarIntegrante(idDepartamento, { member, role }) {
    await this.obtener(idDepartamento);
    if (await MiembroDepartamentoModel.exists({ departament: idDepartamento, member })) {
      throw Boom.conflict("El miembro ya integra este departamento");
    }
    return this.integrantes.crear({ departament: idDepartamento, member, role });
  }

  async actualizarIntegrante(idDepartamento, idIntegrante, data) {
    await this.buscarIntegrante(idDepartamento, idIntegrante);
    return this.integrantes.actualizar(idIntegrante, data);
  }

  async quitarIntegrante(idDepartamento, idIntegrante) {
    await this.buscarIntegrante(idDepartamento, idIntegrante);
    return this.integrantes.eliminar(idIntegrante);
  }

  async buscarIntegrante(idDepartamento, idIntegrante) {
    const existe = await MiembroDepartamentoModel.exists({
      _id: idIntegrante,
      departament: idDepartamento,
    });
    if (!existe) throw Boom.notFound("Integrante no encontrado en este departamento");
  }
}

export default DepartamentoService;
