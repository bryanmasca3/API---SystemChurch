/**
 * Miembros hábiles para votar en asamblea. Requisitos (configurables por asamblea):
 *   1. Estado ACTIVO.
 *   2. Sin disciplina vigente.
 *   3. Mayor de edad (sin fecha de nacimiento => "por verificar", NO hábil).
 *   4. Asistencia a cultos dominicales >= X% de los domingos con culto registrado en los últimos N meses.
 *   5. Participación en la Santa Cena >= Y% de las celebraciones registradas en esos N meses.
 * Si en el periodo no hay cultos dominicales o celebraciones registradas, el requisito 4/5
 * no se puede evaluar: no bloquea y se informa como advertencia.
 */
import config from "../config/env.config.js";
import { MiembroModel } from "../models/miembro.model.js";
import { ActaDisciplinaModel } from "../models/actas.model.js";
import { ServicioModel } from "../models/servicio.model.js";
import { SesionServicioModel } from "../models/sesionServicio.model.js";
import { AsistenciaModel } from "../models/asistencia.model.js";
import { AsistenciaSantaCenaModel } from "../models/asistenciaSantaCena.model.js";
import { diaDe, edadA, restarMeses } from "../libs/fechas.js";

export const criteriosPorDefecto = () => ({
  meses: config.HABILES.MESES,
  edad_minima: config.HABILES.EDAD_MINIMA,
  asistencia_dominical_pct: config.HABILES.ASISTENCIA_DOMINICAL_PCT,
  santa_cena_pct: config.HABILES.SANTA_CENA_PCT,
});

const pct = (parte, total) => (total ? Math.round((parte / total) * 1000) / 10 : null);

/** Agrupa: clave -> Set de días distintos. */
const diasPor = (filas, clave, diaDeFila) => {
  const mapa = new Map();
  for (const f of filas) {
    const k = String(f[clave]);
    if (!mapa.has(k)) mapa.set(k, new Set());
    mapa.get(k).add(diaDeFila(f));
  }
  return mapa;
};

/**
 * @param {Date|string} fechaReferencia  Fecha de la asamblea.
 * @param {object} criterios             { meses, edad_minima, asistencia_dominical_pct, santa_cena_pct }
 * @param {object} [opciones]            { soloMiembros: ids a evaluar }
 */
export async function calcularHabiles(fechaReferencia, criterios = criteriosPorDefecto(), { soloMiembros } = {}) {
  const hasta = new Date(fechaReferencia);
  const desde = restarMeses(hasta, criterios.meses);
  const enVentana = { $gte: desde, $lte: hasta };

  const [miembros, disciplinas, serviciosDomingo, sesiones] = await Promise.all([
    MiembroModel.find(soloMiembros ? { _id: { $in: soloMiembros } } : {})
      .populate("person", "name surname doi dob")
      .populate("state", "description")
      .lean(),
    ActaDisciplinaModel.find({ estado: "vigente", anulada: false }, { miembro: 1 }).lean(),
    ServicioModel.find({ day: "domingo" }, { _id: 1 }).lean(),
    SesionServicioModel.find({ date: enVentana }, { date: 1, service: 1 }).lean(),
  ]);

  const disciplinados = new Set(disciplinas.map((d) => String(d.miembro)));
  const esDomingo = new Set(serviciosDomingo.map((s) => String(s._id)));
  const diaDeSesion = new Map(sesiones.map((s) => [String(s._id), diaDe(s.date)]));
  const sesionesDomingo = sesiones.filter((s) => esDomingo.has(String(s.service))).map((s) => s._id);
  const domingos = new Set(sesionesDomingo.map((id) => diaDeSesion.get(String(id))));

  const [asistencias, cenas] = await Promise.all([
    AsistenciaModel.find({ sesion: { $in: sesionesDomingo } }, { person: 1, sesion: 1 }).lean(),
    AsistenciaSantaCenaModel.find({ sesion: { $in: sesiones.map((s) => s._id) } }, { miembro: 1, sesion: 1 }).lean(),
  ]);
  const diaFila = (f) => diaDeSesion.get(String(f.sesion));
  const domingosPorPersona = diasPor(asistencias, "person", diaFila);
  const celebraciones = new Set(cenas.map(diaFila));
  const cenasPorMiembro = diasPor(cenas, "miembro", diaFila);

  const advertencias = [];
  if (!domingos.size) advertencias.push("No hay cultos dominicales registrados en el periodo: no se evaluó la asistencia");
  if (!celebraciones.size) advertencias.push("No hay celebraciones de Santa Cena registradas en el periodo: no se evaluó la participación");

  const resultado = miembros.map((m) => {
    const motivos = [];
    const estado = m.state?.description ?? "Sin estado";
    if (estado.toUpperCase() !== "ACTIVO") motivos.push(`Estado ${estado}`);
    if (disciplinados.has(String(m._id))) motivos.push("Disciplina vigente");

    const edad = edadA(m.person?.dob, hasta);
    if (edad === null) motivos.push("Falta fecha de nacimiento (por verificar)");
    else if (edad < criterios.edad_minima) motivos.push(`Menor de edad (${edad} años)`);

    const asistio = domingosPorPersona.get(String(m.person?._id))?.size ?? 0;
    const asistenciaPct = pct(asistio, domingos.size);
    if (domingos.size && asistenciaPct < criterios.asistencia_dominical_pct) {
      motivos.push(`Asistencia dominical ${asistenciaPct}% (${asistio} de ${domingos.size}; mínimo ${criterios.asistencia_dominical_pct}%)`);
    }

    const participo = cenasPorMiembro.get(String(m._id))?.size ?? 0;
    const cenaPct = pct(participo, celebraciones.size);
    if (celebraciones.size && cenaPct < criterios.santa_cena_pct) {
      motivos.push(`Santa Cena ${cenaPct}% (${participo} de ${celebraciones.size}; mínimo ${criterios.santa_cena_pct}%)`);
    }

    return {
      miembro: m._id,
      nombre: m.person ? `${m.person.surname}, ${m.person.name}` : "(sin persona)",
      doi: m.person?.doi ?? null,
      edad,
      estado,
      asistencia_dominical: { asistio, de: domingos.size, pct: asistenciaPct },
      santa_cena: { participo, de: celebraciones.size, pct: cenaPct },
      habil: motivos.length === 0,
      motivos,
    };
  });
  resultado.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return {
    fecha_referencia: hasta,
    periodo: { desde, hasta },
    criterios,
    domingos_con_culto: domingos.size,
    celebraciones_santa_cena: celebraciones.size,
    advertencias,
    total_miembros: resultado.length,
    total_habiles: resultado.filter((r) => r.habil).length,
    miembros: resultado,
  };
}
