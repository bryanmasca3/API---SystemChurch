/**
 * Controlador CRUD genérico para un servicio que extiende BaseService.
 * Express 5 propaga automáticamente al errorHandler los errores de funciones async.
 */
export const crearCrudController = (service) => ({
  listar: async (req, res) => {
    res.json(await service.listar(req.query));
  },

  obtener: async (req, res) => {
    res.json(await service.obtener(req.params.id));
  },

  crear: async (req, res) => {
    res.status(201).json(await service.crear(req.body));
  },

  actualizar: async (req, res) => {
    res.json(await service.actualizar(req.params.id, req.body));
  },

  eliminar: async (req, res) => {
    await service.eliminar(req.params.id);
    res.status(204).end();
  },
});
