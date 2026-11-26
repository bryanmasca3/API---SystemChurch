/**
 * Roles y permisos del sistema. ÚNICA fuente de verdad: las rutas, los middlewares
 * y la documentación Swagger se generan a partir de esta matriz.
 *
 * - leer / escribir: roles con acceso completo al módulo.
 * - escribirPropio:  roles que solo pueden modificar registros de SU departamento
 *                    (los departamentos donde su miembro vinculado es integrante).
 * - leerPropio:      roles que solo pueden CONSULTAR lo de su departamento
 *                    (el servicio filtra los datos con req.alcance).
 * - oficios:         oficios ACTIVOS (registro /oficial del miembro vinculado al usuario) que dan
 *                    acceso completo al módulo, sea cual sea su rol. Al terminar el periodo, se pierde.
 */
export const ROLES = Object.freeze({
  ADMINISTRADOR: "administrador",
  PASTOR: "pastor",
  SECRETARIO: "secretario",
  TESORERO: "tesorero",
  LIDER: "lider",
  LECTOR: "lector",
});

export const LISTA_ROLES = Object.freeze(Object.values(ROLES));

export const DESCRIPCION_ROLES = Object.freeze({
  [ROLES.ADMINISTRADOR]: "Acceso total, incluida la gestión de usuarios.",
  [ROLES.PASTOR]: "Todo lo pastoral y eclesiástico; ve la bitácora y los datos confidenciales.",
  [ROLES.SECRETARIO]: "Registra miembros, asistencias, reuniones, departamentos e inventario.",
  [ROLES.TESORERO]: "Gestiona las finanzas (fondos, ingresos, egresos, cierres); consulta el resto.",
  [ROLES.LIDER]: "Consulta todo y modifica solo lo de su departamento; ve el fondo de su departamento (sin nombres de diezmantes).",
  [ROLES.LECTOR]: "Solo consulta (sin finanzas, datos pastorales ni bitácora).",
});

const { ADMINISTRADOR, PASTOR, SECRETARIO, TESORERO, LIDER, LECTOR } = ROLES;
const TODOS = [ADMINISTRADOR, PASTOR, SECRETARIO, TESORERO, LIDER, LECTOR];
const REGISTRO = [ADMINISTRADOR, PASTOR, SECRETARIO];
const FINANZAS = [ADMINISTRADOR, PASTOR, TESORERO];
const PASTORAL = [ADMINISTRADOR, PASTOR];

export const PERMISOS = Object.freeze({
  usuarios: { leer: [ADMINISTRADOR], escribir: [ADMINISTRADOR] },
  bitacora: { leer: [ADMINISTRADOR, PASTOR], escribir: [] },

  catalogos: { leer: TODOS, escribir: [ADMINISTRADOR, SECRETARIO] },
  ubigeo: { leer: TODOS, escribir: [] },

  personas: { leer: TODOS, escribir: REGISTRO },
  miembros: { leer: TODOS, escribir: REGISTRO },
  adherentes: { leer: TODOS, escribir: REGISTRO },
  rolLimpieza: { leer: TODOS, escribir: [ADMINISTRADOR, SECRETARIO] },

  departamentos: { leer: TODOS, escribir: [ADMINISTRADOR, SECRETARIO] },
  integrantes: { leer: TODOS, escribir: [ADMINISTRADOR, SECRETARIO], escribirPropio: [LIDER] },

  servicios: { leer: TODOS, escribir: REGISTRO },
  sesiones: { leer: TODOS, escribir: REGISTRO, escribirPropio: [LIDER] },
  asistencias: { leer: TODOS, escribir: REGISTRO, escribirPropio: [LIDER] },

  reuniones: { leer: TODOS, escribir: REGISTRO, escribirPropio: [LIDER] },
  inventario: { leer: TODOS, escribir: [ADMINISTRADOR, SECRETARIO], escribirPropio: [LIDER] },

  // El líder consulta el fondo de su departamento (sin ver quién diezmó)
  finanzas: { leer: FINANZAS, escribir: [ADMINISTRADOR, TESORERO], leerPropio: [LIDER] },
  // Quién dio cada diezmo: dato confidencial
  diezmos: { leer: FINANZAS, escribir: [] },
  // Reabrir un mes cerrado
  cierresReabrir: { leer: [ADMINISTRADOR], escribir: [ADMINISTRADOR] },

  // Registro eclesiástico
  familias: { leer: TODOS, escribir: REGISTRO },
  membresia: { leer: TODOS, escribir: REGISTRO },
  actas: { leer: TODOS, escribir: REGISTRO },
  // Disciplina: CONFIDENCIAL
  disciplina: { leer: [ADMINISTRADOR, PASTOR], escribir: [ADMINISTRADOR, PASTOR] },
  oficiales: { leer: TODOS, escribir: REGISTRO },
  asambleas: { leer: TODOS, escribir: REGISTRO },
  // Eventos del calendario (el líder gestiona los de su departamento)
  calendario: { leer: TODOS, escribir: REGISTRO, escribirPropio: [LIDER] },

  // Pastoral
  visitas: { leer: PASTORAL, escribir: PASTORAL, oficios: ["anciano"] },
  diaconia: { leer: PASTORAL, escribir: PASTORAL, oficios: ["anciano", "diacono"] },
  // Las confidenciales las filtra el servicio (solo pastor, administrador y ancianos)
  oracion: { leer: TODOS, escribir: TODOS },
  discipulado: {
    leer: REGISTRO,
    escribir: REGISTRO,
    oficios: ["anciano", "evangelista", "misionero", "maestro"],
  },
});

/** ¿Alguno de los oficios activos del usuario le da acceso al módulo? */
export const puedePorOficio = (oficios = [], modulo) =>
  Boolean(PERMISOS[modulo]?.oficios?.some((o) => oficios.includes(o)));

/** Pastor/administrador por rol, o anciano activo: ve lo confidencial pastoral. */
export const esPastoral = (usuario) =>
  [ADMINISTRADOR, PASTOR].includes(usuario?.rol) || Boolean(usuario?.oficios?.includes("anciano"));

/** ¿El rol tiene acceso completo a la acción del módulo? */
export const puede = (rol, modulo, accion) => Boolean(PERMISOS[modulo]?.[accion]?.includes(rol));

/** ¿El rol puede escribir en el módulo, aunque sea solo en su departamento? */
export const puedeEnSuDepartamento = (rol, modulo) =>
  Boolean(PERMISOS[modulo]?.escribirPropio?.includes(rol));

/** ¿El rol puede consultar el módulo, aunque sea solo lo de su departamento? */
export const puedeLeerSuDepartamento = (rol, modulo) =>
  Boolean(PERMISOS[modulo]?.leerPropio?.includes(rol));
