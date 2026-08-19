/**
 * CÓMO SE SIENTE ZENCRUS
 * ══════════════════════
 * Siete gestos, cada uno con un significado. Se pide por lo que PASÓ —`logro()`,
 * `ojo()`— y no por la intensidad, que es cosa de este fichero.
 *
 * ── Por qué no vale con llamar a expo-haptics ───────────────────────────────
 * Porque ya se hacía, y así estaba: 78 vibraciones repartidas por 32 ficheros,
 * y 50 de ellas eran `selectionAsync()` —la más floja— puesta en todo. Añadir
 * un alimento, cambiar de pestaña y borrar una comida se sentían idénticos, y
 * cuando todo vibra igual el móvil deja de estar diciendo nada. Peor aún:
 * Nutrición, Salud, Inicio, Perfil, Ajustes y el chat no vibraban NUNCA, así
 * que media app estaba muda y la otra media zumbaba a un solo tono.
 *
 * ── La regla que hace que esto funcione ─────────────────────────────────────
 * La intensidad no la elige quien escribe la pantalla: la elige el significado.
 * Si mañana `confirmar()` resulta ser demasiado fuerte, se baja aquí y baja en
 * toda la app a la vez.
 *
 * ── Y una que se olvida siempre ─────────────────────────────────────────────
 * Vibrar de más cansa más rápido que vibrar de menos. Nada de háptica al hacer
 * scroll, al abrir una pantalla, ni al recibir datos: el móvil solo contesta a
 * lo que hace la persona, o le avisa de algo que le importa.
 */

import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const CLAVE = 'zencrus-haptica'

/* Android tiene el motor de vibración mucho más basto: lo que en iPhone es un
   golpecito seco, ahí es un zumbido. Los gestos finos —elegir, tocar— se
   quedan en silencio en Android y solo se dejan los que llevan información. */
const FINO = Platform.OS === 'ios'

let activa = true

/** Se llama una vez al arrancar la app. Sin esto, la háptica va encendida. */
export async function cargarPreferenciaHaptica(): Promise<void> {
  try {
    const v = await AsyncStorage.getItem(CLAVE)
    if (v !== null) activa = v === '1'
  } catch { /* si no se puede leer, se queda encendida */ }
}

export function hapticaActiva(): boolean { return activa }

export async function cambiarHaptica(v: boolean): Promise<void> {
  activa = v
  try { await AsyncStorage.setItem(CLAVE, v ? '1' : '0') } catch { /* da igual */ }
  if (v) confirmar()   // que se note al encenderla
}

/**
 * Dos vibraciones seguidas se funden en una sola sensación desagradable.
 * Ocurre más de lo que parece: un botón que además cambia de pestaña, o una
 * lista donde el dedo roza dos elementos.
 */
let ultima = 0
const MINIMO_MS = 60

function puede(): boolean {
  if (!activa) return false
  const ahora = Date.now()
  if (ahora - ultima < MINIMO_MS) return false
  ultima = ahora
  return true
}

const impacto = (e: Haptics.ImpactFeedbackStyle) => { void Haptics.impactAsync(e).catch(() => {}) }
const aviso = (t: Haptics.NotificationFeedbackType) => { void Haptics.notificationAsync(t).catch(() => {}) }

// ── El vocabulario ───────────────────────────────────────────────────────────

/** Cambiar de opción: un día, una pestaña, una unidad. Lo más leve que hay. */
export function elegir() {
  if (!puede() || !FINO) return
  void Haptics.selectionAsync().catch(() => {})
}

/** Un botón cualquiera. Abrir algo, navegar. */
export function tocar() {
  if (!puede() || !FINO) return
  impacto(Haptics.ImpactFeedbackStyle.Light)
}

/** Algo que queda hecho: añadir un alimento, guardar unas metas, apuntar agua. */
export function confirmar() {
  if (!puede()) return
  impacto(Haptics.ImpactFeedbackStyle.Medium)
}

/** Algo que ya no se deshace: borrar una comida, terminar la sesión. */
export function soltar() {
  if (!puede()) return
  impacto(Haptics.ImpactFeedbackStyle.Heavy)
}

/**
 * Lo conseguiste: cerrar la meta del día, el octavo vaso, la última serie.
 *
 * Este es el que hace que la app se sienta viva, y por eso es el que más hay
 * que racionar: si se dispara por cualquier cosa deja de significar nada. Va
 * reservado a lo que uno contaría si le preguntan qué tal el día.
 */
export function logro() {
  if (!puede()) return
  aviso(Haptics.NotificationFeedbackType.Success)
}

/** Cuidado con esto: te pasaste del techo, la sesión lleva demasiado. */
export function ojo() {
  if (!puede()) return
  aviso(Haptics.NotificationFeedbackType.Warning)
}

/** No se pudo: falló el guardado, el código no existe, la contraseña no vale. */
export function fallo() {
  if (!puede()) return
  aviso(Haptics.NotificationFeedbackType.Error)
}
