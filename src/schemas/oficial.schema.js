import Joi from "joi";
import { idGen, stringStandard, textLong, dateGen, booleanGen, parcial } from "./common.schema.js";
import { OFICIOS, OFICIOS_SERVICIO, CONDICIONES_ANCIANO, ESTADOS_OFICIAL } from "../models/oficial.model.js";

const campos = {
  miembro: idGen.required(),
  oficio: Joi.string().valid(...OFICIOS).required(),
  fecha_ordenacion: dateGen.optional(),
  fecha_inicio: dateGen.required(),
  fecha_fin: dateGen.min(Joi.ref("fecha_inicio")).optional().allow(null),
  integra_consistorio: booleanGen.optional(),
  estado: Joi.string().valid(...ESTADOS_OFICIAL).optional(),
  acta_consistorio: stringStandard.max(60).optional().allow(""),
  observacion: textLong.optional().allow(""),
};

export const createOficialSchema = Joi.object({
  ...campos,
  // Solo pastores, ancianos y diáconos pueden integrar el consistorio
  integra_consistorio: booleanGen.when("oficio", {
    is: Joi.valid(...OFICIOS_SERVICIO),
    then: Joi.valid(false).messages({ "any.only": "Solo pastores, ancianos y diáconos integran el consistorio" }),
  }),
  // Ancianos: ordenado o a prueba (obligatorio). Pastores y diáconos: no aplica.
  condicion: Joi.string()
    .valid(...CONDICIONES_ANCIANO)
    .when("oficio", { is: "anciano", then: Joi.required(), otherwise: Joi.forbidden() }),
});

// La coherencia oficio/condición/fechas se valida en el servicio contra el registro guardado
// (fecha_fin se compara con la fecha_inicio guardada, que puede no venir en la edición)
export const updateOficialSchema = parcial(
  Joi.object({
    ...campos,
    miembro: idGen,
    fecha_fin: dateGen.allow(null),
    condicion: Joi.string().valid(...CONDICIONES_ANCIANO).allow(null),
  }),
);

export const listarOficialSchema = Joi.object({
  oficio: Joi.string().valid(...OFICIOS).optional(),
  estado: Joi.string().valid(...ESTADOS_OFICIAL).optional(),
  condicion: Joi.string().valid(...CONDICIONES_ANCIANO).optional(),
  consistorio: booleanGen.optional(),
  miembro: idGen.optional(),
});
