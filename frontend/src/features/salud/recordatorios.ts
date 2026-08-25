/**
 * LOS RECORDATORIOS DE LOS HÁBITOS
 * ═══════════════════════════════════════════════════════════════════════════
 * Un hábito con hora y sin aviso es un post-it dentro de un cajón. La hora ya
 * se guardaba y se enseñaba al lado de la tarjeta, pero no disparaba nada.
 *
 * ── Se repiten, y esa es la decisión ───────────────────────────────────────
 * Cada hábito con hora tiene UN aviso diario que se repite (`CALENDAR` con
 * `repeats`). La alternativa —programar los próximos siete días y renovarlos
 * al abrir la app— permitiría saltarse el de hoy si ya lo cumpliste, pero se
 * apaga sola en cuanto pasas una semana sin abrir la app… que es exactamente
 * cuando más falta hace que te avise. Se prefiere que suene de más.
 *
 * El precio, dicho claro: si cumples a las 06:50 lo que tenías a las 07:00, el
 * aviso llega igual. iOS no deja saltarse una repetición suelta.
 *
 * ── El identificador lleva la llave del hábito ─────────────────────────────
 * `habito_<id>`. Así se sabe cuáles son nuestros sin guardar una lista aparte
 * que se desincronice, y borrar un hábito puede llevarse su aviso.
 *
 * ── No se reprograma lo que no cambió ──────────────────────────────────────
 * Sincronizar en cada entrada a la pantalla, borrando y volviendo a poner los
 * ocho, es pedirle a iOS trabajo para nada. Se compara con lo que ya hay y
 * solo se toca lo que de verdad cambió de hora o de nombre.
 */

import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import type { Habit } from '@/store/habitsStore'
import { requestPermissions } from '@/services/notificationService'

const PREFIJO = 'habito_'

/**
 * Los días de una alarma van en una máscara: bit 0 = lunes … bit 6 = domingo.
 * iOS numera distinto —1 es domingo y 7 el sábado—, así que hay que traducir.
 */
const A_WEEKDAY_IOS = [2, 3, 4, 5, 6, 7, 1] // lunes…domingo → iOS
export const TODOS = 127

export const diaActivo = (mascara: number, bit: number) => (mascara & (1 << bit)) !== 0
export const alternarDia = (mascara: number, bit: number) => {
  const nueva = mascara ^ (1 << bit)
  // Una alarma sin ningún día no es una alarma: para que no suene está el
  // interruptor. Quitar el último día se ignora.
  return nueva === 0 ? mascara : nueva
}

/**
 * iOS aguanta 64 avisos pendientes por app y descarta el resto EN SILENCIO.
 * Los días sueltos multiplican: siete días marcados uno a uno son siete avisos,
 * mientras que «todos» es uno solo. Se deja margen para lo que programe el
 * resto de la app.
 */
const TOPE = 56
/** La categoría que añade «Posponer» al aviso. Se registra una sola vez. */
const CATEGORIA = 'habito_alarma'
const POSPONER_MIN = 10

let categoriaLista = false

async function asegurarCategoria(): Promise<void> {
  if (categoriaLista) return
  categoriaLista = true
  try {
    await Notifications.setNotificationCategoryAsync(CATEGORIA, [
      { identifier: 'posponer', buttonTitle: `Posponer ${POSPONER_MIN} min`, options: { opensAppToForeground: false } },
      { identifier: 'hecho', buttonTitle: 'Ya está', options: { opensAppToForeground: true } },
    ])
  } catch {}
}

/** El texto del aviso. Sin emojis: el nombre del hábito ya dice qué es. */
function cuerpo(h: Habit, ranura: 'ini' | 'fin'): string {
  // Despertar y acostarse son avisos distintos aunque cuelguen del mismo
  // hábito: uno te manda a la cama y el otro te saca de ella.
  if (ranura === 'fin') return 'Arriba. Ya has dormido lo que querías.'
  // En un horario de sueño `metaSegundos` es el objetivo de horas, no un
  // cronómetro: decir «480 minutos, toca para empezar» sería absurdo.
  if (h.horaFin) return `Hora de dormir. Te levantas a las ${h.horaFin}.`
  if (h.metaSegundos) return `${Math.round(h.metaSegundos / 60)} minutos. Toca para empezar.`
  if (h.tipo === 'evitar') return 'Es la hora. A partir de ahora, evítalo.'
  return 'Es la hora.'
}

