import j2s from "joi-to-swagger";
import config from "../config/env.config.js";
import { createCatalogoSchema, updateCatalogoSchema } from "../schemas/catalogo.schema.js";
import { listarUbigeoSchema } from "../schemas/ubigeo.schema.js";
import {
  createPersonaSchema,
  updatePersonaSchema,
  listarPersonaSchema,
} from "../schemas/persona.schema.js";
import {
  createMiembroSchema,
  updateMiembroSchema,
  listarMiembroSchema,
} from "../schemas/miembro.schema.js";
import {
  createAdherenteSchema,
  updateAdherenteSchema,
  listarAdherenteSchema,
} from "../schemas/adherente.schema.js";
import {
  createRolLimpiezaSchema,
  updateRolLimpiezaSchema,
  listarRolLimpiezaSchema,
} from "../schemas/rolLimpieza.schema.js";
import {
  createDepartamentoSchema,
  updateDepartamentoSchema,
  createIntegranteSchema,
  updateIntegranteSchema,
} from "../schemas/departamento.schema.js";
import { createServicioSchema, updateServicioSchema } from "../schemas/servicio.schema.js";
import {
  createSesionServicioSchema,
  updateSesionServicioSchema,
  listarSesionServicioSchema,
} from "../schemas/sesionServicio.schema.js";
import {
  createAsistenciaSchema,
  updateAsistenciaSchema,
  listarAsistenciaSchema,
  createAsistenciaSantaCenaSchema,
  updateAsistenciaSantaCenaSchema,
  listarAsistenciaSantaCenaSchema,
} from "../schemas/asistencia.schema.js";
import {
  createReunionSchema,
  updateReunionSchema,
  listarReunionSchema,
  createAsistenteSchema,
} from "../schemas/reunion.schema.js";
import {
  createUsuarioSchema,
  updateUsuarioSchema,
  listarUsuarioSchema,
} from "../schemas/usuario.schema.js";
import { listarBitacoraSchema } from "../schemas/bitacora.schema.js";
import {
  createEventoSchema,
  listarEventosSchema,
  resumenMembresiaSchema,
} from "../schemas/miembro.schema.js";
import {
  createFamiliaSchema,
  updateFamiliaSchema,
  listarFamiliaSchema,
  integranteFamiliaSchema,
  parentescoSchema,
} from "../schemas/familia.schema.js";
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
} from "../schemas/actas.schema.js";
import { createOficialSchema, updateOficialSchema, listarOficialSchema } from "../schemas/oficial.schema.js";
import {
  createAsambleaSchema,
  updateAsambleaSchema,
  listarAsambleaSchema,
  asistenteAsambleaSchema,
  consultaHabilesSchema,
} from "../schemas/asamblea.schema.js";
import { padronSchema, crecimientoSchema } from "../schemas/miembro.schema.js";
import {
  createInscripcionSchema,
  updateInscripcionSchema,
  listarInscripcionSchema,
} from "../schemas/departamento.schema.js";
import { reporteAnualInventarioSchema } from "../schemas/inventario.schema.js";
import {
  programaSchema,
  generarSesionesSchema,
  createEventoSchema as createEventoCalendarioSchema,
  updateEventoSchema as updateEventoCalendarioSchema,
  listarEventoSchema as listarEventoCalendarioSchema,
  calendarioSchema,
  misAsignacionesSchema,
} from "../schemas/calendario.schema.js";
import {
  createVisitaSchema,
  updateVisitaSchema,
  listarVisitaSchema,
  createCasoSchema,
  updateCasoSchema,
  listarCasoSchema,
  createAyudaSchema,
  createPeticionSchema,
  updatePeticionSchema,
  listarPeticionSchema,
  createSeguimientoSchema,
  updateSeguimientoSchema,
  listarSeguimientoSchema,
  createAvanceSchema,
  alertasSchema,
} from "../schemas/pastoral.schema.js";
import {
  createFondoSchema,
  updateFondoSchema,
  listarFondoSchema,
  createCategoriaFinancieraSchema,
  updateCategoriaFinancieraSchema,
  listarCategoriaFinancieraSchema,
  createMovimientoFinancieroSchema,
  anularMovimientoSchema,
  listarMovimientoFinancieroSchema,
  cerrarMesSchema,
  reabrirMesSchema,
  reporteMensualSchema,
  reporteAnualSchema,
  reporteDiezmosSchema,
} from "../schemas/finanzas.schema.js";
import { PERMISOS, LISTA_ROLES, DESCRIPCION_ROLES } from "../config/permisos.js";
import { loginSchema, actualizarContrasenaSchema } from "../schemas/login.schema.js";
import {
  createBienSchema,
  updateBienSchema,
  listarBienSchema,
  createMovimientoSchema,
  listarMovimientoSchema,
  listarPrestamoSchema,
} from "../schemas/inventario.schema.js";

/**
 * Especificación OpenAPI 3 generada a partir de los MISMOS esquemas Joi que validan las rutas,
 * para que la documentación no se desincronice del código.
 * Al agregar un recurso nuevo: registrarlo en `recursos` (CRUD estándar) o en `pathsExtra`.
 */

// ---------- Helpers ----------
const aSwagger = (joiSchema) => j2s(joiSchema).swagger;

const body = (joiSchema) => ({
  required: true,
  content: { "application/json": { schema: aSwagger(joiSchema) } },
});

/** Convierte un esquema Joi de query en parámetros OpenAPI. */
const queryParams = (joiSchema) => {
  if (!joiSchema) return [];
  const { properties = {} } = aSwagger(joiSchema);
  return Object.entries(properties).map(([name, schema]) => ({
    in: "query",
    name,
    required: false,
    schema,
  }));
};

const pathParam = (name, descripcion = "ObjectId de MongoDB") => ({
  in: "path",
  name,
  required: true,
  description: descripcion,
  schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
});

const ref = (nombre) => ({ $ref: `#/components/responses/${nombre}` });

const ok = (descripcion = "OK") => ({
  description: descripcion,
  content: { "application/json": { schema: { type: "object" } } },
});
const okLista = {
  description: "OK",
  content: { "application/json": { schema: { type: "array", items: { type: "object" } } } },
};
const okPaginado = {
  description: "Página de resultados",
  content: { "application/json": { schema: { $ref: "#/components/schemas/Pagina" } } },
};

const errLectura = { 401: ref("NoAutenticado"), 403: ref("SinPermiso"), 500: ref("ErrorInterno") };
const errEscritura = { ...errLectura, 400: ref("Validacion") };

