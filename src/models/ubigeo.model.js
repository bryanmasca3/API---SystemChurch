import mongoose from "mongoose";
import { MODELOS } from "./nombres.js";

const { Schema, model } = mongoose;

/**
 * Departamento, provincia y distrito comparten la estructura del ubigeo.
 * id_ubigeo es el código INEI del nivel: departamento "04", provincia "0401", distrito "040103".
 * id_padre_ubigeo es el código del nivel superior ("00" = Perú para los departamentos).
 * Se carga con: npm run cargar:ubigeo
 */
const crearUbigeoSchema = () =>
  new Schema({
    id_ubigeo: { type: String, required: true, unique: true },
    nombre_ubigeo: { type: String, required: true },
    codigo_ubigeo: { type: String, required: true },
    etiqueta_ubigeo: { type: String, required: true },
    buscador_ubigeo: { type: String, required: true },
    numero_hijos_ubigeo: { type: String, required: true },
    nivel_ubigeo: { type: String, required: true },
    id_padre_ubigeo: { type: String, required: true, index: true },
  });

export const UbigeoDepartamentoModel = model(MODELOS.UBIGEO_DEPARTAMENTO, crearUbigeoSchema());
export const UbigeoProvinciaModel = model(MODELOS.UBIGEO_PROVINCIA, crearUbigeoSchema());
export const UbigeoDistritoModel = model(MODELOS.UBIGEO_DISTRITO, crearUbigeoSchema());
