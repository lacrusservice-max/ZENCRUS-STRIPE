/**
 * EL RETRASO, EL TEST Y LO QUE NO PODEMOS DECIR
 * ═══════════════════════════════════════════════════════════════════════════
 * Qué enseñar cuando la regla no llega.
 *
 * ── Lo que este archivo NO hace, y es lo primero ───────────────────────────
 * No predice embarazos. No puede. Un ciclo se retrasa por estrés, un viaje,
 * un cambio de peso, entrenar más fuerte, una infección, la tiroides, el SOP,
 * empezar o dejar un anticonceptivo, la perimenopausia — y también por un
 * embarazo. La app ve UN dato de todos esos: que la regla no llegó.
 *
 * Decir «probablemente estás embarazada» con esa información sería inventar, y
 * el daño no es simétrico: a quien lleva dos años buscando, una falsa
 * esperanza le cuesta un día entero; a quien no lo busca, un susto que no
 * tocaba. Ninguna de las dos merece eso de un teléfono.
 *
 * Y al revés tampoco: callarse el retraso sería peor. Lo útil —y lo único
 * honesto— es esto: cuántos días lleva, desde cuándo un test sería fiable, y
 * qué más suele causarlo.
 *
 * ── Por qué el test no es fiable «desde ya» ────────────────────────────────
 * Los tests de orina detectan hCG, que empieza a subir tras la implantación y
 * tarda unos días en llegar al umbral. Antes del día en que tocaba la regla
 * hay muchos falsos negativos; el día que toca ya son bastante fiables, y una
 * semana después lo son mucho. Enseñar «hazte un test» el primer día de
 * retraso es enseñar a hacerse un test que puede mentir.
 *
 * ── Y esto NO es un anticonceptivo ─────────────────────────────────────────
 * Ni esto ni la ventana fértil. Natural Cycles tiene autorización sanitaria de
 * la FDA para presentarse así; nosotros no la tenemos y no vamos a insinuarlo.
 */

import type { Prediccion } from './prediccion'
import type { RegistroDia } from '@/store/cicloStore'
import { diasEntre, sumarDias } from '@/utils/fechas'

/**
 * Días desde el día probable a partir de los cuales un test de orina es
 * razonablemente fiable.
 *
 * 0 = el día en que tocaba la regla. Antes de eso los falsos negativos son
 * frecuentes de verdad, no una nota al pie.
 */
const TEST_FIABLE_DESDE = 0

/** Y a partir de aquí, un negativo ya pesa bastante. */
const TEST_MUY_FIABLE_DESDE = 7

/**
 * Un negativo con la regla aún sin llegar deja de ser tranquilizador pasados
 * estos días: toca repetirlo o preguntar.
 */
const NEGATIVO_A_REVISAR = 7

/** Sin regla tanto tiempo, la conversación ya no es sobre un test. */
export const AUSENCIA_PARA_CONSULTA = 90

export interface LecturaDeRetraso {
  /** Días de retraso sobre el día PROBABLE. 0 o negativo si aún no toca. */
  dias: number
  /**
   * Días de retraso sobre el borde ALTO de la banda.
   *
   * Es el que manda para hablar de retraso de verdad: mientras la fecha esté
   * dentro de la banda, la regla no se está retrasando — es que la predicción
   * tiene margen, y confundir las dos cosas asusta sin motivo.
   */
  diasFueraDeBanda: number
  /** Qué se puede decir del test hoy. */
  test: 'aun_no' | 'fiable' | 'muy_fiable'
  /** Fecha desde la que el test sería fiable. */
  desdeCuandoFiable: string
  /** Un negativo registrado que ya conviene repetir. */
  negativoQueRevisar: { fecha: string; dias: number } | null
  /** Positivo registrado. Cambia toda la pantalla. */
  positivo: { fecha: string } | null
  /** Sin regla desde hace demasiado. */
  ausenciaLarga: boolean
}

export interface EntradaRetraso {
  prediccion: Prediccion | null
  logs: Record<string, RegistroDia>
  hoy: string
  /** Último inicio de periodo conocido. */
  ultimoInicio: string | null
}