/** Texto de roles permitidos, generado desde src/config/permisos.js. */
const roles = (modulo, accion) => {
  const p = PERMISOS[modulo];
  const lista = p[accion] ?? [];
  if (accion === "leer" && lista.length === LISTA_ROLES.length) return "";
  const limitados = accion === "escribir" ? p.escribirPropio : p.leerPropio;
  const propio = limitados?.length ? ` · ${limitados.join(", ")} solo en su departamento` : "";
  const oficios = p.oficios?.length ? ` · oficiales activos: ${p.oficios.join(", ")}` : "";
  return ` — *${lista.join(", ")}${propio}${oficios}*`;
};

/** Las 5 operaciones estándar de crearCrudRouter. */
const crud = ({ ruta, tag, nombre, modulo, schemas, paginado = false }) => {
  const lee = roles(modulo, "leer");
  const escribe = roles(modulo, "escribir");
  return {
    [ruta]: {
      get: {
        tags: [tag],
        summary: `Listar ${nombre}${lee}`,
        ...(paginado && { description: "Paginado: `?pagina=1&limite=20` (máximo 100 por página)." }),
        parameters: queryParams(schemas.listar),
        responses: {
          200: paginado ? okPaginado : okLista,
          ...errLectura,
          ...(schemas.listar && { 400: ref("Validacion") }),
        },
      },
      post: {
        tags: [tag],
        summary: `Crear ${nombre}${escribe}`,
        requestBody: body(schemas.crear),
        responses: { 201: ok("Creado"), ...errEscritura, 409: ref("Conflicto") },
      },
    },
    [`${ruta}/{id}`]: {
      parameters: [pathParam("id")],
      get: {
        tags: [tag],
        summary: `Obtener ${nombre} por id${lee}`,
        responses: { 200: ok(), ...errLectura, 400: ref("Validacion"), 404: ref("NoEncontrado") },
      },
      put: {
        tags: [tag],
        summary: `Actualizar ${nombre}${escribe}`,
        description: "Actualización parcial: solo se envían los campos a cambiar (al menos uno).",
        requestBody: body(schemas.actualizar),
        responses: { 200: ok(), ...errEscritura, 404: ref("NoEncontrado"), 409: ref("Conflicto") },
      },
      delete: {
        tags: [tag],
        summary: `Eliminar ${nombre}${escribe}`,
        description: "Devuelve 409 si el registro está en uso por otras colecciones.",
        responses: {
          204: { description: "Eliminado" },
          ...errEscritura,
          404: ref("NoEncontrado"),
          409: ref("Conflicto"),
        },
      },
    },
  };
};

// ---------- Recursos CRUD ----------
const catalogos = {
  genero: "Géneros",
  "estado-civil": "Estados civiles",
  "tipo-membresia": "Tipos de membresía",
  estado: "Estados de miembro",
  "tipo-reunion": "Tipos de reunión",
  "rol-miembro": "Roles de miembro",
  don: "Dones espirituales",
  "categoria-inventario": "Categorías de inventario",
};

const recursos = [
  ...Object.entries(catalogos).map(([ruta, nombre]) => ({
    ruta: `/catalogo/${ruta}`,
    tag: "Catálogos",
    nombre: nombre.toLowerCase(),
    modulo: "catalogos",
    schemas: { crear: createCatalogoSchema, actualizar: updateCatalogoSchema },
  })),
  {
    ruta: "/usuario",
    tag: "Usuarios",
    nombre: "usuarios",
    modulo: "usuarios",
    paginado: true,
    schemas: { listar: listarUsuarioSchema, crear: createUsuarioSchema, actualizar: updateUsuarioSchema },
  },
  {
    ruta: "/persona",
    tag: "Personas",
    modulo: "personas",
    nombre: "personas",
    paginado: true,
    schemas: { listar: listarPersonaSchema, crear: createPersonaSchema, actualizar: updatePersonaSchema },
  },
  {
    ruta: "/miembro",
    tag: "Miembros",
    modulo: "miembros",
    nombre: "miembros",
    paginado: true,
    schemas: { listar: listarMiembroSchema, crear: createMiembroSchema, actualizar: updateMiembroSchema },
  },
  {
    ruta: "/adherente",
    tag: "Adherentes",
    modulo: "adherentes",
    nombre: "adherentes",
    paginado: true,
    schemas: {
      listar: listarAdherenteSchema,
      crear: createAdherenteSchema,
      actualizar: updateAdherenteSchema,
    },
  },
  {
    ruta: "/rol-limpieza",
    tag: "Rol de limpieza",
    modulo: "rolLimpieza",
    nombre: "turnos de limpieza",
    paginado: true,
    schemas: {
      listar: listarRolLimpiezaSchema,
      crear: createRolLimpiezaSchema,
      actualizar: updateRolLimpiezaSchema,
    },
  },
  {
    ruta: "/departamento",
    tag: "Departamentos",
    modulo: "departamentos",
    nombre: "departamentos",
    schemas: { crear: createDepartamentoSchema, actualizar: updateDepartamentoSchema },
  },
  {
    ruta: "/servicio",
    tag: "Servicios",
    modulo: "servicios",
    nombre: "servicios",
    schemas: { crear: createServicioSchema, actualizar: updateServicioSchema },
  },
  {
    ruta: "/sesion-servicio",
    tag: "Servicios",
    modulo: "sesiones",
    nombre: "sesiones de servicio (cada culto con su fecha)",
    paginado: true,
    schemas: {
      listar: listarSesionServicioSchema,
      crear: createSesionServicioSchema,
      actualizar: updateSesionServicioSchema,
    },
  },
  {
    ruta: "/asistencia",
    tag: "Asistencias",
    modulo: "asistencias",
    nombre: "asistencias a servicios",
    paginado: true,
    schemas: {
      listar: listarAsistenciaSchema,
      crear: createAsistenciaSchema,
      actualizar: updateAsistenciaSchema,
    },
  },
  {
    ruta: "/asistencia-santa-cena",
    tag: "Asistencias",
    modulo: "asistencias",
    nombre: "asistencias a Santa Cena",
    paginado: true,
    schemas: {
      listar: listarAsistenciaSantaCenaSchema,
      crear: createAsistenciaSantaCenaSchema,
      actualizar: updateAsistenciaSantaCenaSchema,
    },
  },
  {
    ruta: "/inventario",
    tag: "Inventario",
    modulo: "inventario",
    nombre: "bienes del inventario",
    paginado: true,
    schemas: { listar: listarBienSchema, crear: createBienSchema, actualizar: updateBienSchema },
  },
  {
    ruta: "/reunion",
    tag: "Reuniones",
    modulo: "reuniones",
    nombre: "reuniones",
    paginado: true,
    schemas: {
      listar: listarReunionSchema,
      crear: createReunionSchema,
      actualizar: updateReunionSchema,
    },
  },
];

