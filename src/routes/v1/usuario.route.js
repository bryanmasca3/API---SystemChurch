import { crearCrudRouter } from "../crudRouter.js";
import { usuarioController } from "../../controllers/usuario.controller.js";
import {
  createUsuarioSchema,
  updateUsuarioSchema,
  listarUsuarioSchema,
} from "../../schemas/usuario.schema.js";

// Gestión de cuentas: solo administradores (también las lecturas)
export default crearCrudRouter({
  modulo: "usuarios",
  controller: usuarioController,
  schemas: {
    listar: listarUsuarioSchema,
    crear: createUsuarioSchema,
    actualizar: updateUsuarioSchema,
  },
});
