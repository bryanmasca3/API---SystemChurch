import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Contexto de la petición en curso (usuario e IP), disponible en cualquier capa
 * sin pasarlo como parámetro. Lo usa la bitácora para saber quién hizo cada cambio.
 */
const almacen = new AsyncLocalStorage();

export const ejecutarConContexto = (datos, fn) => almacen.run(datos, fn);

/** { usuario, ip } de la petición actual, o {} fuera de una petición (scripts, arranque). */
export const obtenerContexto = () => almacen.getStore() ?? {};