// ---------- Finanzas ----------
recursos.push(
  {
    ruta: "/finanzas/fondos",
    tag: "Finanzas",
    nombre: "fondos (incluye saldo_actual)",
    modulo: "finanzas",
    schemas: { listar: listarFondoSchema, crear: createFondoSchema, actualizar: updateFondoSchema },
  },
  {
    ruta: "/finanzas/categorias",
    tag: "Finanzas",
    nombre: "categorías de ingresos y egresos",
    modulo: "finanzas",
    schemas: {
      listar: listarCategoriaFinancieraSchema,
      crear: createCategoriaFinancieraSchema,
      actualizar: updateCategoriaFinancieraSchema,
    },
  },
);

const periodoParam = {
  in: "path",
  name: "periodo",
  required: true,
  description: "Mes en formato AAAA-MM",
  schema: { type: "string", example: "2024-03" },
};

const pathsFinanzas = {
  "/finanzas/movimientos": {
    get: {
      tags: ["Finanzas"],
      summary: `Listar movimientos${roles("finanzas", "leer")}`,
      description:
        "Paginado. Por defecto excluye los anulados (`incluir_anulados=true` para verlos). " +
        "El líder solo ve los fondos de su departamento y sin el miembro de los diezmos.",
      parameters: queryParams(listarMovimientoFinancieroSchema),
      responses: { 200: okPaginado, ...errLectura, 400: ref("Validacion") },
    },
    post: {
      tags: ["Finanzas"],
      summary: `Registrar ingreso, egreso o transferencia${roles("finanzas", "escribir")}`,
      description:
        "- **ingreso**: `clase` = `diezmo` (con `miembro` opcional), `ofrenda` (siempre anónima) u `otro` (requiere `categoria` de ingreso).\n" +
        "- **egreso**: requiere `categoria` de egreso; opcional `beneficiario` y `comprobante`. No puede dejar el fondo en negativo.\n" +
        "- **transferencia**: de `fondo` a `fondo_destino` (p. ej. depositar la caja en el banco).\n\n" +
        "El mes se calcula de `fecha` en hora de Perú. Devuelve 409 si el mes está cerrado o el saldo no alcanza.",
      requestBody: body(createMovimientoFinancieroSchema),
      responses: { 201: ok("Creado"), ...errEscritura, 409: ref("Conflicto") },
    },
  },
  "/finanzas/movimientos/{id}": {
    parameters: [pathParam("id")],
    get: {
      tags: ["Finanzas"],
      summary: `Obtener un movimiento${roles("finanzas", "leer")}`,
      responses: { 200: ok(), ...errLectura, 404: ref("NoEncontrado") },
    },
  },
  "/finanzas/movimientos/{id}/anular": {
    parameters: [pathParam("id")],
    post: {
      tags: ["Finanzas"],
      summary: `Anular un movimiento${roles("finanzas", "escribir")}`,
      description:
        "Los movimientos no se editan ni se borran: se anulan con un motivo y dejan de contar en saldos y reportes. " +
        "409 si el mes está cerrado o si el fondo quedaría en negativo.",
      requestBody: body(anularMovimientoSchema),
      responses: { 200: ok(), ...errEscritura, 404: ref("NoEncontrado"), 409: ref("Conflicto") },
    },
  },
  "/finanzas/cierres": {
    get: {
      tags: ["Finanzas"],
      summary: "Meses cerrados — *administrador, pastor, tesorero*",
      responses: { 200: okLista, ...errLectura },
    },
    post: {
      tags: ["Finanzas"],
      summary: `Cerrar un mes${roles("finanzas", "escribir")}`,
      description:
        "Bloquea el mes (no admite movimientos nuevos ni anulaciones) y guarda los saldos de cada fondo. " +
        "Los meses anteriores con movimientos deben estar cerrados.",
      requestBody: body(cerrarMesSchema),
      responses: { 201: ok("Cerrado"), ...errEscritura, 409: ref("Conflicto") },
    },
  },
  "/finanzas/cierres/{periodo}": {
    parameters: [periodoParam],
    get: {
      tags: ["Finanzas"],
      summary: "Cierre de un mes con sus saldos — *administrador, pastor, tesorero*",
      responses: { 200: ok(), ...errLectura, 404: ref("NoEncontrado") },
    },
  },
  "/finanzas/cierres/{periodo}/reabrir": {
    parameters: [periodoParam],
    post: {
      tags: ["Finanzas"],
      summary: `Reabrir el último mes cerrado${roles("cierresReabrir", "escribir")}`,
      requestBody: body(reabrirMesSchema),
      responses: { 200: ok(), ...errEscritura, 404: ref("NoEncontrado"), 409: ref("Conflicto") },
    },
  },
  "/finanzas/reportes/mensual": {
    get: {
      tags: ["Finanzas"],
      summary: `Informe mensual${roles("finanzas", "leer")}`,
      description:
        "Saldo inicial, ingresos, egresos, transferencias y saldo final de cada fondo; ingresos por concepto " +
        "(diezmos, ofrendas, categorías) y egresos por categoría. Indica si el mes está cerrado.",
      parameters: queryParams(reporteMensualSchema),
      responses: { 200: ok(), ...errLectura, 400: ref("Validacion") },
    },
  },
  "/finanzas/reportes/anual": {
    get: {
      tags: ["Finanzas"],
      summary: `Ingresos y egresos mes a mes${roles("finanzas", "leer")}`,
      parameters: queryParams(reporteAnualSchema),
      responses: { 200: ok(), ...errLectura, 400: ref("Validacion") },
    },
  },
  "/finanzas/reportes/diezmos": {
    get: {
      tags: ["Finanzas"],
      summary: `Diezmos del año / constancia${roles("diezmos", "leer")}`,
      description:
        "Con `miembro`: constancia anual con cada diezmo y el total. Sin `miembro`: total por miembro " +
        "(para emitir constancias en lote) y el total de diezmos anónimos.",
      parameters: queryParams(reporteDiezmosSchema),
      responses: { 200: ok(), ...errLectura, 400: ref("Validacion"), 404: ref("NoEncontrado") },
    },
  },
};