/**
 * Cómo va el retraso, o `null` si no hay retraso del que hablar.
 *
 * Devolver `null` es lo normal: veintiséis de cada veintiocho días no hay nada
 * que decir aquí, y una tarjeta que aparece todos los días para decir «todo
 * bien» se convierte en algo que se aprende a no mirar.
 */
export function leerRetraso(e: EntradaRetraso): LecturaDeRetraso | null {
  const positivo = ultimoTest(e.logs, 'positivo')

  /* Un positivo manda sobre todo lo demás y se enseña aunque no haya retraso
     calculable: puede haberlo registrado antes de que la regla tocara. */
  const ausenciaLarga = !!e.ultimoInicio && diasEntre(e.ultimoInicio, e.hoy) >= AUSENCIA_PARA_CONSULTA

  if (!e.prediccion) {
    if (!positivo && !ausenciaLarga) return null
    return {
      dias: 0,
      diasFueraDeBanda: 0,
      test: 'muy_fiable',
      desdeCuandoFiable: e.hoy,
      negativoQueRevisar: null,
      positivo,
      ausenciaLarga,
    }
  }

  const banda = e.prediccion.proximoPeriodo
  const dias = diasEntre(banda.likely, e.hoy)
  const diasFueraDeBanda = diasEntre(banda.high, e.hoy)

  // Ni retraso, ni positivo, ni ausencia: no hay nada que contar.
  if (diasFueraDeBanda < 1 && !positivo && !ausenciaLarga) return null

  const test: LecturaDeRetraso['test'] =
    dias >= TEST_MUY_FIABLE_DESDE ? 'muy_fiable'
      : dias >= TEST_FIABLE_DESDE ? 'fiable'
        : 'aun_no'

  return {
    dias,
    diasFueraDeBanda,
    test,
    desdeCuandoFiable: sumarDias(banda.likely, TEST_FIABLE_DESDE),
    negativoQueRevisar: negativoAntiguo(e.logs, e.hoy),
    positivo,
    ausenciaLarga,
  }
}

/** El último test de embarazo con un resultado concreto. */
function ultimoTest(
  logs: Record<string, RegistroDia>,
  resultado: 'positivo' | 'negativo',
): { fecha: string } | null {
  const fechas = Object.keys(logs).sort().reverse()
  for (const f of fechas) {
    const p = logs[f]?.prueba as { type?: string; result?: string } | undefined
    if (p?.type === 'embarazo' && p.result === resultado) return { fecha: f }
  }
  return null
}

/**
 * Un negativo de hace más de una semana con la regla aún sin llegar.
 *
 * Es el caso que más se pasa por alto: se hace el test demasiado pronto, sale
 * negativo, y ya nadie vuelve a mirarlo. Un negativo tiene fecha de caducidad
 * mientras la regla siga sin aparecer.
 */
function negativoAntiguo(
  logs: Record<string, RegistroDia>,
  hoy: string,
): { fecha: string; dias: number } | null {
  const neg = ultimoTest(logs, 'negativo')
  if (!neg) return null
  const dias = diasEntre(neg.fecha, hoy)
  return dias >= NEGATIVO_A_REVISAR ? { fecha: neg.fecha, dias } : null
}

/* ── Lo que se enseña ──────────────────────────────────────────────────── */

export interface MensajeRetraso {
  titulo: string
  cuerpo: string
  /** `alta` pinta la tarjeta en rojo; `media` en ámbar; `info` neutra. */
  tono: 'info' | 'media' | 'alta'
  /** Lo que se puede hacer ahora. `null` si solo es informativo. */
  accion: 'registrar_test' | 'consultar' | 'cambiar_a_embarazo' | null
}

/**
 * El texto, ya decidido.
 *
 * Vive aquí y no en la pantalla porque estas frases son la parte delicada del
 * módulo entero: son las que no pueden prometer nada, las que no pueden
 * asustar y las que tienen que ser útiles igualmente. Escritas dentro de un
 * `<Text>` acabarían reescribiéndose a ojo la próxima vez que alguien retoque
 * la pantalla.
 */
