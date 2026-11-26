import BitacoraService from "../services/bitacora.service.js";

const bitacoraService = new BitacoraService();

export const listarBitacora = async (req, res) => {
  res.json(await bitacoraService.listar(req.query));
};
