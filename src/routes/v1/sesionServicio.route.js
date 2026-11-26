import { crearCrudRouter } from "../crudRouter.js";
import { alcance } from "../../services/alcance.service.js";
import sesionServicioController from "../../controllers/sesionServicio.controller.js";
import {
  createSesionServicioSchema,
  updateSesionServicioSchema,
  listarSesionServicioSchema,
} from "../../schemas/sesionServicio.schema.js";
import { programaSchema, generarSesionesSchema } from "../../schemas/calendario.schema.js";
import { idParamSchema } from "../../schemas/common.schema.js";
import validatorHandler from "../../middlewares/validatorHandler.js";
import { autorizar } from "../../middlewares/authMiddleware.js";

/**
 * /sesion-servicio                cada culto concreto (CRUD)
 * /sesion-servicio/generar        crea los cultos de un rango de fechas según el horario de cada servicio
 * /sesion-servicio/:id/programa   director, predicador y lectura bíblica
 */
export default crearCrudRouter({
  modulo: "sesiones",
  alcance: alcance.sesion,
  controller: sesionServicioController,
  schemas: {
    listar: listarSesionServicioSchema,
    crear: createSesionServicioSchema,
    actualizar: updateSesionServicioSchema,
  },
  extra: (router) => {
    router.post(
      "/generar",
      autorizar("sesiones", "escribir", alcance.generarSesiones),
      validatorHandler(generarSesionesSchema, "body"),
      sesionServicioController.generar,
    );
    router.put(
      "/:id/programa",
      validatorHandler(idParamSchema, "params"),
      autorizar("sesiones", "escribir", alcance.sesion),
      validatorHandler(programaSchema, "body"),
      sesionServicioController.asignarPrograma,
    );
  },
});
