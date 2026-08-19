/**
 * EL SCORE DE RECUPERACIÓN
 * ════════════════════════
 * Tres señales independientes, y ninguna obligatoria:
 *
 *   check-in   cómo dices que te sientes (energía, dolor, estrés)
 *   sueño      la calidad de la noche, ya puntuada de 0 a 100
 *   pulso      las pulsaciones en reposo
 *
 * ── Por qué vive aparte del store ───────────────────────────────────────────
 * Porque aquí estuvo meses un fallo que no se veía desde ninguna pantalla y que
 * ninguna prueba podía cazar mientras la lógica estuviera enredada con zustand,
 * AsyncStorage y otro store.
 *
 * El fallo: cuando no había ni una pulsación medida, `getRestingHeartRate()`
 * devolvía 65. De ese 65 salía 100 − (65−50)·2 = 70, y el score quedaba clavado
 * en 70 — en verde, a 40 px, bajo el rótulo «Score de hoy»— para cualquiera que
 * acabara de instalar la app. El `if (!parts.length) return 0` que pretendía
 * cubrir el caso vacío era código muerto: la lista nunca llegaba vacía.
 *
 * Nadie iba a descubrir eso mirando la pantalla, porque un 70 es perfectamente
 * creíble. Solo se ve preguntándole a la función qué contesta sin datos, que es
 * lo que hacen las pruebas de al lado.
 */

export interface SenalesRecuperacion {
  /** Escala 1-5 en las tres, «más alto = mejor». null si hoy no hay check-in. */
  checkIn: { energy: number; soreness: number; stress: number } | null
  /** Calidad del sueño ya convertida a 0-100. null si no se registró. */
  sueno: number | null
  /** Pulsaciones en reposo. null si no hay NINGUNA medición. */
  pulso: number | null
}

/**
 * De pulsaciones a puntos.
 *
 * 50 ppm o menos es 100; a partir de ahí baja dos puntos por pulsación. No es
 * una escala clínica: es la que ya usaba la app y se mantiene para no cambiar
 * los números de quien lleva tiempo mirándolos.
 */
export const puntosDePulso = (ppm: number): number =>
  Math.max(0, Math.min(100, 100 - (ppm - 50) * 2))

/**
 * El score, o null si no hay NADA con que calcularlo.
 *
 * null y 0 son cosas distintas y por eso no se devuelve 0: un cero en un
 * marcador de recuperación se lee como «estás hecho polvo», que es una
 * afirmación tan inventada como el 70 de antes. Lo que no sabemos, no se dice.
 *
 * El reparto: el check-in vale la mitad y lo medido la otra mitad. Con check-in
 * y nada medido, el score es el check-in — la versión anterior lo promediaba
 * consigo mismo, que es el mismo número contado dos veces.
 */
export function puntuarRecuperacion(s: SenalesRecuperacion): number | null {
  const medidas = [
    s.sueno,
    s.pulso == null ? null : puntosDePulso(s.pulso),
  ].filter((v): v is number => v != null)

  const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

  if (!s.checkIn) {
    if (!medidas.length) return null
    return Math.round(media(medidas))
  }

  const subjetivo = ((s.checkIn.energy + s.checkIn.soreness + s.checkIn.stress) / 3 / 5) * 100
  if (!medidas.length) return Math.round(subjetivo)

  return Math.round(subjetivo * 0.5 + media(medidas) * 0.5)
}

/**
 * Con qué está hecho el score.
 *
 * La pantalla lo necesita para no repetir la frase fija de antes —«se calcula
 * con sueño y frecuencia cardíaca»— cuando no hay ni sueño ni frecuencia
 * cardíaca. Un texto que nombra señales inexistentes le da coartada de dato
 * medido a lo que no lo es.
 */
export function fuentesDeRecuperacion(s: SenalesRecuperacion) {
  return {
    checkIn: s.checkIn != null,
    sueno: s.sueno != null,
    pulso: s.pulso != null,
  }
}
