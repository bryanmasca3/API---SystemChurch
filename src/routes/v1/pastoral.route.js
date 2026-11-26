import { Router } from "express";
import { crearCrudRouter } from "../crudRouter.js";
import {
  visitaController,
  casoController,
  peticionController,
  seguimientoController,
  alertasController,
  resumenController,
} from "../../controllers/pastoral.controller.js";
import {
  createVisitaSchema,
  updateVisitaSchema,
  listarVisitaSchema,
  createCasoSchema,
  updateCasoSchema,
  listarCasoSchema,
  createAyudaSchema,
  ayudaParamsSchema,
  createPeticionSchema,
  updatePeticionSchema,
  listarPeticionSchema,
  createSeguimientoSchema,
  updateSeguimientoSchema,
  listarSeguimientoSchema,
  createAvanceSchema,
  alertasSchema,
} from "../../schemas/pastoral.schema.js";
import { idParamSchema } from "../../schemas/common.schema.js";
import validatorHandler from "../../middlewares/validatorHandler.js";
import { autorizar, cargarOficios } from "../../middlewares/authMiddleware.js";

/**
 * /pastoral/visitas       visitas pastorales (pastor, administrador, ancianos)
 * /pastoral/casos         necesitados y enfermos (+ ancianos y diáconos)
 * /pastoral/oracion       peticiones de oración (todos; confidenciales: equipo pastoral)
 * /pastoral/seguimiento   nuevos en evangelismo y discipulado
 * /pastoral/alertas       miembros con inasistencia
 * /pastoral/resumen       tablero pastoral
 */
const router = Router();
const validarId = validatorHandler(idParamSchema, "params");

router.get("/alertas", autorizar("visitas", "leer"), validatorHandler(alertasSchema, "query"), alertasController);
router.get("/resumen", autorizar("visitas", "leer"), resumenController);

router.use(
  "/visitas",
  crearCrudRouter({
    modulo: "visitas",
    controller: visitaController,
    schemas: { listar: listarVisitaSchema, crear: createVisitaSchema, actualizar: updateVisitaSchema },
  }),
);

router.use(
  "/casos",
  crearCrudRouter({
    modulo: "diaconia",
    controller: casoController,
    schemas: { listar: listarCasoSchema, crear: createCasoSchema, actualizar: updateCasoSchema },
    extra: (r) => {
      const escribir = autorizar("diaconia", "escribir");
      r.post("/:id/ayudas", validarId, escribir, validatorHandler(createAyudaSchema, "body"), casoController.agregarAyuda);
      r.delete("/:id/ayudas/:ayudaId", validatorHandler(ayudaParamsSchema, "params"), escribir, casoController.quitarAyuda);
    },
  }),
);

// Peticiones: los oficios (ancianos) definen quién ve las confidenciales
const oracion = Router();
oracion.use(autorizar("oracion", "leer"), cargarOficios);
oracion.use(
  crearCrudRouter({
    modulo: "oracion",
    controller: peticionController,
    schemas: { listar: listarPeticionSchema, crear: createPeticionSchema, actualizar: updatePeticionSchema },
  }),
);
router.use("/oracion", oracion);

router.use(
  "/seguimiento",
  crearCrudRouter({
    modulo: "discipulado",
    controller: seguimientoController,
    schemas: { listar: listarSeguimientoSchema, crear: createSeguimientoSchema, actualizar: updateSeguimientoSchema },
    extra: (r) =>
      r.post(
        "/:id/avances",
        validarId,
        autorizar("discipulado", "escribir"),
        validatorHandler(createAvanceSchema, "body"),
        seguimientoController.registrarAvance,
      ),
  }),
);

export default router;
