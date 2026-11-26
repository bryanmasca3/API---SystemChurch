/**
 * Nombres de modelo de Mongoose (determinan la colección en MongoDB).
 * Se conservan EXACTAMENTE los nombres originales para no perder los datos existentes.
 * Usar siempre estas constantes en los `ref` para evitar referencias rotas.
 */
export const MODELOS = Object.freeze({
  // Ubigeo
  UBIGEO_DEPARTAMENTO: "util_departament",
  UBIGEO_PROVINCIA: "util_province",
  UBIGEO_DISTRITO: "util_district",

  // Catálogos
  GENERO: "util_gender",
  ESTADO_CIVIL: "util_civilstatus",
  TIPO_MEMBRESIA: "util_typemembership",
  ESTADO: "util_state",
  TIPO_REUNION: "util_typemeeting",
  ROL_MIEMBRO: "util_rolemember",

  // Personas
  PERSONA: "per_person",
  MIEMBRO: "per_member",
  ADHERENTE: "per_aderent",
  ROL_LIMPIEZA: "per_cleanrole",

  // Departamentos y servicios
  DEPARTAMENTO: "dep_departament",
  SERVICIO: "dep_service",
  SESION_SERVICIO: "dep_serviceasistancestruct",
  ASISTENCIA: "dep_serviceasistance",
  ASISTENCIA_SANTA_CENA: "dep_serviceasistanceholy",

  // Reuniones
  REUNION: "met_meeting",
  REUNION_MIEMBRO: "met_meetmember",
  MIEMBRO_DEPARTAMENTO: "met_memberdepartament",

  // Seguridad (colecciones nuevas)
  USUARIO: "seg_usuario",
  BITACORA: "seg_bitacora",

  // Inventario (colecciones nuevas)
  CATEGORIA_INVENTARIO: "util_categoriainventario",
  BIEN: "inv_bien",
  MOVIMIENTO_INVENTARIO: "inv_movimiento",

  // Finanzas (colecciones nuevas)
  FONDO: "fin_fondo",
  CATEGORIA_FINANCIERA: "fin_categoria",
  MOVIMIENTO_FINANCIERO: "fin_movimiento",
  CIERRE_MENSUAL: "fin_cierre",

  // Registro eclesiástico (colecciones nuevas)
  FAMILIA: "ecl_familia",
  EVENTO_MEMBRESIA: "ecl_evento_membresia",
  ACTA_BAUTISMO: "ecl_acta_bautismo",
  ACTA_MATRIMONIO: "ecl_acta_matrimonio",
  ACTA_DISCIPLINA: "ecl_acta_disciplina",
  OFICIAL: "ecl_oficial",
  CONTADOR: "ecl_contador",

  // Cartilla administrativa (colecciones nuevas)
  ACTA_DEDICACION: "ecl_acta_dedicacion",
  ASAMBLEA: "ecl_asamblea",
  INSCRIPCION: "dep_inscripcion",
  DON: "util_don",

  // Pastoral (colecciones nuevas)
  VISITA: "pas_visita",
  CASO_DIACONIA: "pas_caso",
  PETICION_ORACION: "pas_peticion",
  SEGUIMIENTO: "pas_seguimiento",

  // Calendario
  EVENTO: "cal_evento",
});

/**
 * Colecciones con nombre explícito (las nuevas), para evitar la pluralización
 * automática en inglés de Mongoose ("inv_bien" -> "inv_biens").
 */
export const COLECCIONES = Object.freeze({
  [MODELOS.BITACORA]: "seg_bitacora",
  [MODELOS.CATEGORIA_INVENTARIO]: "util_categoriasinventario",
  [MODELOS.BIEN]: "inv_bienes",
  [MODELOS.MOVIMIENTO_INVENTARIO]: "inv_movimientos",
  [MODELOS.FONDO]: "fin_fondos",
  [MODELOS.CATEGORIA_FINANCIERA]: "fin_categorias",
  [MODELOS.MOVIMIENTO_FINANCIERO]: "fin_movimientos",
  [MODELOS.CIERRE_MENSUAL]: "fin_cierres",
  [MODELOS.FAMILIA]: "ecl_familias",
  [MODELOS.EVENTO_MEMBRESIA]: "ecl_eventos_membresia",
  [MODELOS.ACTA_BAUTISMO]: "ecl_actas_bautismo",
  [MODELOS.ACTA_MATRIMONIO]: "ecl_actas_matrimonio",
  [MODELOS.ACTA_DISCIPLINA]: "ecl_actas_disciplina",
  [MODELOS.OFICIAL]: "ecl_oficiales",
  [MODELOS.CONTADOR]: "ecl_contadores",
  [MODELOS.ACTA_DEDICACION]: "ecl_actas_dedicacion",
  [MODELOS.ASAMBLEA]: "ecl_asambleas",
  [MODELOS.INSCRIPCION]: "dep_inscripciones",
  [MODELOS.DON]: "util_dones",
  [MODELOS.VISITA]: "pas_visitas",
  [MODELOS.CASO_DIACONIA]: "pas_casos",
  [MODELOS.PETICION_ORACION]: "pas_peticiones",
  [MODELOS.SEGUIMIENTO]: "pas_seguimientos",
  [MODELOS.EVENTO]: "cal_eventos",
});
