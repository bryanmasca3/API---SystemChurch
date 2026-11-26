import { crearCrudController } from "./base.controller.js";
import AsistenciaService from "../services/asistencia.service.js";
import AsistenciaSantaCenaService from "../services/asistenciaSantaCena.service.js";

export const asistenciaController = crearCrudController(new AsistenciaService());
export const asistenciaSantaCenaController = crearCrudController(new AsistenciaSantaCenaService());
