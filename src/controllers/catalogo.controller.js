import { crearCrudController } from "./base.controller.js";
import { catalogoServices } from "../services/catalogo.service.js";

/** Un controlador CRUD por catálogo, indexado por el segmento de la ruta. */
export const catalogoControllers = Object.fromEntries(
  Object.entries(catalogoServices).map(([ruta, service]) => [ruta, crearCrudController(service)]),
);
