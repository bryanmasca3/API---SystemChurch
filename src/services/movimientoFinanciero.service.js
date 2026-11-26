import Boom from "@hapi/boom";
import BaseService from "./base.service.js";
import { MovimientoFinancieroModel } from "../models/movimientoFinanciero.model.js";
import { FondoModel } from "../models/fondo.model.js";
import { CategoriaFinancieraModel } from "../models/categoriaFinanciera.model.js";
import { MiembroModel } from "../models/miembro.model.js";
import { SesionServicioModel } from "../models/sesionServicio.model.js";
import { CierreMensualModel } from "../models/cierreMensual.model.js";
import { periodoDe, redondear } from "../libs/fechas.js";
import { construirFiltroFechas } from "./filtros.js";
import { saldoActual } from "./saldos.js";
import { idsFondosVisibles } from "./fondo.service.js";
import { bitacoraCrear, registrarEnBitacora } from "./auditoria.js";

const POPULATE = [
  { path: "fondo", select: "nombre tipo" },
  { path: "fondo_destino", select: "nombre tipo" },
  { path: "categoria", select: "description tipo" },
  { path: "miembro", select: "person", populate: { path: "person", select: "name surname doi" } },
  { path: "sesion", select: "date service", populate: { path: "service", select: "description" } },
  { path: "registrado_por", select: "nombre" },
  { path: "anulacion.usuario", select: "nombre" },
];
// Para quien solo ve su departamento: sin datos de quién diezmó
const POPULATE_SIN_MIEMBRO = POPULATE.filter((p) => p.path !== "miembro");

export const validarPeriodoAbierto = async (periodo) => {
  if (await CierreMensualModel.exists({ periodo })) {
    throw Boom.conflict(`El mes ${periodo} está cerrado: no admite cambios`);
  }
};

class MovimientoFinancieroService extends BaseService {
  constructor() {
    super(MovimientoFinancieroModel, {
      nombre: "Movimiento financiero",
      orden: { fecha: -1, createdAt: -1 },
      paginado: true,
      populate: POPULATE,
    });
  }

  async construirFiltro(
    { tipo, clase, fondo, categoria, miembro, sesion, periodo, desde, hasta, incluir_anulados } = {},
    alcance = null,
  ) {
    const filtro = {
      ...(tipo && { tipo }),
      ...(clase && { clase }),
      ...(categoria && { categoria }),
      ...(miembro && { miembro }),
      ...(sesion && { sesion }),
      ...(periodo && { periodo }),
      ...(!incluir_anulados && { anulado: false }),
      ...construirFiltroFechas(desde, hasta, "fecha"),
    };
    const visibles = await idsFondosVisibles(alcance);
    let fondos = fondo ? [fondo] : null;
    if (visibles) {
      const permitidos = new Set(visibles.map(String));
      fondos = fondos ? fondos.filter((f) => permitidos.has(String(f))) : visibles;
    }
    if (fondos) filtro.$or = [{ fondo: { $in: fondos } }, { fondo_destino: { $in: fondos } }];
    return filtro;
  }

  async listar({ pagina = 1, limite = 20, ...filtros } = {}, alcance = null) {
    if (alcance && filtros.miembro) throw Boom.forbidden("No tienes permisos para filtrar por miembro");
    const filtro = await this.construirFiltro(filtros, alcance);
    const consulta = MovimientoFinancieroModel.find(filtro)
      .sort(this.orden)
      .skip((pagina - 1) * limite)
      .limit(limite);
    if (alcance) consulta.select("-miembro").populate(POPULATE_SIN_MIEMBRO);
    else consulta.populate(POPULATE);

    const [data, total] = await Promise.all([consulta, MovimientoFinancieroModel.countDocuments(filtro)]);
    return { data, meta: { total, pagina, limite, paginas: Math.ceil(total / limite) } };
  }

  async obtener(id, alcance = null) {
    const filtro = { _id: id, ...(await this.construirFiltro({ incluir_anulados: true }, alcance)) };
    const consulta = MovimientoFinancieroModel.findOne(filtro);
    if (alcance) consulta.select("-miembro").populate(POPULATE_SIN_MIEMBRO);
    else consulta.populate(POPULATE);
    const mov = await consulta;
    if (!mov) throw this.noEncontrado();
    return mov;
  }

