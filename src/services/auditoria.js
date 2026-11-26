/**
 * Registro de auditoría (bitácora). Módulo sin dependencias de servicios para que
 * BaseService pueda usarlo sin crear importaciones circulares.
 */
import { BitacoraModel } from "../models/bitacora.model.js";
import { obtenerContexto } from "../libs/contexto.js";
import logger from "../libs/logger.js";

const IGNORADOS = new Set(["_id", "createdAt", "updatedAt", "__v"]);
const OCULTOS = new Set(["contrasena"]);

/** Copia plana y serializable de un documento, sin campos sensibles. */
const limpiar = (doc) => {
  if (!doc) return undefined;
  const objeto = typeof doc.toObject === "function" ? doc.toObject({ depopulate: true, virtuals: false }) : doc;
  const plano = JSON.parse(JSON.stringify(objeto));
  for (const campo of OCULTOS) if (campo in plano) plano[campo] = "[oculto]";
  return plano;
};

/** Solo los campos que cambiaron: { campo: { antes, despues } } */
export const diferencias = (antes, despues) => {
  const a = limpiar(antes) ?? {};
  const d = limpiar(despues) ?? {};
  const cambios = {};
  for (const campo of new Set([...Object.keys(a), ...Object.keys(d)])) {
    if (IGNORADOS.has(campo)) continue;
    if (JSON.stringify(a[campo]) !== JSON.stringify(d[campo])) {
      cambios[campo] = { antes: a[campo] ?? null, despues: d[campo] ?? null };
    }
  }
  return cambios;
};

/**
 * Registra una acción. Nunca lanza: si la bitácora falla, la operación del usuario
 * ya se hizo y no debe revertirse; el error queda en el log del servidor.
 */
export const registrarEnBitacora = async ({ accion, recurso, documento, resumen, cambios, usuario, ip }) => {
  try {
    const ctx = obtenerContexto();
    await BitacoraModel.create({
      accion,
      recurso,
      documento,
      resumen,
      cambios,
      usuario: usuario ?? ctx.usuario,
      ip: ip ?? ctx.ip,
    });
  } catch (error) {
    logger.error("No se pudo registrar en la bitácora:", error);
  }
};

export const bitacoraCrear = (recurso, doc) =>
  registrarEnBitacora({ accion: "crear", recurso, documento: doc?._id, cambios: { despues: limpiar(doc) } });

export const bitacoraActualizar = (recurso, antes, despues) => {
  const cambios = diferencias(antes, despues);
  if (!Object.keys(cambios).length) return undefined;
  return registrarEnBitacora({ accion: "actualizar", recurso, documento: antes?._id, cambios });
};

export const bitacoraEliminar = (recurso, doc) =>
  registrarEnBitacora({ accion: "eliminar", recurso, documento: doc?._id, cambios: { antes: limpiar(doc) } });
