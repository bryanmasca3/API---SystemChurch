import config from "../config/env.config.js";

/** Periodo contable "YYYY-MM". */
export const PERIODO_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const formato = new Intl.DateTimeFormat("en-CA", {
  timeZone: config.ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
});

/**
 * Periodo de una fecha en la zona horaria de la iglesia (America/Lima por defecto).
 * Una ofrenda del 31/03 a las 22:00 en Lima es de marzo aunque en UTC ya sea 1 de abril.
 */
export const periodoDe = (fecha) => {
  const partes = Object.fromEntries(formato.formatToParts(new Date(fecha)).map((p) => [p.type, p.value]));
  return `${partes.year}-${partes.month}`;
};

export const periodoActual = () => periodoDe(new Date());

const formatoDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: config.ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Día calendario "YYYY-MM-DD" en la zona horaria de la iglesia. */
export const diaDe = (fecha) => formatoDia.format(new Date(fecha));

/** Edad cumplida en años a una fecha dada (null si no hay fecha de nacimiento). */
export const edadA = (nacimiento, fecha = new Date()) => {
  if (!nacimiento) return null;
  const n = new Date(nacimiento);
  const f = new Date(fecha);
  let edad = f.getUTCFullYear() - n.getUTCFullYear();
  const aunNoCumple =
    f.getUTCMonth() < n.getUTCMonth() || (f.getUTCMonth() === n.getUTCMonth() && f.getUTCDate() < n.getUTCDate());
  if (aunNoCumple) edad -= 1;
  return edad;
};

/** Resta meses a una fecha (para ventanas como "los últimos 6 meses"). */
export const restarMeses = (fecha, meses) => {
  const d = new Date(fecha);
  d.setUTCMonth(d.getUTCMonth() - meses);
  return d;
};

/** "2024-03" -> "2024-02" */
export const periodoAnterior = (periodo) => {
  const [anio, mes] = periodo.split("-").map(Number);
  return mes === 1 ? `${anio - 1}-12` : `${anio}-${String(mes - 1).padStart(2, "0")}`;
};

/** Redondeo a céntimos (evita 0.30000000000000004 al sumar montos). */
export const redondear = (monto) => Math.round((monto + Number.EPSILON) * 100) / 100;