interface Aviso {
  id: string
  titulo: string
  cuerpo: string
  hour: number
  minute: number
  /** 1 a 7 al modo de iOS. Ausente = todos los días, y entonces basta UN aviso. */
  weekday?: number
  suena: boolean
  posponer: boolean
  sonido: string | null
  habitId: string
  conCronometro: boolean
}

/**
 * Todos los avisos que le tocan a un hábito.
 *
 * Un horario de sueño produce DOS: acostarse y despertar, cada uno con sus
 * propios días y su propio interruptor. El de despertar solo existe si la
 * alarma está encendida —un aviso mudo a las siete de la mañana no despierta a
 * nadie—, mientras que el de acostarse vale también como recordatorio callado.
 */
function avisosDe(h: Habit): Aviso[] {
  const salida: Aviso[] = []

  const anadir = (ranura: 'ini' | 'fin', hora: string, suena: boolean, dias: number) => {
    const [hour, minute] = hora.split(':').map(Number)
    const base = {
      titulo: ranura === 'fin' ? `Despertar · ${h.label}` : h.label,
      cuerpo: cuerpo(h, ranura),
      hour, minute, suena,
      posponer: h.alarmaPosponer,
      sonido: h.alarmaSonido,
      habitId: h.id,
      conCronometro: !!h.metaSegundos && ranura === 'ini',
    }
    if (dias === TODOS) {
      salida.push({ ...base, id: `${PREFIJO}${h.id}__${ranura}__todos` })
      return
    }
    for (let bit = 0; bit < 7; bit++) {
      if (!diaActivo(dias, bit)) continue
      salida.push({ ...base, id: `${PREFIJO}${h.id}__${ranura}__${bit}`, weekday: A_WEEKDAY_IOS[bit] })
    }
  }

  if (h.hora) anadir('ini', h.hora, h.alarma, h.alarmaDias)
  if (h.horaFin && h.alarmaFin) anadir('fin', h.horaFin, true, h.alarmaFinDias)
  return salida
}

/**
 * Deja programado exactamente un aviso por hábito con hora.
 *
 * Silenciosa a propósito: que no haya permiso, o que iOS rechace uno, no puede
 * romper la pantalla de Hábitos.
 */
export async function sincronizarRecordatorios(habits: Habit[]): Promise<void> {
  try {
    // Sin permiso no se pide aquí: pedirlo al entrar en una pantalla, sin que
    // nadie lo haya buscado, es la forma más rápida de que te lo denieguen para
    // siempre. Lo pide `pedirPermisoRecordatorios()` al guardar una hora.
    const { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') return

    const quiero = habits.flatMap(avisosDe).slice(0, TOPE)
    const puestas = await Notifications.getAllScheduledNotificationsAsync()
    const mias = puestas.filter(n => n.identifier.startsWith(PREFIJO))

    // Lo que sobra: hábitos borrados, alarmas apagadas, días desmarcados.
    for (const n of mias) {
      if (!quiero.some(a => a.id === n.identifier)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})
      }
    }

    if (quiero.some(a => a.suena && a.posponer)) await asegurarCategoria()

    for (const a of quiero) {
      const ya = mias.find(n => n.identifier === a.id)
      // Se compara con lo que hay para no rehacer lo que no cambió: borrar y
      // volver a poner cincuenta avisos en cada entrada a la pantalla es
      // pedirle a iOS trabajo para nada.
      const t = ya?.trigger as { hour?: number; minute?: number; weekday?: number } | undefined
      const igual = ya
        && t?.hour === a.hour && t?.minute === a.minute
        && (t?.weekday ?? undefined) === a.weekday
        && ya.content.title === a.titulo
        && ya.content.body === a.cuerpo
        && !!ya.content.sound === a.suena
      if (igual) continue

      if (ya) await Notifications.cancelScheduledNotificationAsync(a.id).catch(() => {})
      await Notifications.scheduleNotificationAsync({
        identifier: a.id,
        content: {
          title: a.titulo,
          body: a.cuerpo,
          // Con alarma suena y sube de prioridad; sin ella es un aviso callado.
          // `timeSensitive` es lo máximo que puede pedir una app sin el permiso
          // de alertas críticas de Apple: atraviesa el modo concentración, pero
          // no el silencio del teléfono.
          sound: a.suena ? (a.sonido ?? 'default') : undefined,
          interruptionLevel: a.suena ? 'timeSensitive' : 'active',
          categoryIdentifier: a.suena && a.posponer ? CATEGORIA : undefined,
          data: { tipo: 'habito', habitId: a.habitId, conCronometro: a.conCronometro },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour: a.hour,
          minute: a.minute,
          ...(a.weekday ? { weekday: a.weekday } : {}),
          repeats: true,
        },
      })
    }
  } catch {
    // Un aviso que no se programa no puede tumbar la pantalla.
  }
}

