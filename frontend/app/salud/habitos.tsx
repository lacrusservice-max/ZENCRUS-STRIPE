/**
 * SALUD · HÁBITOS
 * ═══════════════════════════════════════════════════════════════════════════
 * Marcar lo de hoy y ver la semana.
 *
 * ── La fila entera es el botón ─────────────────────────────────────────────
 * No una casilla de 20 px al borde. Un hábito se marca de pie, con una mano y
 * con prisa; el objetivo del día se toca sin apuntar. Los que llevan
 * cronómetro son la excepción: ahí el botón de arrancar va aparte, porque
 * tocar la fila para marcar y tocarla para cronometrar no pueden ser el mismo
 * gesto.
 *
 * ── El anillo dice la verdad, no un adorno ─────────────────────────────────
 * Cada día de la tira es un anillo cuyo arco es la fracción cumplida ese día
 * —`hechos / total`—, no un estado inventado. El hilo rojo solo une días
 * seguidos al 100 %: si un día quedó a medias, el hilo se corta ahí, que es
 * justo lo que hay que ver.
 *
 * ── La hora va fuera de la tarjeta ─────────────────────────────────────────
 * En una columna a la izquierda, no dentro. Así el día se lee en vertical como
 * un horario aunque las tarjetas cambien de alto, y a la tarjeta le queda todo
 * el ancho para lo que importa: el nombre.
 *
 * ── Evitar es el hábito al revés ───────────────────────────────────────────
 * «Sin pantallas» se cumple NO haciéndolo. Mecánicamente es el mismo booleano,
 * así que lo que cambia es el lenguaje: escudo en vez de palomita, y la
 * etiqueta EVITAR junto al nombre. Sin eso, una fila en rojo diría justo lo
 * contrario de lo que pasó.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, AppState,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle } from 'react-native-svg'
import {
  useHabitsStore, type DayLog, type Habit, type Momento, type TipoHabito,
} from '@/store/habitsStore'
import { hoyLocal, haceDias } from '@/utils/fechas'
import { elegir, confirmar } from '@/utils/haptica'
import { Spacing } from '@/constants/theme'

type IconName = React.ComponentProps<typeof Ionicons>['name']

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

const ROJO = '#FF1F3D'
const ROJO_HONDO = '#C4102A'

const ARO = 42
const ARO_HOY = 50

const MOMENTOS: { id: Momento; titulo: string; icono: IconName }[] = [
  { id: 'manana', titulo: 'MAÑANA', icono: 'sunny-outline' },
  { id: 'tarde',  titulo: 'TARDE',  icono: 'partly-sunny-outline' },
  { id: 'noche',  titulo: 'NOCHE',  icono: 'moon-outline' },
]

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

/**
 * Los días seguidos de un hábito, contando desde hoy hacia atrás.
 *
 * Se calcula con los `logs` suscritos en vez de llamar a `getStreakForHabit`,
 * que lee de `getState()` y por tanto no vuelve a ejecutarse al marcar: la
 * racha se quedaba con el número viejo hasta salir y entrar de la pantalla.
 */
function rachaDe(logs: Record<string, DayLog>, habitId: string): number {
  let dias = 0
  for (let i = 0; i < 120; i++) {
    if (logs[haceDias(i)]?.[habitId]) dias++
    else break
  }
  return dias
}