// ---------- Registro eclesiástico ----------
recursos.push(
  {
    ruta: "/familia",
    tag: "Familias",
    nombre: "familias",
    modulo: "familias",
    paginado: true,
    schemas: { listar: listarFamiliaSchema, crear: createFamiliaSchema, actualizar: updateFamiliaSchema },
  },
  {
    ruta: "/oficial",
    tag: "Oficiales",
    nombre: "periodos de oficiales (pastores, ancianos, diáconos)",
    modulo: "oficiales",
    schemas: { listar: listarOficialSchema, crear: createOficialSchema, actualizar: updateOficialSchema },
  },
);

/** Libro de actas: listar, crear, obtener, editar y anular (sin eliminar). */
const libro = ({ ruta, nombre, modulo, schemas, descripcionCrear }) => ({
  [ruta]: {
    get: {
      tags: ["Actas"],
      summary: `Listar actas de ${nombre}${roles(modulo, "leer")}`,
      description: "Paginado. Excluye las anuladas salvo `incluir_anuladas=true`.",
      parameters: queryParams(schemas.listar),
      responses: { 200: okPaginado, ...errLectura, 400: ref("Validacion") },
    },
    post: {
      tags: ["Actas"],
      summary: `Registrar acta de ${nombre}${roles(modulo, "escribir")}`,
      description: `Número correlativo automático. ${descripcionCrear}`,
      requestBody: body(schemas.crear),
      responses: { 201: ok("Creada"), ...errEscritura, 409: ref("Conflicto") },
    },
  },
  [`${ruta}/{id}`]: {
    parameters: [pathParam("id")],
    get: {
      tags: ["Actas"],
      summary: `Obtener acta de ${nombre}${roles(modulo, "leer")}`,
      responses: { 200: ok(), ...errLectura, 404: ref("NoEncontrado") },
    },
    put: {
      tags: ["Actas"],
      summary: `Corregir datos del acta de ${nombre}${roles(modulo, "escribir")}`,
      requestBody: body(schemas.actualizar),
      responses: { 200: ok(), ...errEscritura, 404: ref("NoEncontrado") },
    },
  },
  [`${ruta}/{id}/anular`]: {
    parameters: [pathParam("id")],
    post: {
      tags: ["Actas"],
      summary: `Anular acta de ${nombre}${roles(modulo, "escribir")}`,
      description: "Las actas no se borran: se anulan con motivo y su número queda usado.",
      requestBody: body(anularActaSchema),
      responses: { 200: ok(), ...errEscritura, 404: ref("NoEncontrado"), 409: ref("Conflicto") },
    },
  },
});

const pathsEclesiastico = {
  ...libro({
    ruta: "/actas/bautismo",
    nombre: "bautismo",
    modulo: "actas",
    schemas: { listar: listarBautismoSchema, crear: createBautismoSchema, actualizar: updateBautismoSchema },
    descripcionCrear:
      "Solo adultos. `persona` es un id o los datos de una persona nueva. Si no es miembro, se crea como " +
      "miembro ACTIVO y su historial registra la admisión por bautismo.",
  }),
  ...libro({
    ruta: "/actas/matrimonio",
    nombre: "matrimonio",
    modulo: "actas",
    schemas: { listar: listarMatrimonioSchema, crear: createMatrimonioSchema, actualizar: updateMatrimonioSchema },
    descripcionCrear:
      "Los contrayentes quedan enlazados como cónyuges en una familia (se crea si no tienen). " +
      "Si están en familias distintas, devuelve `aviso_familia`.",
  }),
  ...libro({
    ruta: "/actas/disciplina",
    nombre: "disciplina",
    modulo: "disciplina",
    schemas: { listar: listarDisciplinaSchema, crear: createDisciplinaSchema, actualizar: updateDisciplinaSchema },
    descripcionCrear:
      "**Confidencial.** La suspensión de la Santa Cena y la exclusión cambian el estado del miembro " +
      "(DISCIPLINADO / EXCLUIDO); la amonestación no. La bitácora no guarda el motivo.",
  }),
  ...libro({
    ruta: "/actas/dedicacion",
    nombre: "dedicación de niños",
    modulo: "actas",
    schemas: { listar: listarDedicacionSchema, crear: createDedicacionSchema, actualizar: updateDedicacionSchema },
    descripcionCrear:
      "Distinta del bautismo. `nino` y cada uno de los `padres` (1 o 2) son ids o datos de personas nuevas. " +
      "El niño se suma como hijo a la familia de sus padres (se crea si no tienen).",
  }),
  "/actas/disciplina/{id}/restaurar": {
    parameters: [pathParam("id")],
    post: {
      tags: ["Actas"],
      summary: `Restaurar (levantar la medida)${roles("disciplina", "escribir")}`,
      description: "Devuelve al miembro al estado que tenía antes de la medida.",
      requestBody: body(restaurarDisciplinaSchema),
      responses: { 200: ok(), ...errEscritura, 404: ref("NoEncontrado"), 409: ref("Conflicto") },
    },
  },
  "/miembro/{id}/historial": {
    parameters: [pathParam("id", "Id del miembro")],
    get: {
      tags: ["Miembros"],
      summary: `Historial de membresía${roles("membresia", "leer")}`,
      responses: { 200: okLista, ...errLectura, 404: ref("NoEncontrado") },
    },
    post: {
      tags: ["Miembros"],
      summary: `Registrar evento de membresía${roles("membresia", "escribir")}`,
      description:
        "Cambia el estado del miembro: traslado_recibido / reafirmacion_fe → ACTIVO, traslado_enviado → TRASLADADO " +
        "(requiere `iglesia`), baja_inasistencia → INACTIVO, fallecimiento → FALLECIDO. " +
        "Debe registrarse en orden (no anterior al último evento). Bautismo y disciplina se registran con sus actas.",
      requestBody: body(createEventoSchema),
      responses: { 201: ok("Creado"), ...errEscritura, 404: ref("NoEncontrado"), 409: ref("Conflicto") },
    },
  },
  "/miembro/{id}/historial/{eventoId}": {
    parameters: [pathParam("id", "Id del miembro"), pathParam("eventoId")],
    delete: {
      tags: ["Miembros"],
      summary: `Deshacer el último evento${roles("membresia", "escribir")}`,
      description: "Solo el último y solo si se registró a mano. Devuelve al miembro a su estado anterior.",
      responses: { 204: { description: "Deshecho" }, ...errEscritura, 409: ref("Conflicto") },
    },
  },
  "/membresia/eventos": {
    get: {
      tags: ["Miembros"],
      summary: `Movimiento de membresía de toda la iglesia${roles("membresia", "leer")}`,
      parameters: queryParams(listarEventosSchema),
      responses: { 200: okPaginado, ...errLectura, 400: ref("Validacion") },
    },
  },
  "/membresia/resumen": {
    get: {
      tags: ["Miembros"],
      summary: `Resumen anual: recibidos, trasladados, bajas… y miembros por estado${roles("membresia", "leer")}`,
      parameters: queryParams(resumenMembresiaSchema),
      responses: { 200: ok(), ...errLectura, 400: ref("Validacion") },
    },
  },
  "/familia/{id}/integrantes": {
    parameters: [pathParam("id", "Id de la familia")],
    post: {
      tags: ["Familias"],
      summary: `Agregar integrante${roles("familias", "escribir")}`,
      description: "Una persona solo puede estar en una familia, y cada familia tiene como máximo una cabeza.",
      requestBody: body(integranteFamiliaSchema),
      responses: { 201: ok(), ...errEscritura, 404: ref("NoEncontrado"), 409: ref("Conflicto") },
    },
  },
  "/familia/{id}/integrantes/{personaId}": {
    parameters: [pathParam("id", "Id de la familia"), pathParam("personaId")],
    put: {
      tags: ["Familias"],
      summary: `Cambiar parentesco${roles("familias", "escribir")}`,
      requestBody: body(parentescoSchema),
      responses: { 200: ok(), ...errEscritura, 404: ref("NoEncontrado") },
    },
    delete: {
      tags: ["Familias"],
      summary: `Quitar integrante${roles("familias", "escribir")}`,
      responses: { 200: ok(), ...errEscritura, 404: ref("NoEncontrado") },
    },
  },
  "/oficial/consistorio": {
    get: {
      tags: ["Oficiales"],
      summary: `Composición actual: consistorio, ancianos, diáconos y pastores${roles("oficiales", "leer")}`,
      responses: { 200: ok(), ...errLectura },
    },
  },
};

