const VARIANTES = { a: "aáàä", e: "eéèë", i: "iíìï", o: "oóòö", u: "uúùü", n: "nñ" };

/**
 * Regex de búsqueda insensible a mayúsculas y tildes: "micro" encuentra "Micrófono",
 * "pena" encuentra "Peña". El texto del usuario se escapa (sin inyección de regex).
 */
export const regexBusqueda = (texto) => {
  const base = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const patron = [...base]
    .map((c) => (VARIANTES[c] ? `[${VARIANTES[c]}]` : c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("");
  return new RegExp(patron, "i");
};

/** Construye { date: { $gte, $lte } } a partir de un rango opcional. */
export const construirFiltroFechas = (desde, hasta, campo = "date") => {
  if (!desde && !hasta) return {};
  return {
    [campo]: {
      ...(desde && { $gte: desde }),
      ...(hasta && { $lte: hasta }),
    },
  };
};

/**
 * Filtro por sesión para asistencias.
 * - `sesion`: una sesión concreta.
 * - `servicio`, `desde`, `hasta`: se resuelven a las sesiones que cumplen.
 * Si se combinan, se usa la intersección.
 */
export const construirFiltroSesion = async (sesionService, { sesion, servicio, desde, hasta }) => {
  if (!servicio && !desde && !hasta) return sesion ? { sesion } : {};

  let ids = await sesionService.idsQueCumplen({ servicio, desde, hasta });
  if (sesion) ids = ids.filter((id) => id.equals(sesion));
  return { sesion: { $in: ids } };
};
