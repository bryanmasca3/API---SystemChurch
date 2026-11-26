import { crearCrudController } from "./base.controller.js";
import AdherenteService from "../services/adherente.service.js";

export default crearCrudController(new AdherenteService());
