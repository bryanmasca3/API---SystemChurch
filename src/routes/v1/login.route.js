import { Router } from "express";
import { validar, actualizarContrasena, perfil } from "../../controllers/login.controller.js";
import { loginSchema, actualizarContrasenaSchema } from "../../schemas/login.schema.js";
import validatorHandler from "../../middlewares/validatorHandler.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { loginRateLimiter } from "../../middlewares/loginRateLimiter.js";

const router = Router();

router.post("/", loginRateLimiter, validatorHandler(loginSchema, "body"), validar);

// Requieren sesión: el usuario se toma del token
router.get("/perfil", authMiddleware, perfil);
router.post(
  "/actualizar-contrasena",
  authMiddleware,
  validatorHandler(actualizarContrasenaSchema, "body"),
  actualizarContrasena,
);

export default router;