export function mensajeDeRetraso(r: LecturaDeRetraso): MensajeRetraso {
  if (r.positivo) {
    return {
      titulo: 'Registraste un test positivo',
      cuerpo:
        'Un test de orina positivo acierta casi siempre, pero quien lo confirma '
        + 'es una consulta médica: hace falta comprobar que todo va donde tiene '
        + 'que ir y desde cuándo. Si quieres, cambio la app al modo embarazo y '
        + 'dejo de predecirte reglas.',
      tono: 'info',
      accion: 'cambiar_a_embarazo',
    }
  }

  if (r.ausenciaLarga) {
    return {
      titulo: 'Llevas tres meses sin regla',
      cuerpo:
        'Sin una explicación conocida —un embarazo, la lactancia, un '
        + 'anticonceptivo continuo, la menopausia—, tres ciclos ausentes son '
        + 'motivo de consulta. No es una urgencia y casi nunca es algo grave, '
        + 'pero sí es algo que conviene mirar con alguien.',
      tono: 'alta',
      accion: 'consultar',
    }
  }

  if (r.negativoQueRevisar) {
    return {
      titulo: `Ese test negativo ya tiene ${r.negativoQueRevisar.dias} días`,
      cuerpo:
        'Un negativo deja de valer si la regla sigue sin llegar: pudo hacerse '
        + 'demasiado pronto. Repetirlo ahora sería más fiable, y si vuelve a '
        + 'salir negativo con la regla aún ausente, la pregunta ya no es del '
        + 'test.',
      tono: 'media',
      accion: 'registrar_test',
    }
  }

  const d = r.diasFueraDeBanda

  if (r.test === 'aun_no') {
    return {
      titulo: 'Tu regla está al caer',
      cuerpo:
        'Todavía dentro del margen de la predicción, así que aún no es un '
        + 'retraso. Si te estás preguntando por un test, esperar a que pase el '
        + 'día previsto lo hace mucho más fiable: antes de eso los falsos '
        + 'negativos son frecuentes.',
      tono: 'info',
      accion: null,
    }
  }

  return {
    titulo: d === 1 ? 'Un día de retraso' : `${d} días de retraso`,
    cuerpo:
      (r.test === 'muy_fiable'
        ? 'A estas alturas un test de embarazo es fiable, salga lo que salga. '
        : 'Ya pasó el día previsto, así que un test de embarazo sería fiable. ')
      + 'Y si sale negativo, un ciclo se retrasa por muchas más cosas: estrés, '
      + 'un viaje, dormir mal, cambios de peso, entrenar más fuerte, una '
      + 'infección o un cambio de anticonceptivo. Un retraso suelto casi nunca '
      + 'significa nada.',
    tono: d >= 7 ? 'media' : 'info',
    accion: 'registrar_test',
  }
}

/**
 * ¿La temperatura lleva tantos días alta que merece mencionarse?
 *
 * Tras la ovulación la progesterona sube la basal unas décimas y la mantiene
 * ahí hasta que baja justo antes de la regla. Si NO baja y sigue alta más de
 * dieciocho días desde el cambio térmico, es el signo clásico que hace pensar
 * en un embarazo — y sigue sin ser un diagnóstico: una temperatura alta la da
 * también una infección, dormir mal, alcohol la noche anterior o medirse a
 * otra hora.
 *
 * Devuelve los días sostenidos, o `null` si no hay nada que decir.
 */
export function mesetaTermicaSostenida(
  cambio: { dia: string } | null,
  lecturas: { fecha: string; celsius: number }[],
  hoy: string,
): number | null {
  if (!cambio) return null
  const dias = diasEntre(cambio.dia, hoy)
  if (dias < 18) return null

  /* Y que de verdad se haya seguido midiendo: dieciocho días sin una sola
     lectura no son una meseta, son un hueco. Se pide al menos una medición en
     los últimos cuatro días. */
  const reciente = lecturas.some(l => diasEntre(l.fecha, hoy) <= 4 && l.fecha >= cambio.dia)
  return reciente ? dias : null
}
