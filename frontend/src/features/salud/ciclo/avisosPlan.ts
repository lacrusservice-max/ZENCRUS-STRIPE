/**
 * QUÉ AVISOS TOCAN, Y QUÉ DICEN
 * ═══════════════════════════════════════════════════════════════════════════
 * La parte de los recordatorios del ciclo que decide QUÉ hay que programar y
 * con qué texto. Sin `expo-notifications` delante: aquí no se programa nada,
 * solo se calcula.
 *
 * Está separado de `avisos.ts` por una razón práctica y una de fondo. La
 * práctica: lo único que de verdad hay que probar son los textos y las fechas,
 * y con el módulo de notificaciones importado no se pueden probar. La de
 * fondo: la decisión difícil de esta función —qué se lee en la pantalla
 * bloqueada de alguien— no tiene nada que ver con temporizadores, y merece
 * poder leerse sin ellos alrededor.
 *
 * ── El texto es la decisión difícil, no el temporizador ────────────────────
 * Este módulo entero está construido para poder no existir: hay un bloqueo
 * biométrico, un modo discreto, y para quien no lo tiene activado la sección
 * ni siquiera aparece. Un aviso que dice «Tu periodo empieza mañana» en la
 * pantalla bloqueada tira todo eso por la ventana en una línea, delante de
 * quien tenga el teléfono a la vista.
 *
 * Por eso el modo discreto viene ENCENDIDO. El coste de equivocarse no es
 * simétrico: en discreto se pierde un poco de claridad —hay que abrir la app
 * para saber de qué va— y en explícito se puede delatar a alguien. Quien
 * quiera el texto claro lo enciende sabiendo lo que enciende.
 *
 * ── Solo la PRÓXIMA vez, aunque signifique quedarse callado ────────────────
 * Se podrían dejar programados dos o tres ciclos por delante para que sigan
 * sonando aunque no abra la app en meses. No se hace: la banda de predicción
 * de un ciclo siguiente es de varios días, y la del siguiente aún más. Un
 * aviso que dice «tu periodo empieza mañana» diez días después de que empezara
 * es peor que el silencio — enseña que la app no sabe de qué habla, y a partir
 * de ahí tampoco se cree lo que sí sabe.
 */

/** Todos nuestros identificadores empiezan por aquí. */
export const PREFIJO = 'ciclo_'

/**
 * Cinco avisos como mucho.
 *
 * iOS permite 64 notificaciones programadas por app y los hábitos ya reservan
 * 56. Con cinco cabemos de sobra, pero conviene que quede escrito: el día que
 * alguien quiera programar «los próximos seis ciclos», esto es lo que lo
 * impide.
 */
export const TOPE_AVISOS = 5

export type ClaveAviso = 'periodo' | 'fertil' | 'retraso' | 'registro' | 'temperatura'

export interface AjustesAvisos {
  /** Con el texto neutro, sin nombrar el ciclo. Encendido por defecto. */
  discreto: boolean
  /** A qué hora llegan los que cuelgan de una fecha. `HH:MM`. */
  hora: string
  /** Cuántos días antes del periodo previsto. `null` = apagado. */
  periodo: number | null
  /** El día que se abre la ventana fértil estimada. */
  fertil: boolean
  /** Cuántos días después del día probable, si no ha registrado sangrado. */
  retraso: number | null
  /** Hora del recordatorio de registro diario. `null` = apagado. */
  registro: string | null
  /** Hora de la temperatura basal. Va antes de levantarse. */
  temperatura: string | null
}

export const AVISOS_POR_DEFECTO: AjustesAvisos = {
  discreto: true,
  hora: '09:00',
  periodo: null,
  fertil: false,
  retraso: null,
  registro: null,
  temperatura: null,
}

/* ── Qué se lee en la pantalla bloqueada ─────────────────────────────────── */

/**
 * Los dos registros.
 *
 * En discreto, los tres avisos que cuelgan del ciclo dicen exactamente lo
 * mismo: si cada uno tuviera su propia frase neutra, la frase misma sería la
 * pista. «Tu medición de la mañana» y el registro diario sí pueden ser
 * concretos en discreto, porque no delatan de qué van — cualquiera registra
 * cosas en una app de salud.
 */
