import { Router } from "express";
import {
  bautismoController,
  matrimonioController,
  disciplinaController,
  dedicacionController,
} from "../../controllers/actas.controller.js";
import {
  anularActaSchema,
  createBautismoSchema,
  updateBautismoSchema,
  listarBautismoSchema,
  createMatrimonioSchema,
  updateMatrimonioSchema,
  listarMatrimonioSchema,
  createDisciplinaSchema,
  updateDisciplinaSchema,
  restaurarDisciplinaSchema,
  listarDisciplinaSchema,
  createDedicacionSchema,
  updateDedicacionSchema,
  listarDedicacionSchema,
} from "../../schemas/actas.schema.js";
import { idParamSchema } from "../../schemas/common.schema.js";
import validatorHandler from "../../middlewares/validatorHandler.js";
import { autorizar } from "../../middlewares/authMiddleware.js";

const validarId = validatorHandler(idParamSchema, "params");

/** Libro de actas: GET, GET /:id, POST, PUT /:id y POST /:id/anular (sin DELETE). */
const crearLibroRouter = ({ modulo, controller, schemas, extra }) => {
  const router = Router();
  const escribir = autorizar(modulo, "escribir");
  router.use(autorizar(modulo, "leer"));
  router.get("/", validatorHandler(schemas.listar, "query"), controller.listar);
  router.get("/:id", validarId, controller.obtener);
  router.post("/", escribir, validatorHandler(schemas.crear, "body"), controller.crear);
  router.put("/:id", validarId, escribir, validatorHandler(schemas.actualizar, "body"), controller.actualizar);
  router.post("/:id/anular", validarId, escribir, validatorHandler(anularActaSchema, "body"), controller.anular);
  if (extra) extra(router, escribir);
  return router;
};

const router = Router();

router.use(
  "/bautismo",
  crearLibroRouter({
    modulo: "actas",
    controller: bautismoController,
    schemas: { listar: listarBautismoSchema, crear: createBautismoSchema, actualizar: updateBautismoSchema },
  }),
);

router.use(
  "/matrimonio",
  crearLibroRouter({
    modulo: "actas",
    controller: matrimonioController,
    schemas: { listar: listarMatrimonioSchema, crear: createMatrimonioSchema, actualizar: updateMatrimonioSchema },
  }),
);

router.use(
  "/dedicacion",
  crearLibroRouter({
    modulo: "actas",
    controller: dedicacionController,
    schemas: { listar: listarDedicacionSchema, crear: createDedicacionSchema, actualizar: updateDedicacionSchema },
  }),
);

// Confidencial: solo pastor y administrador (incluida la lectura)
router.use(
  "/disciplina",
  crearLibroRouter({
    modulo: "disciplina",
    controller: disciplinaController,
    schemas: { listar: listarDisciplinaSchema, crear: createDisciplinaSchema, actualizar: updateDisciplinaSchema },
    extra: (r, escribir) =>
      r.post(
        "/:id/restaurar",
        validarId,
        escribir,
        validatorHandler(restaurarDisciplinaSchema, "body"),
        disciplinaController.restaurar,
      ),
  }),
);

export default router;
