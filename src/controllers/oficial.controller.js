import { crearCrudController } from "./base.controller.js";
import OficialService from "../services/oficial.service.js";

const oficialService = new OficialService();

export default {
  ...crearCrudController(oficialService),
  consistorio: async (req, res) => res.json(await oficialService.consistorio()),
};
