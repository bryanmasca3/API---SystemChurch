import jwt from "jsonwebtoken";
import Boom from "@hapi/boom";
import config from "../config/env.config.js";
import {
  PERMISOS,
  puede,
  puedeEnSuDepartamento,
  puedeLeerSuDepartamento,
  puedePorOficio,
} from "../config/permisos.js";
import { UsuarioModel } from "../models/usuario.model.js";
import { ejecutarConContexto } from "../libs/contexto.js";
import { departamentosDelUsuario, oficiosDelUsuario } from "../services/alcance.service.js";

/** Carga (una vez por petición) los oficios activos del usuario. */
export const cargarOficios = async (req, res, next) => {
  try {
    req.user.oficios ??= await oficiosDelUsuario(req.user);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Verifica el JWT y carga el usuario desde la BD en cada petición, así un cambio
 * de rol o una desactivación aplican de inmediato (sin esperar a que expire el token).
 * Deja req.user = { sub, rol, miembro } y abre el contexto para la bitácora.
 */
export const authMiddleware = async (req, res, next) => {
  if (req.user) return next();
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return next(Boom.unauthorized("Token requerido"));

  let payload;
  try {
    payload = jwt.verify(authHeader.split(" ")[1], config.TOKEN.JWT);
  } catch {
    return next(Boom.unauthorized("Token inválido o expirado"));
  }

  try {
    const usuario = await UsuarioModel.findById(payload.sub, { rol: 1, miembro: 1, activo: 1 }).lean();
    if (!usuario || !usuario.activo) return next(Boom.unauthorized("Usuario no encontrado o desactivado"));
    req.user = { sub: String(usuario._id), rol: usuario.rol, miembro: usuario.miembro };
  } catch (error) {
    return next(error);
  }

  ejecutarConContexto({ usuario: req.user.sub, ip: req.ip }, next);
};

/**
 * Autoriza según src/config/permisos.js. Incluye la autenticación.
 *
 * @param {string} modulo      Clave de PERMISOS ("miembros", "inventario"...).
 * @param {"leer"|"escribir"} accion
 * @param {(req) => Promise<string[]>} [alcanceDepartamento]
 *        Solo para escritura: departamentos afectados, para los roles de PERMISOS[modulo].escribirPropio.
 *
 * Lectura limitada (PERMISOS[modulo].leerPropio): deja req.alcance = { departamentos } y el
 * servicio filtra los datos. Con acceso completo, req.alcance queda en null.
 */
export const autorizar = (modulo, accion = "leer", alcanceDepartamento) => {
  if (!PERMISOS[modulo]) throw new Error(`Módulo de permisos desconocido: ${modulo}`);

  return [
    authMiddleware,
    async (req, res, next) => {
      try {
        const { rol } = req.user;
        if (puede(rol, modulo, accion)) {
          if (accion === "leer") req.alcance = null;
          return next();
        }

        // Acceso por oficio activo (anciano, diácono...), independiente del rol
        if (PERMISOS[modulo].oficios?.length) {
          req.user.oficios ??= await oficiosDelUsuario(req.user);
          if (puedePorOficio(req.user.oficios, modulo)) {
            if (accion === "leer") req.alcance = null;
            return next();
          }
        }

        if (accion === "leer" && puedeLeerSuDepartamento(rol, modulo)) {
          req.user.departamentos ??= await departamentosDelUsuario(req.user);
          req.alcance = { departamentos: req.user.departamentos };
          return next();
        }

        if (accion === "escribir" && alcanceDepartamento && puedeEnSuDepartamento(rol, modulo)) {
          req.user.departamentos ??= await departamentosDelUsuario(req.user);
          const afectados = await alcanceDepartamento(req);
          const propios = new Set(req.user.departamentos);
          if (afectados.length && afectados.every((d) => d && propios.has(String(d)))) return next();
          return next(Boom.forbidden("Solo puedes modificar datos de tu departamento"));
        }

        next(Boom.forbidden("No tienes permisos para esta acción"));
      } catch (error) {
        next(error);
      }
    },
  ];
};
