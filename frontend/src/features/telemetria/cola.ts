/**
 * TELEMETRÍA · LA COLA
 * ═══════════════════════════════════════════════════════════════════════════
 * Recoge eventos, los guarda en disco y los envía cuando puede.
 *
 * ── Tres reglas, y las tres nacen del mismo miedo ──────────────────────────
 * La telemetría es lo último que puede permitirse romper algo. Nadie abre la
 * app para generar eventos, así que cualquier fallo aquí es un fallo gratis.
 *
 *   1. NADA de aquí sale hacia arriba. `registrar()` no devuelve promesa, no
 *      lanza, y su cuerpo entero está en un try. Si la telemetría revienta,
 *      revienta sola y en silencio.
 *   2. Se guarda en disco ANTES de intentar enviar. Lo que se pierde al
 *      cerrar la app es justo lo de la sesión más interesante: la que se
 *      cerró de golpe.
 *   3. La cola tiene tope y descarta lo VIEJO. Un teléfono tres semanas sin
 *      red no puede acabar con veinte mil eventos ocupando su disco, y si hay
 *      que tirar algo, lo reciente cuenta más.
 *
 * ── Por qué se envía por lotes y con reloj, no evento a evento ─────────────
 * Una petición por toque sería una batería fundida y un servidor con diez
 * veces más tráfico del que necesita. Se manda cada `INTERVALO_MS`, o antes si
 * se llena el lote, o al irse la app a segundo plano —que es cuando de verdad
 * hay riesgo de perderlo todo.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState, Platform } from 'react-native'
import Constants from 'expo-constants'
import { apiPost } from '@/services/api'
import { sanear } from '@/nucleo/telemetria/eventos'
import type { Evento, Seccion, ValorProp } from '@/nucleo/telemetria/eventos'

const CLAVE = 'telemetria_cola'
const MAX_COLA = 500
const LOTE = 40
const INTERVALO_MS = 30_000
/** Tras esto se tira el lote: algo tiene que estar mal en él, no en la red. */
const MAX_INTENTOS = 5

interface Encolado extends Evento { intento: number }

let cola: Encolado[] = []
let sesionId = ''
let temporizador: ReturnType<typeof setInterval> | null = null
let enviando = false
let arrancada = false

/** Un identificador de sesión que no identifica a nadie: vive y muere aquí. */
function nuevaSesion(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

async function guardar(): Promise<void> {
  try { await AsyncStorage.setItem(CLAVE, JSON.stringify(cola)) } catch { /* da igual */ }
}

/**
 * Apunta un evento.
 *
 * Nunca lanza y nunca hay que esperarla. Quien la llama está en mitad de otra
 * cosa —pintar una pantalla, responder a un toque— y no puede quedarse
 * esperando a que se escriba un disco.
 */
export function registrar(
  nombre: string,
  seccion: Seccion,
  extra: { pantalla?: string; control?: string; props?: Record<string, ValorProp> } = {},
): void {
  try {
    if (!sesionId) sesionId = nuevaSesion()

    const evento = sanear({
      nombre,
      seccion,
      pantalla: extra.pantalla,
      control: extra.control,
      props: extra.props ?? {},
      ocurrioEn: new Date().toISOString(),
      sesionId,
    })

    cola.push({ ...evento, intento: 0 })

    /* Se tira lo viejo, no lo nuevo: si un teléfono lleva semanas sin red, lo
       que pasó ayer explica mejor la app de hoy que lo del mes pasado. */
    if (cola.length > MAX_COLA) cola = cola.slice(cola.length - MAX_COLA)

    void guardar()
    if (cola.length >= LOTE) void vaciar()
  } catch { /* la telemetría jamás tumba una pantalla */ }
}

/** Manda lo que haya. Segura de llamar en cualquier momento. */
export async function vaciar(): Promise<void> {
  if (enviando || !cola.length) return
  enviando = true

  try {
    const lote = cola.slice(0, LOTE)
    await apiPost('/events/batch', {
      eventos: lote.map(({ intento: _i, ...e }) => e),
      plataforma: Platform.OS,
      versionApp: Constants.expoConfig?.version ?? undefined,
    })

    cola = cola.slice(lote.length)
    await guardar()
  } catch {
    /* Se cuenta el intento sobre los que iban en el lote. A los cinco se
       tiran: si un lote no entra cinco veces seguidas, el problema no es la
       red, y reintentarlo para siempre es un bucle que nadie va a mirar. */
    let tirados = 0
    cola = cola
      .map((e, i) => (i < LOTE ? { ...e, intento: e.intento + 1 } : e))
      .filter(e => {
        if (e.intento < MAX_INTENTOS) return true
        tirados++
        return false
      })
    if (tirados) await guardar()
  } finally {
    enviando = false
  }
}

/**
 * Arranca la cola: recupera lo guardado y programa los envíos.
 *
 * Idempotente a propósito: se llama desde el layout raíz, que en desarrollo se
 * vuelve a montar cada vez que Fast Refresh toca algo, y dos temporizadores
 * vivos duplicarían cada envío.
 */
export function arrancar(): () => void {
  if (arrancada) return () => { /* ya estaba */ }
  arrancada = true
  sesionId = nuevaSesion()

  void (async () => {
    try {
      const guardado = await AsyncStorage.getItem(CLAVE)
      if (guardado) cola = [...(JSON.parse(guardado) as Encolado[]), ...cola].slice(-MAX_COLA)
    } catch { /* si no se puede leer, se empieza vacía */ }
    void vaciar()
  })()

  temporizador = setInterval(() => { void vaciar() }, INTERVALO_MS)

  /* Irse a segundo plano es el momento de más riesgo de perderlo todo, y
     además es cuando la app no tiene nada mejor que hacer con la red. */
  const sub = AppState.addEventListener('change', estado => {
    if (estado !== 'active') void vaciar()
  })

  return () => {
    if (temporizador) clearInterval(temporizador)
    temporizador = null
    sub.remove()
    arrancada = false
  }
}

/** Solo para las pruebas. */
export function _estado() {
  return { pendientes: cola.length, sesionId }
}