// ---------- Cartilla administrativa ----------
recursos.push({
  ruta: "/asamblea",
  tag: "Asambleas",
  nombre: "asambleas (incluye quórum)",
  modulo: "asambleas",
  paginado: true,
  schemas: { listar: listarAsambleaSchema, crear: createAsambleaSchema, actualizar: updateAsambleaSchema },
});

const CRITERIOS_HABIL =
  "Requisitos: estado ACTIVO, sin disciplina vigente, mayor de edad (sin fecha de nacimiento = 'por verificar', no hábil), " +
  "asistencia a cultos dominicales y participación en la Santa Cena por encima del mínimo en los últimos N meses. " +
  "Cada miembro trae `habil` y `motivos`. Si no hay cultos o Santa Cenas registrados, ese requisito no se evalúa (ver `advertencias`).";

const pathsCartilla = {
  "/asamblea/habiles": {
    get: {
      tags: ["Asambleas"],
      summary: `Consultar miembros hábiles a una fecha${roles("asambleas", "leer")}`,
      description: `${CRITERIOS_HABIL} Por defecto: 6 meses, 18 años, 50% de domingos y 50% de Santa Cenas.`,
      parameters: queryParams(consultaHabilesSchema),
      responses: { 200: ok(), ...errLectura, 400: ref("Validacion") },
    },
  },
  "/asamblea/{id}/habiles": {
    parameters: [pathParam("id")],
    get: {
      tags: ["Asambleas"],
      summary: `Lista de miembros hábiles de la asamblea${roles("asambleas", "leer")}`,
      description: `${CRITERIOS_HABIL} Si el padrón está congelado, respeta esa lista.`,
      responses: { 200: ok(), ...errLectura, 404: ref("NoEncontrado") },
    },
  },
  "/asamblea/{id}/habiles/congelar": {
    parameters: [pathParam("id")],
    post: {
      tags: ["Asambleas"],
      summary: `Congelar el padrón de hábiles${roles("asambleas", "escribir")}`,
      description: "Fija la lista de hábiles de esta asamblea. Debe hacerse antes de registrar asistentes.",
      responses: { 200: ok(), ...errEscritura, 404: ref("NoEncontrado"), 409: ref("Conflicto") },
    },
  },
  "/asamblea/{id}/asistentes": {
    parameters: [pathParam("id")],
    post: {
      tags: ["Asambleas"],
      summary: `Registrar asistente${roles("asambleas", "escribir")}`,
      description: "Se guarda si es hábil para votar. La respuesta incluye el `quorum` (mitad más uno de los hábiles).",
      requestBody: body(asistenteAsambleaSchema),
      responses: { 201: ok(), ...errEscritura, 404: ref("NoEncontrado"), 409: ref("Conflicto") },
    },
  },
  "/asamblea/{id}/asistentes/{miembroId}": {
    parameters: [pathParam("id"), pathParam("miembroId")],
    delete: {
      tags: ["Asambleas"],
      summary: `Quitar asistente${roles("asambleas", "escribir")}`,
      responses: { 200: ok(), ...errEscritura, 404: ref("NoEncontrado") },
    },
  },
  "/membresia/padron": {
    get: {
      tags: ["Miembros"],
      summary: `Padrón de miembros${roles("membresia", "leer")}`,
      description: "Lista numerada por apellido con DNI, edad, contacto, forma y fecha de ingreso, bautismo y estado. Filtro opcional por estado.",
      parameters: queryParams(padronSchema),
      responses: { 200: ok(), ...errLectura },
    },
  },
  "/membresia/crecimiento": {
    get: {
      tags: ["Miembros"],
      summary: `Monitoreo de crecimiento – decrecimiento${roles("membresia", "leer")}`,
      description:
        "Mes a mes (por defecto los últimos 12): miembros activos al cierre (reconstruido desde el historial), " +
        "altas, bajas, neto y asistencia promedio a cultos dominicales. Para graficar.",
      parameters: queryParams(crecimientoSchema),
      responses: { 200: ok(), ...errLectura, 400: ref("Validacion") },
    },
  },
  "/departamento/{id}/inscritos": {
    parameters: [pathParam("id", "Id del departamento o ministerio")],
    get: {
      tags: ["Departamentos"],
      summary: "Inscritos del ministerio (niños, adolescentes, jóvenes)",
      description: "Personas inscritas, sean o no miembros, con su edad y apoderado. `activo=todos` incluye retirados.",
      parameters: queryParams(listarInscripcionSchema),
      responses: { 200: okLista, ...errLectura, 404: ref("NoEncontrado") },
    },
    post: {
      tags: ["Departamentos"],
      summary: `Inscribir${roles("integrantes", "escribir")}`,
      description: "`persona` es un id o los datos de una persona nueva (p. ej. un niño); `apoderado` es el padre, madre o tutor.",
      requestBody: body(createInscripcionSchema),
      responses: { 201: ok(), ...errEscritura, 404: ref("NoEncontrado"), 409: ref("Conflicto") },
    },
  },
  "/departamento/{id}/inscritos/{inscripcionId}": {
    parameters: [pathParam("id"), pathParam("inscripcionId")],
    put: {
      tags: ["Departamentos"],
      summary: `Editar o retirar (activo: false)${roles("integrantes", "escribir")}`,
      requestBody: body(updateInscripcionSchema),
      responses: { 200: ok(), ...errEscritura, 404: ref("NoEncontrado") },
    },
    delete: {
      tags: ["Departamentos"],
      summary: `Eliminar inscripción${roles("integrantes", "escribir")}`,
      responses: { 204: { description: "Eliminada" }, ...errEscritura, 404: ref("NoEncontrado") },
    },
  },
  "/persona/dones": {
    get: {
      tags: ["Personas"],
      summary: "Registro de dones, capacidades y profesiones",
      description: "Por cada don, capacidad y profesión: cuántas personas y quiénes. Además, personas por grado de instrucción.",
      responses: { 200: ok(), ...errLectura },
    },
  },
  "/inventario/reporte-anual": {
    get: {
      tags: ["Inventario"],
      summary: "Inventario anual de bienes",
      description: "Por bien: unidades al 1 de enero, entradas y bajas del año, unidades al 31 de diciembre y prestadas al cierre.",
      parameters: queryParams(reporteAnualInventarioSchema),
      responses: { 200: ok(), ...errLectura, 400: ref("Validacion") },
    },
  },
};

