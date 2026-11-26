import { crearCrudController } from "./base.controller.js";
import RolLimpiezaService from "../services/rolLimpieza.service.js";

const rolLimpiezaService = new RolLimpiezaService();

export default {
  ...crearCrudController(rolLimpiezaService),

  obtenerActual: async (req, res) => {
    res.json(await rolLimpiezaService.obtenerActual());
  },
};
