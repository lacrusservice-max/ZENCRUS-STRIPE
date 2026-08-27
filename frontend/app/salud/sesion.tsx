/**
 * SALUD · HÁBITOS · LA SESIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 * Un hábito con tiempo, a pantalla completa y sin nada más.
 *
 * ── Por qué no cabe en la tarjeta ──────────────────────────────────────────
 * El cronómetro vivía en un botón de 34 px dentro de la fila. Eso convierte
 * «meditar cinco minutos» en un trámite: le das a empezar y te quedas mirando
 * una lista con las otras siete cosas que no has hecho. La app te cuenta el
 * tiempo mientras te enseña tus deudas. Aquí la pantalla es una sola cosa: la
 * cifra. La barra de sección y el acceso al perfil se apagan a propósito
 * —`SIN_BARRA` y `RUTAS_SIN_BOTON`—, porque una salida a mano es una invitación
 * a irse a la mitad.
 *
 * ── El reloj de pared, no un contador ──────────────────────────────────────
 * Se guarda el INSTANTE de arranque y se resta contra `Date.now()`. Un
 * contador que suma uno por segundo se queda corto en cuanto el sistema
 * estrangula el temporizador —pantalla apagada, app de fondo—, y entonces
 * cinco minutos de respiración cuentan como tres. Restar dos relojes da el
 * tiempo que ha pasado de verdad, pase lo que pase con la app.
 *
 * ── Terminar es haber terminado ────────────────────────────────────────────
 * Al llegar a la meta se marca solo. Haber cronometrado los cinco minutos ES
 * haberlo cumplido; pedir un toque más sería pedir lo mismo dos veces.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Pressable, AppState } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useKeepAwake } from 'expo-keep-awake'
import { useHabitsStore } from '@/store/habitsStore'
import { hoyLocal } from '@/utils/fechas'
import { elegir, confirmar, logro } from '@/utils/haptica'

const ROJO = '#FF5C00'

const NOMBRE_MOMENTO = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' } as const

/** «5:00», «12:34», «1:02:03». Sin ceros a la izquierda en la unidad mayor. */
function reloj(seg: number): string {
  const s = Math.max(0, Math.floor(seg))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`
}

export default function Sesion() {
  const { id, meta: metaParam } = useLocalSearchParams<{ id: string; meta?: string }>()
  const { habits, segundos, fijarSegundos } = useHabitsStore()

  // Cinco minutos mirando una cifra sin tocar la pantalla la apagarían.
  useKeepAwake()

  const habito = habits.find(h => h.id === id)
  /* `meta` puede llegar por parámetro: es lo que hace el seguro, que hoy pide
     un cuarto de lo normal. Sin él, la meta del hábito. */
  const metaPedida = Number(metaParam)
  const meta = Number.isFinite(metaPedida) && metaPedida > 0
    ? metaPedida
    : (habito?.metaSegundos ?? 0)
  const reducida = meta > 0 && meta !== (habito?.metaSegundos ?? 0)
  const yaHabia = segundos[hoyLocal()]?.[id ?? ''] ?? 0

  const [corriendo, setCorriendo] = useState(true)
  const [hecho, setHecho] = useState(false)
  const arranque = useRef<number | null>(Date.now())
  const base = useRef(yaHabia)
  const [, setTic] = useState(0)

  const llevado = () => corriendo && arranque.current
    ? base.current + Math.floor((Date.now() - arranque.current) / 1000)
    : base.current

  /** Apunta lo llevado hasta ahora. Fija el total, así que repetirlo no infla. */
  const apuntar = useCallback((total: number) => {
    if (id) void fijarSegundos(id, total)
  }, [id, fijarSegundos])

  /* Medio segundo, no uno: con un tic de 1 s la cifra se salta números cuando
     el intervalo y el reloj se desfasan, y se ve dar un tirón.
     El fin de la cuenta se decide AQUÍ y no en un efecto de cada pintada:
     marcar y celebrar son efectos, y hacerlos en fase de render es pedir una
     cadena de actualizaciones. */
  useEffect(() => {
    if (!corriendo || hecho) return
    const t = setInterval(() => {
      const total = base.current + Math.floor((Date.now() - (arranque.current ?? Date.now())) / 1000)
      if (meta && total >= meta) {
        base.current = meta
        arranque.current = null
        setCorriendo(false)
        setHecho(true)
        logro()
        apuntar(meta)
      } else {
        setTic(n => n + 1)
      }
    }, 500)
    return () => clearInterval(t)
  }, [corriendo, hecho, meta, apuntar])

  const pausar = () => {
    const total = llevado()
    base.current = total
    arranque.current = null
    setCorriendo(false)
    elegir()
    apuntar(total)
  }

  const seguir = () => {
    arranque.current = Date.now()
    setCorriendo(true)
    elegir()
  }

  const salir = () => {
    if (!hecho) apuntar(llevado())
    router.back()
  }

  // Irse al fondo no puede perder lo contado: se apunta y el reloj de pared se
  // encarga de que al volver la cifra siga donde tocaba.
  useEffect(() => {
    const sub = AppState.addEventListener('change', e => {
      if (e === 'active' || hecho) return
      const total = arranque.current
        ? base.current + Math.floor((Date.now() - arranque.current) / 1000)
        : base.current
      apuntar(total)
    })
    return () => sub.remove()
  }, [hecho, apuntar])

  if (!habito) {
    return (
      <View style={s.root}>
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
          <View style={s.vacio}>
            <Text style={s.vacioTxt}>Ese hábito ya no está.</Text>
            <Pressable onPress={() => router.back()} style={s.btn}>
              <Text style={s.btnTxt}>VOLVER</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    )
  }

  const va = llevado()
  const quedan = Math.max(0, meta - va)
  const pct = meta ? Math.min(1, va / meta) : 0

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>

        <View style={s.top}>
          <Pressable onPress={salir} hitSlop={12} style={s.x} accessibilityLabel="Cerrar la sesión">
            <Ionicons name="close" size={19} color="rgba(255,255,255,0.55)" />
          </Pressable>
          <Text style={s.quien}>{hecho ? 'HECHO' : 'SESIÓN'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={s.nombre} numberOfLines={2}>{habito.label.toUpperCase()}</Text>
        <Text style={s.cuando}>
          {NOMBRE_MOMENTO[habito.momento]}{habito.hora ? ` · ${habito.hora}` : ''}
        </Text>

        <Text style={[s.cifra, hecho && s.cifraHecho]}>
          {hecho ? reloj(meta) : reloj(quedan)}
        </Text>
        <Text style={s.cifraEt}>{hecho ? 'CUMPLIDO' : 'TE QUEDAN'}</Text>
        {reducida && !hecho && (
          <Text style={s.rebaja}>Hoy con esto cuenta</Text>
        )}

        <View style={s.pista}>
          <View style={[s.pistaVa, { width: `${pct * 100}%` }]} />
        </View>
        <View style={s.pistaPie}>
          <Text style={s.pistaTxt}>{reloj(va)} hechos</Text>
          <Text style={s.pistaTxt}>meta {reloj(meta)}</Text>
        </View>

        <View style={s.hueco} />

        {hecho ? (
          <>
            <Pressable
              onPress={() => { confirmar(); router.back() }}
              style={({ pressed }) => [s.btn, pressed && s.pulsado]}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={s.btnTxt}>LISTO</Text>
            </Pressable>
            <Text style={s.pieHecho}>Marcado solo. No hace falta que lo toques otra vez.</Text>
          </>
        ) : (
          <>
            <Pressable
              onPress={corriendo ? pausar : seguir}
              style={({ pressed }) => [s.btn, pressed && s.pulsado]}
              accessibilityLabel={corriendo ? 'Pausar' : 'Seguir'}
            >
              <Ionicons name={corriendo ? 'pause' : 'play'} size={20} color="#fff" />
              <Text style={s.btnTxt}>{corriendo ? 'PAUSAR' : 'SEGUIR'}</Text>
            </Pressable>
            <Pressable onPress={salir} hitSlop={10}>
              <Text style={s.salir}>Terminar antes</Text>
            </Pressable>
          </>
        )}

      </SafeAreaView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050505' },
  safe: { flex: 1, paddingHorizontal: 26, paddingBottom: 26, alignItems: 'center' },
  pulsado: { opacity: 0.8 },

  top: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    alignSelf: 'stretch', paddingTop: 8,
  },
  x: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  quien: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 13,
    letterSpacing: 3, color: 'rgba(255,255,255,0.32)',
  },

  nombre: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 30, color: '#fff',
    letterSpacing: 4, textAlign: 'center', marginTop: 48,
  },
  cuando: { fontFamily: 'Inter_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.32)', marginTop: 6 },

  cifra: {
    fontFamily: 'Inter_800ExtraBold', fontSize: 116, color: '#fff',
    letterSpacing: -5, marginTop: 30, fontVariant: ['tabular-nums'],
  },
  cifraHecho: { color: ROJO },
  rebaja: {
    fontFamily: 'Inter_400Regular', fontSize: 13, color: ROJO, marginTop: 8,
  },
  cifraEt: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 13, letterSpacing: 4,
    color: 'rgba(255,255,255,0.32)', marginTop: 8,
  },

  // Barra plana, no un anillo: el anillo concéntrico se descartó en su día y
  // además obliga a leer un ángulo para saber cuánto falta.
  pista: {
    alignSelf: 'stretch', height: 6, borderRadius: 3, marginTop: 34,
    backgroundColor: 'rgba(255,255,255,0.09)', overflow: 'hidden',
  },
  pistaVa: { height: '100%', borderRadius: 3, backgroundColor: ROJO },
  pistaPie: {
    alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', marginTop: 10,
  },
  pistaTxt: {
    fontFamily: 'Inter_400Regular', fontSize: 12,
    color: 'rgba(255,255,255,0.32)', fontVariant: ['tabular-nums'],
  },

  hueco: { flex: 1 },

  btn: {
    alignSelf: 'stretch', height: 64, borderRadius: 20, backgroundColor: ROJO,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11,
    shadowColor: ROJO, shadowOpacity: 0.4, shadowRadius: 22, shadowOffset: { width: 0, height: 10 },
  },
  btnTxt: { fontFamily: 'Rajdhani_700Bold', fontSize: 18, letterSpacing: 3.5, color: '#fff' },
  salir: {
    fontFamily: 'Inter_400Regular', fontSize: 13.5,
    color: 'rgba(255,255,255,0.32)', marginTop: 18,
  },
  pieHecho: {
    fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center',
    color: 'rgba(255,255,255,0.32)', marginTop: 16, paddingHorizontal: 20,
  },

  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22, alignSelf: 'stretch' },
  vacioTxt: { fontFamily: 'Inter_400Regular', fontSize: 16, color: 'rgba(255,255,255,0.55)' },
})