// ---------- Pastoral ----------
recursos.push(
  {
    ruta: "/pastoral/visitas",
    tag: "Pastoral",
    nombre: "visitas pastorales (las 'solo pastor' solo las ve el pastor)",
    modulo: "visitas",
    paginado: true,
    schemas: { listar: listarVisitaSchema, crear: createVisitaSchema, actualizar: updateVisitaSchema },
  },
  {
    ruta: "/pastoral/casos",
    tag: "Pastoral",
    nombre: "casos de necesitados y enfermos",
    modulo: "diaconia",
    paginado: true,
    schemas: { listar: listarCasoSchema, crear: createCasoSchema, actualizar: updateCasoSchema },
  },
  {
    ruta: "/pastoral/oracion",
    tag: "Pastoral",
    nombre: "peticiones de oración (las confidenciales: equipo pastoral y su autor)",
    modulo: "oracion",
    paginado: true,
    schemas: { listar: listarPeticionSchema, crear: createPeticionSchema, actualizar: updatePeticionSchema },
  },
  {
    ruta: "/pastoral/seguimiento",
    tag: "Pastoral",
    nombre: "seguimientos de nuevos (evangelismo y discipulado)",
    modulo: "discipulado",
    paginado: true,
    schemas: { listar: listarSeguimientoSchema, crear: createSeguimientoSchema, actualizar: updateSeguimientoSchema },
  },
);

const pathsPastoral = {
  "/pastoral/casos/{id}/ayudas": {
    parameters: [pathParam("id", "Id del caso")],
    post: {
      tags: ["Pastoral"],
      summary: `Registrar ayuda brindada${roles("diaconia", "escribir")}`,
      description:
        "Víveres, medicinas, visita, ayuda económica... Para enlazar un egreso que ya registró el tesorero, " +
        "envía `movimiento_financiero` (el monto se toma de ahí). El caso pasa a 'en_seguimiento'.",
      requestBody: body(createAyudaSchema),
      responses: { 201: ok(), ...errEscritura, 404: ref("NoEncontrado"), 409: ref("Conflicto") },
    },
  },
  "/pastoral/casos/{id}/ayudas/{ayudaId}": {
    parameters: [pathParam("id"), pathParam("ayudaId")],
    delete: {
      tags: ["Pastoral"],
      summary: `Quitar ayuda${roles("diaconia", "escribir")}`,
      responses: { 200: ok(), ...errEscritura, 404: ref("NoEncontrado") },
    },
  },
  "/pastoral/seguimiento/{id}/avances": {
    parameters: [pathParam("id")],
    post: {
      tags: ["Pastoral"],
      summary: `Registrar sesión de discipulado, nota o cambio de etapa${roles("discipulado", "escribir")}`,
      description:
        "Etapas: contacto → visitante → en_discipulado → preparacion_bautismo → integrado (o sin_seguimiento). " +
        "Al registrar su acta de bautismo, la persona pasa sola a 'integrado'.",
      requestBody: body(createAvanceSchema),
      responses: { 201: ok(), ...errEscritura, 404: ref("NoEncontrado") },
    },
  },
  "/pastoral/alertas": {
    get: {
      tags: ["Pastoral"],
      summary: `Alertas de inasistencia${roles("visitas", "leer")}`,
      description:
        "Miembros ACTIVOS sin asistencia en los últimos N domingos con culto registrado (por defecto 4). " +
        "Incluye domingos seguidos sin asistir, última asistencia, última visita y si tiene un caso abierto de diaconía.",
      parameters: queryParams(alertasSchema),
      responses: { 200: ok(), ...errLectura, 400: ref("Validacion") },
    },
  },
  "/pastoral/resumen": {
    get: {
      tags: ["Pastoral"],
      summary: `Tablero pastoral${roles("visitas", "leer")}`,
      description: "Visitas del mes, próximas visitas (7 días), casos abiertos por prioridad, peticiones activas, nuevos por etapa y alertas.",
      responses: { 200: ok(), ...errLectura },
    },
  },
};

// ---------- Calendario y programa de cultos ----------
recursos.push({
  ruta: "/calendario/eventos",
  tag: "Calendario",
  nombre: "eventos (vigilias, campañas, retiros...)",
  modulo: "calendario",
  paginado: true,
  schemas: {
    listar: listarEventoCalendarioSchema,
    crear: createEventoCalendarioSchema,
    actualizar: updateEventoCalendarioSchema,
  },
});

