import { crearCrudRouter } from "../crudRouter.js";
import { alcance } from "../../services/alcance.service.js";
import { asistenciaSantaCenaController } from "../../controllers/asistencia.controller.js";
import { AsistenciaSantaCenaModel } from "../../models/asistenciaSantaCena.model.js";
import {
  createAsistenciaSantaCenaSchema,
  updateAsistenciaSantaCenaSchema,
  listarAsistenciaSantaCenaSchema,
} from "../../schemas/asistencia.schema.js";

export default crearCrudRouter({
  modulo: "asistencias",
  alcance: alcance.asistencia(AsistenciaSantaCenaModel),
  controller: asistenciaSantaCenaController,
  schemas: {
    listar: listarAsistenciaSantaCenaSchema,
    crear: createAsistenciaSantaCenaSchema,
    actualizar: updateAsistenciaSantaCenaSchema,
  },
});
