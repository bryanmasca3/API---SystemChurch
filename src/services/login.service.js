import Boom from "@hapi/boom";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UsuarioModel } from "../models/usuario.model.js";
import { hashear } from "./usuario.service.js";
import { registrarEnBitacora } from "./auditoria.js";
import {
  PERMISOS,
  puede,
  puedeEnSuDepartamento,
  puedeLeerSuDepartamento,
  puedePorOficio,
} from "../config/permisos.js";
import { oficiosDelUsuario } from "./alcance.service.js";
import config from "../config/env.config.js";

const firmarToken = (userId) =>
  jwt.sign({ sub: userId }, config.TOKEN.JWT, { expiresIn: config.TOKEN.EXPIRES_IN });

/**
 * Qué puede hacer el usuario en cada módulo (por su rol y sus oficios activos),
 * para que el frontend muestre u oculte opciones.
 */
const permisosDe = (rol, oficios = []) =>
  Object.fromEntries(
    Object.keys(PERMISOS).map((modulo) => [
      modulo,
      {
        leer: puede(rol, modulo, "leer") || puedePorOficio(oficios, modulo)
          ? true
          : puedeLeerSuDepartamento(rol, modulo)
            ? "departamento"
            : false,
        escribir: puede(rol, modulo, "escribir") || puedePorOficio(oficios, modulo)
          ? true
          : puedeEnSuDepartamento(rol, modulo)
            ? "departamento"
            : false,
      },
    ]),
  );

const serializarUsuario = async (user) => {
  const oficios = await oficiosDelUsuario(user);
  return {
    _id: user._id,
    nombre: user.nombre,
    correo: user.correo,
    rol: user.rol,
    miembro: user.miembro,
    oficios,
    login_inicial: user.login_inicial,
    permisos: permisosDe(user.rol, oficios),
  };
};

class LoginService {
  async validar(correo, contrasena, ip) {
    const correoNormal = String(correo).trim().toLowerCase();
    const user = await UsuarioModel.findOne({ correo: correoNormal }).select("+contrasena");

    // Mismo mensaje en todos los casos para no revelar qué correos existen
    const valido = user && user.activo && (await bcrypt.compare(contrasena, user.contrasena));
    if (!valido) {
      await registrarEnBitacora({
        accion: "login_fallido",
        recurso: "Sesión",
        documento: user?._id,
        resumen: `Intento fallido para ${correoNormal}${user && !user.activo ? " (cuenta desactivada)" : ""}`,
        usuario: user?._id,
        ip,
      });
      throw Boom.unauthorized("Usuario o contraseña incorrectos");
    }

    await registrarEnBitacora({
      accion: "login",
      recurso: "Sesión",
      documento: user._id,
      usuario: user._id,
      ip,
    });
    return { user: await serializarUsuario(user), token: firmarToken(user._id) };
  }

  /** Cambia la contraseña del usuario autenticado (id tomado del token). */
  async actualizarContrasena(userId, nuevaContrasena) {
    const user = await UsuarioModel.findByIdAndUpdate(
      userId,
      { contrasena: await hashear(nuevaContrasena), login_inicial: false },
      { new: true },
    );
    if (!user) throw Boom.notFound("Usuario no encontrado");
    await registrarEnBitacora({
      accion: "actualizar",
      recurso: "Usuario",
      documento: user._id,
      resumen: "Cambió su contraseña",
    });
    return { user: await serializarUsuario(user), token: firmarToken(user._id) };
  }

  /** Datos y permisos del usuario autenticado. */
  async perfil(userId) {
    const user = await UsuarioModel.findById(userId);
    if (!user) throw Boom.notFound("Usuario no encontrado");
    return await serializarUsuario(user);
  }
}

export default LoginService;
