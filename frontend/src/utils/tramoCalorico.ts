/**
 * EN QUÉ TRAMO VA EL DÍA
 * ══════════════════════
 * El día calórico no es una barra de 0 a la meta: son cuatro tramos con un
 * significado distinto cada uno, y de ellos salen el color, el aviso y la frase.
 *
 *   gris      por debajo del mínimo    comer de menos también frena
 *   ámbar     mínimo cumplido          vas bien, aún no cierras
 *   verde     en la meta               el día está hecho
 *   rojo      por encima del techo     te pasaste, y cuánto
 *
 * ── Por qué vive aparte de la pantalla ──────────────────────────────────────
 * Porque lo consultan tres sitios —el arco, el aviso y la frase— y si cada uno
 * decidiera por su cuenta acabarían discrepando: el arco en verde mientras el
 * texto dice «te falta». Ya pasó con el veredicto y la leyenda.
 */

/** Los cuatro tramos, en el orden en que ocurren a lo largo del día. */
export type Tramo = 'bajo' | 'minimo' | 'meta' | 'pasado'

export interface Limites {
  /** Por debajo de esto, el déficit deja de ser sostenible. */
  minimo: number
  /** El objetivo del día. */
  meta: number
  /** El máximo asumible sin romper la semana. */
  techo: number
}

/**
 * De dónde salen los límites cuando el perfil no los trae.
 *
 * El piso ya se derivaba así (85 % de la meta) y el techo se añade simétrico:
 * un 15 % por encima. No es un número sagrado — es un margen que deja pasarse
 * una comida sin que la app grite, y que grita cuando el día se ha ido de
 * verdad. Cuando el perfil traiga `calories_max` propio, manda ese.
 */
export function limitesDe(goals: {
  calories_target?: number
  calories_min?: number
  calories_max?: number
} | null | undefined): Limites {
  const meta = goals?.calories_target ?? 2000
  return {
    meta,
    minimo: goals?.calories_min ?? Math.round(meta * 0.85),
    techo: goals?.calories_max ?? Math.round(meta * 1.15),
  }
}

/**
 * Cuatro tramos, sin zonas intermedias.
 *
 * El orden de las comparaciones importa: se pregunta primero por lo peor
 * (pasarse) y se baja. Al revés, un día de 2.500 kcal entraría por «>= meta» y
 * saldría en verde.
 */
export function tramoDe(consumido: number, l: Limites): Tramo {
  if (consumido > l.techo) return 'pasado'
  if (consumido >= l.meta) return 'meta'
  if (consumido >= l.minimo) return 'minimo'
  return 'bajo'
}

/**
 * El color de cada tramo.
 *
 * Son los ÚNICOS colores semánticos de la pantalla: no se usan para nada más.
 * El rojo de aquí (#FF3B47) no es el rojo de marca (#FF1F3D) a propósito —
 * si fueran el mismo, el fondo de la pantalla y el «te pasaste» serían
 * indistinguibles y el aviso dejaría de avisar.
 */
export const COLOR_TRAMO: Record<Tramo, string> = {
  bajo:   '#8A8D98',
  minimo: '#FFC542',
  meta:   '#29D07B',
  pasado: '#FF3B47',
}

/** Etiqueta corta, para la pastilla del centro del plato. */
export const ETIQUETA_TRAMO: Record<Tramo, string> = {
  bajo:   'POR DEBAJO',
  minimo: 'MÍNIMO',
  meta:   'EN LA META',
  pasado: 'PASADO',
}

/**
 * Dónde cae el techo dentro del arco: al 85 %, no al final.
 *
 * El 15 % que queda es sitio para pasarse. Si el arco acabara en el techo,
 * pasarse por 5 kcal y pasarse por 600 se verían idénticos —el arco lleno— y
 * el dato solo estaría en el texto. Lo que hace falta ver de un vistazo es
 * CUÁNTO te has pasado.
 */
export const FRACCION_TECHO = 0.85

/** Fin de la escala del arco. El techo cae en el 85 % de este recorrido. */
export const finDeEscala = (l: Limites) => Math.round(l.techo / FRACCION_TECHO)

/** Cuánto del arco hay pintado, de 0 a 1. */
export function fraccion(consumido: number, l: Limites): number {
  const fin = finDeEscala(l)
  return fin > 0 ? Math.min(1, Math.max(0, consumido / fin)) : 0
}

const nf = (n: number) => Math.round(n).toLocaleString('es-MX')

/**
 * La frase que SIEMPRE está.
 *
 * No repite el aviso: aquel es una tarjeta con el consejo y se puede cerrar;
 * esta es una línea que dice cómo vas y se queda. Por eso son textos distintos
 * y no el mismo dos veces.
 *
 * El tono es el de la app: directo y adulto. Nada de «¡tú puedes!» — a alguien
 * que lleva meses apuntando comidas eso le suena a burla y deja de leerlo a la
 * semana. Animan por lo que dicen: reconocen lo hecho, dicen cuánto falta, y
 * cuando te pasas quitan hierro sin esconder el dato.
 */
export function frase(consumido: number, l: Limites): string {
  const falta = l.minimo - consumido
  const aMeta = l.meta - consumido
  const margen = l.techo - consumido

  if (consumido <= 0)              return 'Aún no has apuntado nada. Empieza por lo primero del día.'
  if (consumido < l.minimo * 0.78) return `Vas arrancando. Te faltan ${nf(falta)} kcal para el mínimo.`
  if (consumido < l.minimo)        return `Ya casi. Te faltan ${nf(falta)} kcal para el mínimo.`
  if (consumido < l.meta * 0.94)   return `Mínimo cubierto. Te faltan ${nf(aMeta)} para la meta.`
  if (consumido < l.meta)          return `A un paso: ${nf(aMeta)} kcal y cierras el día.`
  if (consumido === l.meta)        return 'Meta clavada. Difícil hacerlo mejor.'
  if (margen > 200)                return `Vas excelente. Te quedan ${nf(margen)} de margen.`
  if (consumido <= l.techo)        return `En la meta, y quedan ${nf(margen)} hasta el techo.`
  if (consumido - l.techo < 150)   return `Te pasaste ${nf(consumido - l.techo)} kcal del techo. Casi nada, la verdad.`
  return `Te pasaste ${nf(consumido - l.techo)} kcal del techo. Un día no rompe nada.`
}

/** El aviso largo, el que se puede cerrar. */
export interface Aviso {
  titulo: string
  cuerpo: string
  tramo: Tramo
}

export function aviso(consumido: number, l: Limites): Aviso {
  const t = tramoDe(consumido, l)
  if (t === 'pasado') return {
    tramo: t,
    titulo: `Te pasaste ${nf(consumido - l.techo)} kcal del techo`,
    cuerpo: `Un día no define la semana. Mañana bajamos ${nf(Math.min(consumido - l.techo, 300))} kcal y quedamos parejos.`,
  }
  if (t === 'meta') return {
    tramo: t,
    titulo: 'Meta cumplida',
    cuerpo: `Tienes ${nf(l.techo - consumido)} kcal de margen hasta el techo.`,
  }
  if (t === 'minimo') return {
    tramo: t,
    titulo: 'Has pasado el mínimo',
    cuerpo: `Te quedan ${nf(l.meta - consumido)} kcal hasta la meta.`,
  }
  return {
    tramo: t,
    titulo: `Te faltan ${nf(l.minimo - consumido)} kcal para el mínimo`,
    cuerpo: `Tu piso son ${nf(l.minimo)} kcal. Comer de menos también frena el progreso.`,
  }
}
