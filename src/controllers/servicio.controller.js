import { crearCrudController } from "./base.controller.js";
import ServicioService from "../services/servicio.service.js";

export default crearCrudController(new ServicioService());
