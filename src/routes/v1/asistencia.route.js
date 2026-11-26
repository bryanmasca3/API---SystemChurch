import { crearCrudRouter } from "../crudRouter.js";
import { alcance } from "../../services/alcance.service.js";
import { asistenciaController } from "../../controllers/asistencia.controller.js";
import { AsistenciaModel } from "../../models/asistencia.model.js";
import {
  createAsistenciaSchema,
  updateAsistenciaSchema,
  listarAsistenciaSchema,
} from "../../schemas/asistencia.schema.js";

export default crearCrudRouter({
  modulo: "asistencias",
  alcance: alcance.asistencia(AsistenciaModel),
  controller: asistenciaController,
  schemas: {
    listar: listarAsistenciaSchema,
    crear: createAsistenciaSchema,
    actualizar: updateAsistenciaSchema,
  },
});
