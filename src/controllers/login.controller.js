import LoginService from "../services/login.service.js";

const loginService = new LoginService();

export const validar = async (req, res) => {
  const { correo, contrasena } = req.body;
  res.json(await loginService.validar(correo, contrasena, req.ip));
};

// El usuario se toma del token: nadie puede cambiar la contraseña de otro
export const actualizarContrasena = async (req, res) => {
  res.json(await loginService.actualizarContrasena(req.user.sub, req.body.nuevaContrasena));
};

export const perfil = async (req, res) => {
  res.json(await loginService.perfil(req.user.sub));
};
