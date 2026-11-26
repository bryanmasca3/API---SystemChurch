import { crearCrudController } from "./base.controller.js";
import UsuarioService from "../services/usuario.service.js";

export const usuarioService = new UsuarioService();

export const usuarioController = crearCrudController(usuarioService);
