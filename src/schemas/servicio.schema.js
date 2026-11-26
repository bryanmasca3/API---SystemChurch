import Joi from "joi";
import { idGen, stringStandard, parcial } from "./common.schema.js";
import { DIAS_SEMANA, HORA_HHMM } from "../models/servicio.model.js";

const sinTildes = (texto) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
const DIA_POR_CLAVE = Object.fromEntries(DIAS_SEMANA.map((d) => [sinTildes(d), d]));

/** Acepta "SABADO", "Sábado", "sabado"... y lo guarda como "sábado". */
export const normalizarDia = (valor) => DIA_POR_CLAVE[sinTildes(String(valor).trim().toLowerCase())];

const dia = Joi.string()
  .custom((valor, helpers) => normalizarDia(valor) ?? helpers.error("any.only"))
  .messages({ "any.only": `El día debe ser uno de: ${DIAS_SEMANA.join(", ")}` });

const hora = Joi.string()
  .trim()
  .pattern(HORA_HHMM)
  .allow(null)
  .messages({ "string.pattern.base": "La hora debe tener formato HH:mm de 24 horas (p. ej. 19:30)" });

/** endtime debe ser posterior a begintime cuando llegan ambos. */
const validarRango = (valor, helpers) => {
  const { begintime, endtime } = valor;
  if (begintime && endtime && endtime <= begintime) {
    return helpers.message("La hora de fin debe ser posterior a la de inicio");
  }
  return valor;
};

const campos = {
  description: stringStandard.required(),
  day: dia.required(),
  begintime: hora.optional(),
  endtime: hora.optional(),
  departament: idGen.required(),
};

export const createServicioSchema = Joi.object(campos).custom(validarRango);

export const updateServicioSchema = parcial(Joi.object(campos)).custom(validarRango);
