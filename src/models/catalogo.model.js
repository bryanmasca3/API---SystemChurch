import mongoose from "mongoose";
import { MODELOS, COLECCIONES } from "./nombres.js";

const { Schema, model } = mongoose;

/** Todos los catálogos comparten la misma forma: { description }. */
const crearCatalogoSchema = ({ unico = true } = {}) =>
  new Schema({
    description: { type: String, required: true, trim: true, unique: unico },
  });

export const GeneroModel = model(MODELOS.GENERO, crearCatalogoSchema());
export const EstadoCivilModel = model(MODELOS.ESTADO_CIVIL, crearCatalogoSchema());
export const TipoMembresiaModel = model(MODELOS.TIPO_MEMBRESIA, crearCatalogoSchema());
export const EstadoModel = model(MODELOS.ESTADO, crearCatalogoSchema());
// ORDINARIA, EXTRAORDINARIA, SESIÓN DE DIRECTIVA...
export const TipoReunionModel = model(MODELOS.TIPO_REUNION, crearCatalogoSchema());
// PRESIDENTE, SECRETARIO...
export const RolMiembroModel = model(MODELOS.ROL_MIEMBRO, crearCatalogoSchema({ unico: false }));
// Dones espirituales: ENSEÑANZA, SERVICIO, MÚSICA, EVANGELISMO...
export const DonModel = model(MODELOS.DON, crearCatalogoSchema(), COLECCIONES[MODELOS.DON]);
// SONIDO, MOBILIARIO, INSTRUMENTOS, COCINA...
export const CategoriaInventarioModel = model(
  MODELOS.CATEGORIA_INVENTARIO,
  crearCatalogoSchema(),
  COLECCIONES[MODELOS.CATEGORIA_INVENTARIO],
);
