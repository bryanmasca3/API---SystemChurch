import Joi from "joi";
import joiObjectid from "joi-objectid";

export const objectId = joiObjectid(Joi);
// meta: solo afecta la documentación Swagger (joi-objectid se vería como string|object)
export const idGen = objectId().meta({
  swagger: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "665f1c2e9b1e8a3d4c2b1a00" },
  swaggerOverride: true,
});
export const stringStandard = Joi.string().trim().max(255);
export const textLong = Joi.string().trim().max(5000);
export const dateGen = Joi.date();
export const booleanGen = Joi.boolean();

/** :id en la URL */
export const idParamSchema = Joi.object({ id: idGen.required() });

/** Paginación en query (?pagina=2&limite=50) para los listados paginados */
export const paginacion = {
  pagina: Joi.number().integer().min(1).default(1),
  limite: Joi.number().integer().min(1).max(100).default(20),
};
export const paginacionSchema = Joi.object(paginacion);

/**
 * Fecha de un filtro. Si llega solo el día ("2024-12-31"), se interpreta en hora de Perú
 * (UTC-5, sin horario de verano): `desde` = inicio del día y `hasta` = fin del día.
 * Así "hasta=2024-12-31" incluye todo el 31 (antes cortaba el 30 a las 19:00 de Lima).
 */
const SOLO_DIA = /^\d{4}-\d{2}-\d{2}$/;
const aFecha = (valor, finDelDia) => {
  if (valor instanceof Date) return valor;
  if (typeof valor === "string" && SOLO_DIA.test(valor)) {
    return new Date(`${valor}T${finDelDia ? "23:59:59.999" : "00:00:00"}-05:00`);
  }
  return new Date(valor);
};
const fechaDeRango = (finDelDia) =>
  Joi.any()
    .custom((valor, helpers) => {
      const fecha = aFecha(valor, finDelDia);
      return Number.isNaN(fecha.getTime()) ? helpers.error("date.base") : fecha;
    })
    .messages({ "date.base": "{{#label}} debe ser una fecha válida (AAAA-MM-DD o ISO 8601)" })
    .meta({ swagger: { type: "string", format: "date", example: "2024-12-31" }, swaggerOverride: true });

/** Rango de fechas opcional en query (?desde=2024-01-01&hasta=2024-12-31) */
export const rangoFechas = {
  desde: fechaDeRango(false).optional(),
  hasta: fechaDeRango(true)
    .custom((hasta, helpers) => {
      const desde = helpers.state.ancestors[0]?.desde;
      if (desde && hasta < aFecha(desde, false)) {
        return helpers.message('"hasta" debe ser posterior o igual a "desde"');
      }
      return hasta;
    })
    .optional(),
};

/**
 * Convierte un esquema de creación en uno de actualización: todo opcional y al menos un campo.
 * Rechaza campos con .default(): en una edición parcial el valor por defecto se inyectaría y
 * sobrescribiría el dato guardado (p. ej. resetear un saldo a 0). Falla al arrancar, no en producción.
 */
export const parcial = (schema) => {
  const { keys } = schema.describe();
  const conDefault = Object.entries(keys)
    .filter(([, d]) => d.flags && "default" in d.flags)
    .map(([k]) => k);
  if (conDefault.length) {
    throw new Error(`parcial(): quita el .default() de ${conDefault.join(", ")} en el esquema de actualización`);
  }
  return schema.fork(Object.keys(keys), (campo) => campo.optional()).min(1);
};
