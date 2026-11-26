import Boom from "@hapi/boom";
import bcrypt from "bcryptjs";
import BaseService from "./base.service.js";
import { UsuarioModel } from "../models/usuario.model.js";
import { MiembroModel } from "../models/miembro.model.js";
import { ROLES } from "../config/permisos.js";
import config from "../config/env.config.js";
import logger from "../libs/logger.js";
import { registrarEnBitacora } from "./auditoria.js";

export const hashear = async (texto) => {
  const salt = await bcrypt.genSalt(config.BCRYPT_SALT_ROUNDS);
  return bcrypt.hash(texto, salt);
};

const ADMIN_ACTIVO = { rol: ROLES.ADMINISTRADOR, activo: true };

class UsuarioService extends BaseService {
  constructor() {
    super(UsuarioModel, {
      nombre: "Usuario",
      orden: { nombre: 1 },
      paginado: true,
      populate: [{ path: "miembro", populate: { path: "person", select: "name surname" } }],
      referencias: [{ campo: "miembro", model: MiembroModel, nombre: "miembro" }],
    });
  }

  construirFiltro({ rol, activo } = {}) {
    return { ...(rol && { rol }), ...(activo !== undefined && { activo }) };
  }

  async crear(data) {
    const contrasena = data.contrasena || config.DEFAULT_USER_PASSWORD;
    if (!contrasena) {
      throw Boom.badRequest("Debe enviar una contraseña (o configurar DEFAULT_USER_PASSWORD)");
    }
    return super.crear({ ...data, contrasena: await hashear(contrasena) });
  }

  /** Impide dejar el sistema sin ningún administrador activo. */
  async validarNoEsUltimoAdmin(id, cambios) {
    const actual = await UsuarioModel.findById(id, { rol: 1, activo: 1 }).lean();
    if (!actual || actual.rol !== ROLES.ADMINISTRADOR || !actual.activo) return;
    const dejaDeSerAdmin =
      cambios === null || // eliminar
      (cambios.rol && cambios.rol !== ROLES.ADMINISTRADOR) ||
      cambios.activo === false;
    if (!dejaDeSerAdmin) return;
    const otrosAdmins = await UsuarioModel.countDocuments({ ...ADMIN_ACTIVO, _id: { $ne: id } });
    if (!otrosAdmins) {
      throw Boom.conflict("No se puede: es el último administrador activo del sistema");
    }
  }

  async actualizar(id, data) {
    await this.validarNoEsUltimoAdmin(id, data);
    if ("rol" in data || "miembro" in data) {
      const actual = await UsuarioModel.findById(id, { rol: 1, miembro: 1 }).lean();
      if (!actual) throw this.noEncontrado();
      const rolFinal = data.rol ?? actual.rol;
      const miembroFinal = "miembro" in data ? data.miembro : actual.miembro;
      if (rolFinal === ROLES.LIDER && !miembroFinal) {
        throw Boom.badRequest("Un líder debe tener un miembro vinculado (define sus departamentos)");
      }
    }
    const cambios = { ...data };
    // Solo se cambia la contraseña si se envía una nueva
    if (cambios.contrasena) cambios.contrasena = await hashear(cambios.contrasena);
    else delete cambios.contrasena;
    const actualizado = await super.actualizar(id, cambios);
    // La contraseña nunca se lee (select: false), así que el diff no la ve: se registra aparte
    if (cambios.contrasena) {
      await registrarEnBitacora({
        accion: "actualizar",
        recurso: this.nombre,
        documento: actualizado._id,
        resumen: "Contraseña restablecida por un administrador",
        cambios: { contrasena: { antes: "[oculto]", despues: "[oculto]" } },
      });
    }
    return actualizado;
  }

  async eliminar(id) {
    await this.validarNoEsUltimoAdmin(id, null);
    return super.eliminar(id);
  }

  /**
   * Crea un administrador si aún no existe ninguno activo.
   * Permite arrancar el sistema sin crear el primer usuario a mano en la BD.
   */
  async asegurarAdminInicial() {
    if (await UsuarioModel.exists(ADMIN_ACTIVO)) return;

    const { NOMBRE, CORREO, CONTRASENA } = config.ADMIN_INICIAL;
    if (!CORREO || !CONTRASENA) {
      logger.warn(
        "No hay ningún administrador. Define ADMIN_CORREO y ADMIN_CONTRASENA en .env para crearlo al arrancar.",
      );
      return;
    }
    if (await UsuarioModel.exists({ correo: CORREO.toLowerCase() })) {
      logger.warn(`No hay administradores activos y ${CORREO} ya existe con otro rol: revísalo en la BD.`);
      return;
    }

    await UsuarioModel.create({
      nombre: NOMBRE,
      correo: CORREO,
      contrasena: await hashear(CONTRASENA),
      rol: ROLES.ADMINISTRADOR,
      login_inicial: true,
    });
    logger.info(`Administrador inicial creado: ${CORREO}`);
  }
}

export default UsuarioService;