const pathsCalendario = {
  "/calendario": {
    get: {
      tags: ["Calendario"],
      summary: `Calendario: cultos con su programa y eventos${roles("calendario", "leer")}`,
      description:
        "Entre `desde` y `hasta` (por defecto, los próximos 31 días). Cada culto trae director, predicador (tema y texto) " +
        "y lectura bíblica (pasaje), y `funciones_pendientes` si falta asignar alguna. Filtro opcional por departamento.",
      parameters: queryParams(calendarioSchema),
      responses: { 200: ok(), ...errLectura, 400: ref("Validacion") },
    },
  },
  "/calendario/mis-asignaciones": {
    get: {
      tags: ["Calendario"],
      summary: "Mis asignaciones: cuándo me toca dirigir, predicar o leer",
      description: "Del usuario autenticado (debe estar vinculado a un miembro), desde hoy o desde `desde`.",
      parameters: queryParams(misAsignacionesSchema),
      responses: { 200: okLista, ...errLectura, 400: ref("Validacion") },
    },
  },
  "/sesion-servicio/generar": {
    post: {
      tags: ["Calendario"],
      summary: `Generar los cultos de un periodo${roles("sesiones", "escribir")}`,
      description:
        "Crea una sesión por cada día que corresponde a cada servicio (según su día y hora de inicio), sin duplicar las existentes. " +
        "Máximo 3 meses. Los servicios sin hora de inicio se informan en `servicios_sin_horario`. El líder debe indicar los `servicios` de su departamento.",
      requestBody: body(generarSesionesSchema),
      responses: { 201: ok(), ...errEscritura },
    },
  },
  "/sesion-servicio/{id}/programa": {
    parameters: [pathParam("id", "Id de la sesión (culto)")],
    put: {
      tags: ["Calendario"],
      summary: `Asignar director, predicador y lectura bíblica${roles("sesiones", "escribir")}`,
      description:
        "Solo se envían las funciones que cambian. Cada una es `{ miembro }` o `{ invitado, iglesia }`; el predicador admite " +
        "`tema` y `texto_biblico`, y la lectura `pasaje`. `null` quita la asignación.",
      requestBody: body(programaSchema),
      responses: { 200: ok(), ...errEscritura, 404: ref("NoEncontrado") },
    },
  },
};

// ---------- Rutas fuera del CRUD estándar ----------
const pathsExtra = {
  ...pathsCalendario,
  ...pathsFinanzas,
  ...pathsEclesiastico,
  ...pathsCartilla,
  ...pathsPastoral,
  "/bitacora": {
    get: {
      tags: ["Bitácora"],
      summary: `Historial de cambios y accesos${roles("bitacora", "leer")}`,
      description:
        "Quién creó, modificó o eliminó cada registro (con los valores antes y después), " +
        "los movimientos de inventario y los inicios de sesión, incluidos los fallidos. " +
        "Filtra por usuario, acción, recurso (\"Miembro\", \"Bien\"...), documento y fechas.",
      parameters: queryParams(listarBitacoraSchema),
      responses: { 200: okPaginado, ...errLectura, 400: ref("Validacion") },
    },
  },
  "/inventario/resumen": {
    get: {
      tags: ["Inventario"],
      summary: "Totales del inventario",
      description: "Bienes, unidades, prestadas, valor total, en mal estado, préstamos vencidos y unidades por categoría.",
      responses: { 200: ok(), ...errLectura },
    },
  },
  "/inventario/movimientos": {
    get: {
      tags: ["Inventario"],
      summary: "Historial general de movimientos",
      description: "Paginado. Filtra por tipo, bien, persona y rango de fechas.",
      parameters: queryParams(listarMovimientoSchema),
      responses: { 200: okPaginado, ...errLectura, 400: ref("Validacion") },
    },
  },
  "/inventario/prestamos": {
    get: {
      tags: ["Inventario"],
      summary: "Préstamos (pendientes por defecto)",
      description:
        "estado=pendiente (no devueltos del todo), vencido (pasó la fecha prevista), devuelto o todos. " +
        "Cada préstamo trae cantidad y cantidad_devuelta.",
      parameters: queryParams(listarPrestamoSchema),
      responses: { 200: okPaginado, ...errLectura, 400: ref("Validacion") },
    },
  },
  "/inventario/{id}/movimientos": {
    parameters: [pathParam("id", "Id del bien")],
    get: {
      tags: ["Inventario"],
      summary: "Historial de movimientos de un bien",
      parameters: queryParams(listarMovimientoSchema),
      responses: { 200: okPaginado, ...errLectura, 404: ref("NoEncontrado") },
    },
    post: {
      tags: ["Inventario"],
      summary: `Registrar entrada, baja, préstamo o devolución${roles("inventario", "escribir")}`,
      description:
        "- **entrada**: compra o donación, suma a la cantidad.\n" +
        "- **baja**: se perdió, se rompió o se regaló; resta de lo disponible.\n" +
        "- **prestamo**: requiere `persona`; opcional `fecha_devolucion_prevista`.\n" +
        "- **devolucion**: requiere `prestamo` (id del préstamo); admite devoluciones parciales.\n\n" +
        "Devuelve 409 si no hay unidades disponibles o se devuelve más de lo prestado. " +
        "Los movimientos no se editan ni se borran: un error se corrige con el movimiento contrario.",
      requestBody: body(createMovimientoSchema),
      responses: {
        201: ok("{ movimiento, bien } con las cantidades actualizadas"),
        ...errEscritura,
        404: ref("NoEncontrado"),
        409: ref("Conflicto"),
      },
    },
  },
  "/login": {
    post: {
      tags: ["Autenticación"],
      summary: "Iniciar sesión",
      description: "Devuelve el usuario y un JWT. Limitado a varios intentos fallidos por IP + correo.",
      security: [],
      requestBody: body(loginSchema),
      responses: {
        200: ok("Usuario y token"),
        400: ref("Validacion"),
        401: { description: "Usuario o contraseña incorrectos" },
        429: { description: "Demasiados intentos fallidos" },
      },
    },
  },
  "/login/perfil": {
    get: {
      tags: ["Autenticación"],
      summary: "Datos del usuario autenticado",
      responses: { 200: ok(), ...errLectura },
    },
  },
  "/login/actualizar-contrasena": {
    post: {
      tags: ["Autenticación"],
      summary: "Cambiar la contraseña propia",
      requestBody: body(actualizarContrasenaSchema),
      responses: { 200: ok("Usuario y token nuevo"), ...errLectura, 400: ref("Validacion") },
    },
  },
  "/ubigeo/{nivel}": {
    get: {
      tags: ["Ubigeo"],
      summary: "Listar departamentos, provincias o distritos",
      parameters: [
        {
          in: "path",
          name: "nivel",
          required: true,
          schema: { type: "string", enum: ["departamento", "provincia", "distrito"] },
        },
        ...queryParams(listarUbigeoSchema).map((p) => ({
          ...p,
          description:
            "Código INEI del nivel superior. Ej.: provincia?padre=04 (provincias de Arequipa), distrito?padre=0401 (distritos de la provincia de Arequipa)",
        })),
      ],
      responses: { 200: okLista, ...errLectura, 400: ref("Validacion") },
    },
  },
  "/ubigeo/{nivel}/{id}": {
    get: {
      tags: ["Ubigeo"],
      summary: "Obtener un ubigeo por id",
      parameters: [
        {
          in: "path",
          name: "nivel",
          required: true,
          schema: { type: "string", enum: ["departamento", "provincia", "distrito"] },
        },
        pathParam("id"),
      ],
      responses: { 200: ok(), ...errLectura, 404: ref("NoEncontrado") },
    },
  },
  "/rol-limpieza/actual": {
    get: {
      tags: ["Rol de limpieza"],
      summary: "Próximo turno de limpieza",
      responses: { 200: ok(), ...errLectura, 404: ref("NoEncontrado") },
    },
  },
  "/departamento/{id}/integrantes": {
    parameters: [pathParam("id", "Id del departamento")],
    get: {
      tags: ["Departamentos"],
      summary: "Listar integrantes del departamento",
      responses: { 200: okLista, ...errLectura, 404: ref("NoEncontrado") },
    },
    post: {
      tags: ["Departamentos"],
      summary: `Agregar integrante${roles("integrantes", "escribir")}`,
      requestBody: body(createIntegranteSchema),
      responses: { 201: ok("Creado"), ...errEscritura, 404: ref("NoEncontrado"), 409: ref("Conflicto") },
    },
  },
  "/departamento/{id}/integrantes/{integranteId}": {
    parameters: [pathParam("id", "Id del departamento"), pathParam("integranteId")],
    put: {
      tags: ["Departamentos"],
      summary: `Cambiar el rol de un integrante${roles("integrantes", "escribir")}`,
      requestBody: body(updateIntegranteSchema),
      responses: { 200: ok(), ...errEscritura, 404: ref("NoEncontrado") },
    },
    delete: {
      tags: ["Departamentos"],
      summary: `Quitar integrante${roles("integrantes", "escribir")}`,
      responses: { 204: { description: "Eliminado" }, ...errEscritura, 404: ref("NoEncontrado") },
    },
  },
  "/reunion/{id}/asistentes": {
    parameters: [pathParam("id", "Id de la reunión")],
    get: {
      tags: ["Reuniones"],
      summary: "Listar asistentes de la reunión",
      responses: { 200: okLista, ...errLectura, 404: ref("NoEncontrado") },
    },
    post: {
      tags: ["Reuniones"],
      summary: `Registrar asistente${roles("reuniones", "escribir")}`,
      requestBody: body(createAsistenteSchema),
      responses: { 201: ok("Creado"), ...errEscritura, 404: ref("NoEncontrado"), 409: ref("Conflicto") },
    },
  },
  "/reunion/{id}/asistentes/{asistenteId}": {
    parameters: [pathParam("id", "Id de la reunión"), pathParam("asistenteId")],
    delete: {
      tags: ["Reuniones"],
      summary: `Quitar asistente${roles("reuniones", "escribir")}`,
      responses: { 204: { description: "Eliminado" }, ...errEscritura, 404: ref("NoEncontrado") },
    },
  },
};

