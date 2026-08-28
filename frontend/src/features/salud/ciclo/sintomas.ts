/**
 * QUÉ SÍNTOMAS TIENE UN DÍA
 * ═══════════════════════════════════════════════════════════════════════════
 * Los síntomas no se guardan en una lista: viven repartidos en tres trackers
 * —dolor por zonas, digestión por etiquetas y piel por etiquetas— porque así
 * es como se registran. Esta función los junta en un conjunto de nombres
 * legibles, que es como se cuentan.
 *
 * Estaba escrito dentro de la pantalla de estadísticas, y en cuanto una
 * segunda pantalla necesitó lo mismo dejó de poder estar ahí: dos copias del
 * mapa de etiquetas significan que el día que se añada un síntoma nuevo,
 * aparecerá en un sitio y no en el otro, y nadie se dará cuenta hasta que
 * alguien compare dos porcentajes que no cuadran.
 */

export const ETIQUETA_ZONA: Record<string, string> = {
  abdomen_bajo: 'Cólicos',
  cabeza: 'Dolor de cabeza / Migraña',
  lumbar: 'Dolor lumbar',
  pecho: 'Sensibilidad en senos',
  ovarios: 'Dolor de ovarios',
  piernas: 'Dolor muscular',
  articulaciones: 'Dolor articular',
  vulva: 'Molestia vulvar',
}

export const ETIQUETA_TAG: Record<string, string> = {
  hinchazon: 'Inflamación abdominal',
  nauseas: 'Náuseas',
  diarrea: 'Diarrea',
  estrenimiento: 'Estreñimiento',
  acne: 'Acné',
  grasa: 'Piel grasa',
  seca: 'Piel seca',
  cabello_graso: 'Cabello graso',
}

/**
 * Los síntomas de un día, sin repetir.
 *
 * Un conjunto y no una lista: marcar «acné» en piel y volver a marcarlo desde
 * otro sitio sigue siendo un día con acné, no dos.
 */
export function marcasDelDia(dia: Record<string, unknown>): Set<string> {
  const marcas = new Set<string>()

  const dolor = dia.dolor as { zones?: { id: string }[] } | undefined
  dolor?.zones?.forEach(z => marcas.add(ETIQUETA_ZONA[z.id] ?? z.id))

  const dig = dia.digestion as { tags?: string[] } | undefined
  dig?.tags?.forEach(t => marcas.add(ETIQUETA_TAG[t] ?? t))

  const piel = dia.piel as { tags?: string[] } | undefined
  piel?.tags?.forEach(t => marcas.add(ETIQUETA_TAG[t] ?? t))

  return marcas
}

/**
 * Con qué frecuencia aparece cada síntoma, sobre los días CON registro.
 *
 * El denominador son los días que ella apuntó algo, no los días transcurridos.
 * Dividir entre los del mes castigaría a quien registra poco inventándole una
 * mejoría que no existe: dejas de apuntar una semana y «cólicos» baja del 60 %
 * al 30 % sin que su cuerpo haya cambiado nada.
 *
 * Vivía dentro de la pantalla de estadísticas. Salió de ahí en cuanto el
 * informe para consulta necesitó los mismos números: dos cuentas del mismo
 * porcentaje acaban dando dos porcentajes, y de los dos sitios el que menos
 * puede permitírselo es el papel que se lleva al médico.
 */
export function frecuenciaSintomas(
  logs: Record<string, Record<string, unknown>>,
  desde: string, hasta: string,
  tope = 4,
): { dias: number; top: { etiqueta: string; n: number; pct: number }[] } {
  const cuenta = new Map<string, number>()
  let dias = 0

  for (const [fecha, dia] of Object.entries(logs)) {
    if (fecha < desde || fecha > hasta) continue
    const marcas = marcasDelDia(dia)

    if (!marcas.size && !Object.keys(dia).length) continue
    dias++
    marcas.forEach(m => cuenta.set(m, (cuenta.get(m) ?? 0) + 1))
  }

  const top = [...cuenta.entries()]
    .map(([etiqueta, n]) => ({ etiqueta, n, pct: dias ? (n / dias) * 100 : 0 }))
    .sort((a, b) => b.n - a.n)
    .slice(0, tope)

  return { dias, top }
}
