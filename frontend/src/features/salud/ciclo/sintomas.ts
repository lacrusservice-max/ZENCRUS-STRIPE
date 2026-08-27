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
