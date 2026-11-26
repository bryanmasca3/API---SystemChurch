import { Router } from "express";
import { crearCrudRouter } from "../crudRouter.js";
import { catalogoControllers } from "../../controllers/catalogo.controller.js";
import { createCatalogoSchema, updateCatalogoSchema } from "../../schemas/catalogo.schema.js";

/**
 * /catalogo/genero, /catalogo/estado-civil, /catalogo/tipo-membresia, /catalogo/estado,
 * /catalogo/tipo-reunion, /catalogo/rol-miembro, /catalogo/categoria-inventario
 */
const router = Router();

for (const [ruta, controller] of Object.entries(catalogoControllers)) {
  router.use(
    `/${ruta}`,
    crearCrudRouter({
      modulo: "catalogos",
      controller,
      schemas: { crear: createCatalogoSchema, actualizar: updateCatalogoSchema },
    }),
  );
}

export default router;
