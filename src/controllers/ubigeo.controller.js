import UbigeoService from "../services/ubigeo.service.js";

const ubigeoService = new UbigeoService();

export const listarUbigeo = async (req, res) => {
  res.json(await ubigeoService.listar(req.params.nivel, req.query));
};

export const obtenerUbigeo = async (req, res) => {
  res.json(await ubigeoService.obtener(req.params.nivel, req.params.id));
};