  async fondoUtilizable(id, fecha, etiqueta) {
    const fondo = await FondoModel.findById(id).lean();
    if (!fondo) throw Boom.badRequest(`No existe: ${etiqueta}`);
    if (!fondo.activo) throw Boom.conflict(`El fondo "${fondo.nombre}" está desactivado`);
    if (new Date(fecha) < new Date(fondo.fecha_inicio)) {
      throw Boom.badRequest(`El fondo "${fondo.nombre}" empieza a registrarse el ${fondo.fecha_inicio.toISOString().slice(0, 10)}`);
    }
    return fondo;
  }

  async validarSaldo(fondo, monto) {
    const saldo = await saldoActual(fondo);
    if (saldo < monto) {
      throw Boom.conflict(`Saldo insuficiente en "${fondo.nombre}": hay S/ ${saldo.toFixed(2)}`);
    }
  }

  async crear(data, usuarioId) {
    const periodo = periodoDe(data.fecha);
    await validarPeriodoAbierto(periodo);
    const fondo = await this.fondoUtilizable(data.fondo, data.fecha, "fondo");

    if (data.categoria) {
      const cat = await CategoriaFinancieraModel.findById(data.categoria).lean();
      if (!cat) throw Boom.badRequest("No existe: categoría");
      if (cat.tipo !== data.tipo) {
        throw Boom.badRequest(`La categoría "${cat.description}" es de ${cat.tipo}s, no de ${data.tipo}s`);
      }
    }
    if (data.miembro && !(await MiembroModel.exists({ _id: data.miembro }))) {
      throw Boom.badRequest("No existe: miembro");
    }
    if (data.sesion && !(await SesionServicioModel.exists({ _id: data.sesion }))) {
      throw Boom.badRequest("No existe: sesión de culto");
    }

    if (data.tipo === "transferencia") {
      if (String(data.fondo) === String(data.fondo_destino)) {
        throw Boom.badRequest("El fondo de origen y el de destino deben ser distintos");
      }
      await this.fondoUtilizable(data.fondo_destino, data.fecha, "fondo de destino");
    }
    if (data.tipo !== "ingreso") await this.validarSaldo(fondo, data.monto);

    const mov = await MovimientoFinancieroModel.create({
      ...data,
      monto: redondear(data.monto),
      periodo,
      registrado_por: usuarioId,
    });
    await bitacoraCrear(this.nombre, mov);
    return this.obtener(mov._id);
  }

  /** Anula un movimiento (no se borra). Comprueba que el fondo no quede en negativo. */
  async anular(id, motivo, usuarioId) {
    const mov = await MovimientoFinancieroModel.findById(id);
    if (!mov) throw this.noEncontrado();
    if (mov.anulado) throw Boom.conflict("El movimiento ya está anulado");
    await validarPeriodoAbierto(mov.periodo);

    // Anular un ingreso o una transferencia resta dinero del fondo que lo recibió
    const fondoQuePierde = mov.tipo === "ingreso" ? mov.fondo : mov.tipo === "transferencia" ? mov.fondo_destino : null;
    if (fondoQuePierde) {
      const fondo = await FondoModel.findById(fondoQuePierde).lean();
      const saldo = await saldoActual(fondo);
      if (saldo < mov.monto) {
        throw Boom.conflict(
          `No se puede anular: "${fondo.nombre}" quedaría en negativo (saldo S/ ${saldo.toFixed(2)}). ` +
            "Anula primero los egresos posteriores.",
        );
      }
    }

    mov.anulado = true;
    mov.anulacion = { fecha: new Date(), motivo, usuario: usuarioId };
    await mov.save();
    await registrarEnBitacora({
      accion: "actualizar",
      recurso: this.nombre,
      documento: mov._id,
      resumen: `Anulado (${mov.tipo} de S/ ${mov.monto.toFixed(2)}): ${motivo}`,
      cambios: { anulado: { antes: false, despues: true } },
    });
    return this.obtener(mov._id);
  }
}

export default MovimientoFinancieroService;