// ---------- Documento ----------
const errorSchema = {
  type: "object",
  properties: {
    statusCode: { type: "integer" },
    error: { type: "string" },
    message: { type: "string" },
    data: { nullable: true },
  },
};
const respuestaError = (description) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

// Las rutas fijas (/actual) van antes que las de /{id}; se fusionan sin pisarse
const paths = {};
for (const grupo of [pathsExtra, ...recursos.map(crud)]) {
  for (const [ruta, ops] of Object.entries(grupo)) {
    paths[ruta] = { ...paths[ruta], ...ops };
  }
}

export const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "IEP API",
    version: "2.0.0",
    description:
      "API REST de gestión de la iglesia: miembros, departamentos, servicios, asistencias, reuniones e inventario.\n\n" +
      "1. Ejecuta **POST /login** con tu correo y contraseña.\n" +
      "2. Copia el `token` de la respuesta y pégalo en **Authorize**.\n\n" +
      "### Roles\n" +
      "Cada endpoint indica en cursiva qué roles pueden usarlo (si no indica nada, cualquier usuario con sesión). " +
      "`/login/perfil` devuelve los permisos del usuario por módulo.\n\n" +
      "| Rol | Puede |\n|---|---|\n" +
      LISTA_ROLES.map((r) => `| ${r} | ${DESCRIPCION_ROLES[r]} |`).join("\n"),
  },
  servers: [{ url: "/api/v1", description: config.NODE_ENV }],
  security: [{ bearerAuth: [] }],
  tags: [
    "Autenticación",
    "Usuarios",
    "Catálogos",
    "Ubigeo",
    "Personas",
    "Miembros",
    "Adherentes",
    "Rol de limpieza",
    "Departamentos",
    "Servicios",
    "Asistencias",
    "Reuniones",
    "Familias",
    "Actas",
    "Oficiales",
    "Asambleas",
    "Pastoral",
    "Calendario",
    "Inventario",
    "Finanzas",
    "Bitácora",
  ].map((name) => ({ name })),
  paths,
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Error: errorSchema,
      Pagina: {
        type: "object",
        properties: {
          data: { type: "array", items: { type: "object" } },
          meta: {
            type: "object",
            properties: {
              total: { type: "integer", example: 60 },
              pagina: { type: "integer", example: 1 },
              limite: { type: "integer", example: 20 },
              paginas: { type: "integer", example: 3 },
            },
          },
        },
      },
    },
    responses: {
      Validacion: respuestaError("Datos inválidos"),
      NoAutenticado: respuestaError("Token ausente, inválido o expirado"),
      SinPermiso: respuestaError("No tienes permisos para esta acción"),
      NoEncontrado: respuestaError("Registro no encontrado"),
      Conflicto: respuestaError("Duplicado o registro en uso"),
      ErrorInterno: respuestaError("Error interno del servidor"),
    },
  },
};