/**
 * Cuántos avisos ocuparía esta lista de hábitos.
 *
 * La pantalla lo usa para avisar antes de que iOS empiece a descartar en
 * silencio: marcar días sueltos multiplica, y nadie relaciona «me faltan
 * alarmas» con «marqué tres días en cinco hábitos».
 */
export function avisosQueOcupa(habits: Habit[]): { usados: number; tope: number } {
  return { usados: habits.flatMap(avisosDe).length, tope: TOPE }
}

/**
 * Pide el permiso, y solo cuando la pregunta tiene sentido: al guardar un
 * hábito con hora. Devuelve si quedó concedido.
 */
export async function pedirPermisoRecordatorios(): Promise<boolean> {
  try {
    return await requestPermissions()
  } catch {
    return false
  }
}

/** Al cerrar sesión: los avisos de quien se fue no pueden seguir sonando. */
export async function olvidarRecordatorios(): Promise<void> {
  try {
    const puestas = await Notifications.getAllScheduledNotificationsAsync()
    for (const n of puestas) {
      if (n.identifier.startsWith(PREFIJO)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})
      }
    }
  } catch {}
}

/**
 * Qué pasa al tocar el aviso.
 *
 * Si el hábito lleva cronómetro se abre la sesión directamente: el sentido de
 * avisar a las siete de que toca respirar cinco minutos es estar respirando al
 * segundo toque, no aterrizar en una lista.
 *
 * Devuelve la función para desengancharlo. Mira también si la app se ABRIÓ
 * desde el aviso —estaba cerrada del todo—, que es un caso distinto y se
 * pierde escuchando solo el evento en vivo.
 */
export function escucharRecordatorios(): () => void {
  const ir = (data: Record<string, unknown> | undefined) => {
    if (data?.tipo !== 'habito') return
    if (data.conCronometro && typeof data.habitId === 'string') {
      router.push({ pathname: '/salud/sesion', params: { id: data.habitId } })
    } else {
      router.push('/salud/habitos')
    }
  }

  const sub = Notifications.addNotificationResponseReceivedListener(res => {
    const data = res.notification.request.content.data as Record<string, unknown>
    if (data?.tipo !== 'habito') return

    /* Posponer programa UN aviso suelto dentro de diez minutos. No toca el
       diario, que sigue repitiéndose: posponer es para hoy, no para siempre. */
    if (res.actionIdentifier === 'posponer') {
      void Notifications.scheduleNotificationAsync({
        content: {
          title: res.notification.request.content.title ?? '',
          body: res.notification.request.content.body ?? '',
          sound: res.notification.request.content.sound ?? 'default',
          interruptionLevel: 'timeSensitive',
          data,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: POSPONER_MIN * 60,
          repeats: false,
        },
      }).catch(() => {})
      return
    }
    ir(data)
  })

  Notifications.getLastNotificationResponseAsync()
    .then(res => { if (res) ir(res.notification.request.content.data as Record<string, unknown>) })
    .catch(() => {})

  return () => sub.remove()
}

/**
 * ¿Este hábito es un horario de sueño?
 *
 * Se mira el nombre porque es lo único que hay al crearlo desde cero. Es una
 * SUPOSICIÓN, y por eso solo enciende el interruptor: la persona lo apaga si se
 * equivocó. Adivinar y no dejar corregir sería peor que no adivinar.
 *
 * No entra «siesta»: una siesta es un rato, no el horario de la noche, y
 * convertirla en una ventana con despertador es justo lo que nadie pidió.
 */
const PALABRAS_DE_SUENO = ['dormir', 'sueño', 'sueno', 'descansar', 'acostar', 'cama']

export function pareceHorarioDeSueno(label: string): boolean {
  const t = label.toLowerCase()
  return PALABRAS_DE_SUENO.some(p => t.includes(p))
}
