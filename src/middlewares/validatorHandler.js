import Boom from "@hapi/boom";

/**
 * Valida req[property] con un esquema Joi.
 * - Elimina campos no declarados (evita la asignación masiva de campos no permitidos).
 * - Reemplaza los datos por los ya convertidos (fechas, números, trim...).
 */
export default function validatorHandler(schema, property) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property] ?? {}, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return next(
        Boom.badRequest(
          error.details.map((d) => d.message).join(", "),
          error.details.map((d) => ({ campo: d.path.join("."), mensaje: d.message })),
        ),
      );
    }
    // En Express 5 req.query es un getter: se redefine para guardar el valor validado
    Object.defineProperty(req, property, {
      value,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  };
}