export default function Habitos() {
  const {
    load, habits, logs, segundos, toggleToday, addHabit, removeHabit, fijarSegundos,
  } = useHabitsStore()

  const [editando, setEditando] = useState(false)
  const [nuevo, setNuevo] = useState('')
  const [nMomento, setNMomento] = useState<Momento>('manana')
  const [nTipo, setNTipo] = useState<TipoHabito>('hacer')
  const [nHora, setNHora] = useState('')
  const [nMin, setNMin] = useState('')

  useEffect(() => { void load() }, [load])

  const hoy = hoyLocal()
  const deHoy = logs[hoy] ?? {}
  const secsHoy = segundos[hoy] ?? {}
  const hechos = habits.filter(h => deHoy[h.id]).length

  /* ── El cronómetro ────────────────────────────────────────────────────────
     Se guarda el instante de arranque, no un contador que se incrementa: si el
     sistema estrangula el temporizador —pantalla apagada, app de fondo— un
     contador se quedaría corto, mientras que restar dos relojes da el tiempo
     real que ha pasado. `tic` solo existe para forzar el repintado. */
  const [corriendo, setCorriendo] = useState<string | null>(null)
  const arranque = useRef<{ id: string; desde: number; base: number } | null>(null)
  const [, setTic] = useState(0)

  useEffect(() => {
    if (!corriendo) return
    const t = setInterval(() => setTic(n => n + 1), 500)
    return () => clearInterval(t)
  }, [corriendo])

  const transcurrido = useCallback((h: Habit) => {
    const guardado = secsHoy[h.id] ?? 0
    const a = arranque.current
    if (!a || a.id !== h.id) return guardado
    return a.base + Math.floor((Date.now() - a.desde) / 1000)
  }, [secsHoy])

  /** Apunta lo cronometrado y suelta el cronómetro. */
  const banquear = useCallback(() => {
    const a = arranque.current
    if (!a) return
    const total = a.base + Math.floor((Date.now() - a.desde) / 1000)
    arranque.current = null
    setCorriendo(null)
    void fijarSegundos(a.id, total)
  }, [fijarSegundos])

  // Salir de la pantalla o mandar la app al fondo no puede perder lo contado.
  useEffect(() => {
    const sub = AppState.addEventListener('change', e => { if (e !== 'active') banquear() })
    return () => { sub.remove(); banquear() }
  }, [banquear])

  // Al llegar a la meta se para y se marca solo: haber cronometrado los cinco
  // minutos ES haberlo cumplido, y pedir un toque más sería pedir lo mismo dos veces.
  useEffect(() => {
    if (!corriendo) return
    const h = habits.find(x => x.id === corriendo)
    if (h?.metaSegundos && transcurrido(h) >= h.metaSegundos) {
      confirmar()
      banquear()
    }
  })

  const alternarCrono = (h: Habit) => {
    if (corriendo === h.id) { elegir(); banquear(); return }
    if (corriendo) banquear()
    elegir()
    arranque.current = { id: h.id, desde: Date.now(), base: secsHoy[h.id] ?? 0 }
    setCorriendo(h.id)
  }

  /* ── La semana ──────────────────────────────────────────────────────────── */
  const semana = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const date = haceDias(6 - i)
      const log = logs[date] ?? {}
      const n = habits.filter(h => log[h.id]).length
      return {
        date, n,
        pct: habits.length ? n / habits.length : 0,
        lleno: habits.length > 0 && n === habits.length,
      }
    }),
    [logs, habits])

  const inicial = (fecha: string) => {
    const [a, m, d] = fecha.split('-').map(Number)
    return DIAS[(new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7]
  }
  const numero = (fecha: string) => Number(fecha.slice(8, 10))

  /* Cada sección con lo suyo, ordenado por hora: los que la tienen primero y en
     orden; los que no, detrás, que es donde caen cuando da igual cuándo. */
  const porMomento = useMemo(() => MOMENTOS.map(m => {
    const suyos = habits
      .filter(h => h.momento === m.id)
      .sort((a, b) => (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99'))
    return { ...m, habitos: suyos, hechos: suyos.filter(h => deHoy[h.id]).length }
  }), [habits, deHoy])

  const crear = () => {
    const t = nuevo.trim()
    if (!t) return
    const min = Number(nMin)
    confirmar()
    void addHabit(t, nTipo === 'evitar' ? 'ban' : 'ellipse', {
      momento: nMomento,
      tipo: nTipo,
      hora: /^([01]\d|2[0-3]):[0-5]\d$/.test(nHora.trim()) ? nHora.trim() : null,
      metaSegundos: Number.isFinite(min) && min > 0 ? Math.round(min * 60) : null,
    })
    setNuevo(''); setNHora(''); setNMin('')
  }

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* ── Cabecera ────────────────────────────────────────────────── */}
          <View style={s.head}>
            <View style={s.headFila}>
              <Pressable onPress={() => router.back()} hitSlop={12} style={s.volver}>
                <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.7)" />
              </Pressable>
              <View style={s.headBotones}>
                <Pressable
                  onPress={() => { elegir(); setEditando(v => !v) }}
                  style={({ pressed }) => [s.redondo, pressed && s.pulsado]}
                  accessibilityLabel={editando ? 'Terminar de editar' : 'Editar la lista'}
                >
                  <Ionicons
                    name={editando ? 'checkmark' : 'list'}
                    size={18}
                    color="rgba(255,255,255,0.65)"
                  />
                </Pressable>
                <Pressable
                  onPress={() => { elegir(); setEditando(true) }}
                  style={({ pressed }) => [s.redondo, s.redondoRojo, pressed && s.pulsado]}
                  accessibilityLabel="Añadir un hábito"
                >
                  <Ionicons name="add" size={22} color="#fff" />
                </Pressable>
              </View>
            </View>
            <Text style={s.eyebrow}>ZENCRUS · SALUD</Text>
            <Text style={s.titulo}>Hábitos</Text>
            <Text style={s.sub}>
              {habits.length
                ? `${hechos} de ${habits.length} hoy`
                : 'Todavía no has creado ninguno'}
            </Text>
          </View>

          {/* ── La semana ───────────────────────────────────────────────── */}
          {habits.length > 0 && (
            <View style={s.semana}>
              {semana.map((d, i) => {
                const esHoy = d.date === hoy
                const lado = esHoy ? ARO_HOY : ARO
                const r = lado / 2 - 2
                const vuelta = 2 * Math.PI * r
                const enlaza = d.lleno && semana[i + 1]?.lleno
                return (
                  <View key={d.date} style={s.dia}>
                    <Text style={[s.diaEt, esHoy && s.diaEtHoy]}>{inicial(d.date)}</Text>
                    <View style={[s.aro, { width: ARO_HOY, height: ARO_HOY }]}>
                      {enlaza && <View style={s.hilo} />}
                      <Svg width={lado} height={lado} style={s.svg}>
                        <Circle
                          cx={lado / 2} cy={lado / 2} r={r}
                          stroke="rgba(255,255,255,0.13)"
                          strokeWidth={esHoy ? 3 : 2.4}
                          fill="none"
                        />
                        {d.pct > 0 && (
                          <Circle
                            cx={lado / 2} cy={lado / 2} r={r}
                            stroke={ROJO}
                            strokeWidth={esHoy ? 3 : 2.4}
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={vuelta}
                            strokeDashoffset={vuelta * (1 - d.pct)}
                            transform={`rotate(-90 ${lado / 2} ${lado / 2})`}
                          />
                        )}
                      </Svg>
                      <Text style={s.diaNum}>{numero(d.date)}</Text>
                    </View>
                  </View>
                )
              })}
            </View>
          )}

          {/* ── Mañana · Tarde · Noche ──────────────────────────────────── */}
          {porMomento.map(sec => sec.habitos.length === 0 ? null : (
            <View key={sec.id}>
              <View style={s.seccion}>
                <Ionicons name={sec.icono} size={19} color="rgba(255,255,255,0.9)" />
                <Text style={s.seccionTxt}>{sec.titulo}</Text>
                <Text style={s.seccionCuenta}>{sec.hechos}/{sec.habitos.length}</Text>
              </View>

              {sec.habitos.map(h => {
                const puesto = !!deHoy[h.id]
                const dias = rachaDe(logs, h.id)
                const evitar = h.tipo === 'evitar'
                const meta = h.metaSegundos
                const va = meta ? transcurrido(h) : 0
                const activo = corriendo === h.id
                // Con cronómetro el relleno es el avance real; sin él, todo o nada.
                const pct = puesto ? 1 : meta ? Math.min(1, va / meta) : 0

                return (
                  <View key={h.id} style={s.linea}>
                    {/* La hora, fuera de la tarjeta */}
                    <View style={s.gutter}>
                      {h.hora
                        ? <Text style={[s.hora, puesto && s.horaOn]}>{h.hora}</Text>
                        : <View style={s.sinHora} />}
                    </View>

                    <Pressable
                      onPress={() => { puesto ? elegir() : confirmar(); void toggleToday(h.id) }}
                      style={({ pressed }) => [s.fila, puesto && s.filaOn, pressed && s.pulsado]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: puesto }}
                      accessibilityLabel={evitar ? `${h.label} (evitar)` : h.label}
                    >
                      {/* El degradado va dentro de una capa a sangre porque un
                          absoluto con `width: '100%'` mide contra la caja de
                          contenido, no la del borde: sin esto el relleno se
                          quedaba corto justo el `paddingHorizontal` de la fila. */}
                      {pct > 0 && (
                        <View style={StyleSheet.absoluteFill} pointerEvents="none">
                          <LinearGradient
                            colors={[ROJO_HONDO, ROJO]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[s.relleno, { width: `${pct * 100}%` }, !puesto && s.rellenoParcial]}
                          />
                        </View>
                      )}

                      <View style={[s.caja, puesto && s.cajaOn]}>
                        <Ionicons
                          name={h.icon as IconName}
                          size={20}
                          color={puesto ? '#fff' : 'rgba(255,255,255,0.62)'}
                        />
                      </View>

                      <View style={s.txt}>
                        <View style={s.nmFila}>
                          <Text style={[s.nm, puesto && s.nmOn]} numberOfLines={1}>{h.label}</Text>
                          {evitar && (
                            <View style={[s.pastilla, puesto && s.pastillaOn]}>
                              <Text style={[s.pastillaTxt, puesto && s.pastillaTxtOn]}>EVITAR</Text>
                            </View>
                          )}
                        </View>
                        {!!meta && (
                          <Text style={[s.crono, puesto && s.cronoOn]}>
                            {reloj(va)} de {reloj(meta)}
                          </Text>
                        )}
                      </View>

                      {editando ? (
                        <Pressable
                          onPress={() => { elegir(); void removeHabit(h.id) }}
                          hitSlop={12}
                          accessibilityLabel={`Quitar ${h.label}`}
                        >
                          <Ionicons name="close-circle" size={22} color="rgba(255,255,255,0.45)" />
                        </Pressable>
                      ) : (
                        <>
                          {/* Uno no es racha: por debajo de dos días no se enseña. */}
                          {dias >= 2 && (
                            <View style={s.racha}>
                              <Ionicons name="flame" size={14} color={puesto ? '#fff' : ROJO} />
                              <Text style={[s.rachaTxt, puesto && s.rachaTxtOn]}>{dias}</Text>
                            </View>
                          )}

                          {!!meta && !puesto && (
                            <Pressable
                              onPress={() => alternarCrono(h)}
                              hitSlop={10}
                              style={[s.play, activo && s.playOn]}
                              accessibilityLabel={activo ? `Pausar ${h.label}` : `Arrancar ${h.label}`}
                            >
                              <Ionicons
                                name={activo ? 'pause' : 'play'}
                                size={16}
                                color={activo ? '#fff' : ROJO}
                              />
                            </Pressable>
                          )}

                          <View style={[s.marca, puesto && s.marcaOn]}>
                            {puesto && (
                              <Ionicons
                                name={evitar ? 'shield-checkmark' : 'checkmark'}
                                size={evitar ? 16 : 18}
                                color="#fff"
                              />
                            )}
                          </View>
                        </>
                      )}
                    </Pressable>
                  </View>
                )
              })}
            </View>
          ))}

          {/* ── Añadir ──────────────────────────────────────────────────── */}
          {editando ? (
            <View style={s.form}>
              <TextInput
                value={nuevo}
                onChangeText={setNuevo}
                placeholder="Nuevo hábito"
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={s.input}
                returnKeyType="done"
                maxLength={60}
                onSubmitEditing={crear}
              />

              <View style={s.chips}>
                {MOMENTOS.map(m => (
                  <Pressable
                    key={m.id}
                    onPress={() => { elegir(); setNMomento(m.id) }}
                    style={[s.chip, nMomento === m.id && s.chipOn]}
                  >
                    <Text style={[s.chipTxt, nMomento === m.id && s.chipTxtOn]}>{m.titulo}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={s.chips}>
                {([['hacer', 'HACER'], ['evitar', 'EVITAR']] as const).map(([id, et]) => (
                  <Pressable
                    key={id}
                    onPress={() => { elegir(); setNTipo(id) }}
                    style={[s.chip, nTipo === id && s.chipOn]}
                  >
                    <Text style={[s.chipTxt, nTipo === id && s.chipTxtOn]}>{et}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={s.chips}>
                <TextInput
                  value={nHora}
                  onChangeText={setNHora}
                  placeholder="Hora  07:00"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={[s.mini, s.miniCaja]}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
                <TextInput
                  value={nMin}
                  onChangeText={setNMin}
                  placeholder="Cronómetro  min"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={[s.mini, s.miniCaja, { flex: 1.4 }]}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>

              <Pressable
                onPress={crear}
                style={({ pressed }) => [s.guardar, pressed && s.pulsado, !nuevo.trim() && s.guardarOff]}
              >
                <Text style={s.guardarTxt}>Añadir</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => { elegir(); setEditando(true) }}
              style={({ pressed }) => [s.anadir, pressed && s.pulsado]}
              accessibilityLabel="Añadir un hábito"
            >
              <Ionicons name="add" size={18} color="rgba(255,255,255,0.45)" />
              <Text style={s.anadirTxt}>Añadir aquí</Text>
            </Pressable>
          )}

        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const GUTTER = 46

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08080A' },
  safe: { flex: 1 },
  scroll: { paddingBottom: 130 },
  pulsado: { opacity: 0.75 },

  /* ── cabecera ── */
  head: { paddingHorizontal: Spacing[5], paddingTop: Spacing[2], paddingBottom: Spacing[4] },
  headFila: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: Spacing[2],
  },
  volver: { width: 34, height: 34, justifyContent: 'center', marginLeft: -6 },
  headBotones: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  redondo: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  redondoRojo: { backgroundColor: ROJO, borderColor: 'transparent' },
  eyebrow: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 11, color: ROJO,
    letterSpacing: 2.8, marginBottom: 6,
  },
  titulo: { fontFamily: 'Inter_600SemiBold', fontSize: 34, color: '#fff', letterSpacing: -1 },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 6 },

  /* ── la tira de la semana ── */
  semana: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: Spacing[5], paddingBottom: Spacing[2],
  },
  dia: { alignItems: 'center', flex: 1 },
  diaEt: {
    fontFamily: 'Inter_400Regular', fontSize: 12,
    color: 'rgba(255,255,255,0.38)', marginBottom: 7,
  },
  diaEtHoy: { color: ROJO, fontFamily: 'Inter_600SemiBold' },
  aro: { alignItems: 'center', justifyContent: 'center' },
  svg: { position: 'absolute' },
  // Nace del centro del anillo y llega al del siguiente, así que se alinea solo
  // aunque cambie el tamaño del aro.
  hilo: {
    position: 'absolute', left: '50%', width: '100%', height: 2.5,
    backgroundColor: ROJO, borderRadius: 2,
  },
  diaNum: {
    fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#fff',
    fontVariant: ['tabular-nums'],
  },

  /* ── rótulos de sección ── */
  seccion: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingLeft: Spacing[5] + GUTTER, paddingRight: Spacing[5],
    paddingTop: Spacing[5], paddingBottom: Spacing[3],
  },
  seccionTxt: {
    flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 15,
    color: '#fff', letterSpacing: 1.8,
  },
  seccionCuenta: {
    fontFamily: 'Inter_400Regular', fontSize: 14,
    color: 'rgba(255,255,255,0.55)', fontVariant: ['tabular-nums'],
  },

  /* ── la hora, fuera de la tarjeta ── */
  linea: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingLeft: Spacing[5] },
  gutter: { width: GUTTER, alignItems: 'center' },
  hora: {
    fontFamily: 'Inter_600SemiBold', fontSize: 12.5,
    color: 'rgba(255,255,255,0.5)', fontVariant: ['tabular-nums'],
  },
  horaOn: { color: ROJO },
  sinHora: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.14)' },

  /* ── filas ── */
  fila: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11,
    marginRight: Spacing[5], paddingHorizontal: 14, paddingVertical: 13,
    borderRadius: 20, overflow: 'hidden', minHeight: 74,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  filaOn: { borderColor: 'transparent' },
  // El relleno de un cronómetro a medias se apaga un poco: así «va por la
  // mitad» y «está hecho» no se confunden de un vistazo.
  relleno: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  rellenoParcial: { opacity: 0.55 },
  caja: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  cajaOn: { backgroundColor: 'rgba(0,0,0,0.22)', borderColor: 'rgba(255,255,255,0.16)' },
  txt: { flex: 1, minWidth: 0 },
  nmFila: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  nm: {
    flexShrink: 1, fontFamily: 'Inter_600SemiBold', fontSize: 15.5,
    color: 'rgba(255,255,255,0.92)',
  },
  nmOn: { color: '#fff' },
  pastilla: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    backgroundColor: 'rgba(255,31,61,0.16)',
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.4)',
  },
  pastillaOn: { backgroundColor: 'rgba(0,0,0,0.24)', borderColor: 'rgba(255,255,255,0.3)' },
  pastillaTxt: {
    fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 0.8, color: ROJO,
  },
  pastillaTxtOn: { color: '#fff' },
  crono: {
    fontFamily: 'Inter_400Regular', fontSize: 12,
    color: 'rgba(255,255,255,0.5)', marginTop: 3, fontVariant: ['tabular-nums'],
  },
  cronoOn: { color: 'rgba(255,255,255,0.85)' },

  racha: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rachaTxt: {
    fontFamily: 'Inter_600SemiBold', fontSize: 14,
    color: 'rgba(255,255,255,0.75)', fontVariant: ['tabular-nums'],
  },
  rachaTxtOn: { color: '#fff' },

  play: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,31,61,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.45)',
  },
  playOn: { backgroundColor: ROJO, borderColor: 'transparent' },

  marca: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.28)',
  },
  marcaOn: { backgroundColor: 'rgba(255,255,255,0.26)', borderColor: 'rgba(255,255,255,0.5)' },

  /* ── añadir ── */
  anadir: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    marginHorizontal: Spacing[5], marginTop: Spacing[4],
    height: 66, borderRadius: 20,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.16)',
    borderStyle: 'dashed',
  },
  anadirTxt: {
    fontFamily: 'Inter_600SemiBold', fontSize: 15, color: 'rgba(255,255,255,0.45)',
  },

  form: {
    marginHorizontal: Spacing[5], marginTop: Spacing[4], padding: 16, gap: 11,
    borderRadius: 20,
    borderWidth: 1.5, borderColor: 'rgba(255,31,61,0.45)', borderStyle: 'dashed',
  },
  input: {
    fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#fff', padding: 0, height: 26,
  },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  chipOn: { backgroundColor: ROJO, borderColor: 'transparent' },
  chipTxt: {
    fontFamily: 'Inter_600SemiBold', fontSize: 11,
    letterSpacing: 1, color: 'rgba(255,255,255,0.6)',
  },
  chipTxtOn: { color: '#fff' },
  mini: {
    flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#fff',
  },
  miniCaja: {
    height: 36, borderRadius: 12, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  guardar: {
    height: 44, borderRadius: 14, backgroundColor: ROJO,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  guardarOff: { opacity: 0.4 },
  guardarTxt: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#fff' },
})