export function textoDelAviso(
  clave: ClaveAviso, ajustes: AjustesAvisos, dato: { dias?: number },
): { titulo: string; cuerpo: string } {
  if (ajustes.discreto) {
    switch (clave) {
      case 'registro':
        return { titulo: 'ZENCRUS', cuerpo: 'Un minuto para tu registro de hoy.' }
      case 'temperatura':
        return { titulo: 'ZENCRUS', cuerpo: 'Tu medición de la mañana, antes de levantarte.' }
      default:
        return { titulo: 'ZENCRUS', cuerpo: 'Tienes algo que revisar.' }
    }
  }

  const n = dato.dias ?? 0
  switch (clave) {
    case 'periodo':
      return {
        titulo: 'Tu periodo',
        cuerpo: n === 0
          ? 'Debería empezar hoy.'
          : n === 1
            ? 'Debería empezar mañana.'
            : `Debería empezar en ${n} días.`,
      }
    case 'fertil':
      /* Ni una palabra que suene a método anticonceptivo. La estimación es una
         estimación y se dice que lo es: hay apps con autorización sanitaria
         para hablar de esto de otra forma, y esta no es una de ellas. */
      return {
        titulo: 'Ventana fértil',
        cuerpo: 'Hoy empieza tu ventana fértil estimada.',
      }
    case 'retraso':
      return {
        titulo: 'Tu periodo',
        cuerpo: `Lleva ${n} ${n === 1 ? 'día' : 'días'} de retraso sobre lo previsto.`,
      }
    case 'registro':
      return { titulo: '¿Cómo te fue hoy?', cuerpo: 'Un minuto y tu predicción mejora.' }
    case 'temperatura':
      return {
        titulo: 'Temperatura basal',
        cuerpo: 'Tómatela antes de levantarte, que es cuando sirve.',
      }
  }
}

/* ── De ajustes a avisos ─────────────────────────────────────────────────── */

export interface Programado {
  id: string
  titulo: string
  cuerpo: string
  /** Fecha exacta, para los que cuelgan de la predicción. */
  cuando?: Date
  /** Hora del día, para los que se repiten. */
  hora?: { hour: number; minute: number }
}

const partirHora = (hhmm: string): { hour: number; minute: number } => {
  const [h, m] = hhmm.split(':').map(Number)
  return { hour: Number.isFinite(h) ? h : 9, minute: Number.isFinite(m) ? m : 0 }
}

/**
 * Una fecha local a partir de `YYYY-MM-DD` y una hora.
 *
 * Se construye por componentes y no con `new Date(cadena)`, que interpreta el
 * texto como UTC y en México adelanta el aviso al día anterior.
 */
function enFechaLocal(fecha: string, hhmm: string, desplazar = 0): Date {
  const [a, m, d] = fecha.split('-').map(Number)
  const { hour, minute } = partirHora(hhmm)
  return new Date(a, m - 1, d + desplazar, hour, minute, 0, 0)
}

export interface ContextoAvisos {
  /** Día probable del próximo periodo, `YYYY-MM-DD`. `null` sin predicción. */
  proximoPeriodo: string | null
  /** Primer día de la ventana fértil estimada. `null` si no ovula o no se sabe. */
  inicioFertil: string | null
  /** Si el modo de vida predice. En embarazo o sin ciclo, nada de esto aplica. */
  predice: boolean
}

/** Los avisos que tocan, ya con su fecha resuelta. */
export function avisosDe(
  ajustes: AjustesAvisos, ctx: ContextoAvisos, ahora = new Date(),
): Programado[] {
  const fuera: Programado[] = []

  const conFecha = (clave: ClaveAviso, cuando: Date, dias: number) => {
    // Lo que ya pasó no se programa: iOS lo dispararía al instante.
    if (cuando.getTime() <= ahora.getTime()) return
    const { titulo, cuerpo } = textoDelAviso(clave, ajustes, { dias })
    fuera.push({ id: PREFIJO + clave, titulo, cuerpo, cuando })
  }

  if (ctx.predice && ctx.proximoPeriodo) {
    if (ajustes.periodo !== null) {
      conFecha('periodo',
        enFechaLocal(ctx.proximoPeriodo, ajustes.hora, -ajustes.periodo), ajustes.periodo)
    }
    if (ajustes.retraso !== null) {
      conFecha('retraso',
        enFechaLocal(ctx.proximoPeriodo, ajustes.hora, ajustes.retraso), ajustes.retraso)
    }
  }

  if (ctx.predice && ajustes.fertil && ctx.inicioFertil) {
    conFecha('fertil', enFechaLocal(ctx.inicioFertil, ajustes.hora), 0)
  }

  /* Los dos de hora fija se programan aunque el modo no prediga: registrar
     cómo te sientes y tomarte la temperatura siguen teniendo sentido en
     embarazo o en perimenopausia, que es justo cuando más se registra. */
  for (const clave of ['registro', 'temperatura'] as const) {
    const hhmm = ajustes[clave]
    if (!hhmm) continue
    const { titulo, cuerpo } = textoDelAviso(clave, ajustes, {})
    fuera.push({ id: PREFIJO + clave, titulo, cuerpo, hora: partirHora(hhmm) })
  }

  return fuera.slice(0, TOPE_AVISOS)
}

