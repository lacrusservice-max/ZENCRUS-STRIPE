/**
 * SALUD · HÁBITOS
 * ═══════════════════════════════════════════════════════════════════════════
 * La portada: qué toca AHORA, y el día repartido en tres bloques.
 *
 * ── Por qué dejó de ser una lista ──────────────────────────────────────────
 * Era una lista de ocho filas, y una lista de ocho filas obliga a leerlas
 * todas para saber qué hacer. El lenguaje de la app —el bloque de Entrena— es
 * bloques grandes con UNA sola cosa que tocar. Aquí manda lo que toca ahora y
 * ocupa el sitio que merece; mañana, tarde y noche quedan plegados con su
 * cuenta, y la lista completa vive un toque más adentro, que es donde tiene
 * que estar.
 *
 * ── La fila entera sigue siendo el botón ───────────────────────────────────
 * Dentro de un bloque abierto, un hábito se marca tocando la fila entera, no
 * una casilla de 20 px al borde: se marca de pie, con una mano y con prisa.
 * Los que llevan cronómetro son la excepción, porque abren sesión y eso no
 * puede ser el mismo gesto que marcar.
 *
 * ── El anillo dice la verdad, no un adorno ─────────────────────────────────
 * Cada día de la tira es un anillo cuyo arco es la fracción cumplida ese día
 * —`hechos / total`—. El hilo rojo solo une días seguidos al 100 %: si un día
 * quedó a medias, la cadena se corta ahí, que es justo lo que hay que ver.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Pressable, LayoutAnimation,
  Platform, UIManager,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle } from 'react-native-svg'
import {
  useHabitsStore, type DayLog, type Habit, type Momento,
} from '@/store/habitsStore'
import { hoyLocal, haceDias } from '@/utils/fechas'
import { elegir, confirmar } from '@/utils/haptica'
import { Spacing } from '@/constants/theme'
import { BotonIA } from '@/constants/layout'
import { sincronizarRecordatorios } from '@/features/salud/recordatorios'
import { buscarSeguro, loQueBastaHoy } from '@/features/salud/seguro'

type IconName = React.ComponentProps<typeof Ionicons>['name']

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const
const ROJO = '#FF1F3D'
const ROJO_HONDO = '#C4102A'

const MOMENTOS: { id: Momento; titulo: string; icono: IconName }[] = [
  { id: 'manana', titulo: 'MAÑANA', icono: 'sunny-outline' },
  { id: 'tarde',  titulo: 'TARDE',  icono: 'partly-sunny-outline' },
  { id: 'noche',  titulo: 'NOCHE',  icono: 'moon-outline' },
]

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

function reloj(seg: number): string {
  const s = Math.max(0, Math.floor(seg))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

/** En qué parte del día estamos, para saber qué bloque abrir por defecto. */
function momentoAhora(): Momento {
  const h = new Date().getHours()
  return h < 12 ? 'manana' : h < 19 ? 'tarde' : 'noche'
}

/**
 * Los días seguidos de un hábito. Se calcula con los `logs` suscritos y no con
 * `getStreakForHabit`, que lee de `getState()` y no vuelve a ejecutarse al
 * marcar: la racha se quedaba con el número viejo hasta salir y volver.
 */
function rachaDe(logs: Record<string, DayLog>, habitId: string): number {
  let dias = 0
  for (let i = 0; i < 120; i++) {
    if (logs[haceDias(i)]?.[habitId]) dias++
    else break
  }
  return dias
}

/**
 * La racha del DÍA: jornadas seguidas con todo cumplido, y el récord.
 *
 * Hoy sin terminar no rompe nada —el día aún va—, así que si hoy está a
 * medias se cuenta desde ayer.
 *
 * Aviso honesto: los registros no guardan QUÉ hábitos existían cada día, así
 * que un día viejo se juzga con la lista de hoy. Añadir un hábito nuevo puede
 * bajar rachas pasadas. Arreglarlo pide guardar el censo del día, no un
 * cálculo más listo aquí.
 */
function rachaDelDia(logs: Record<string, DayLog>, habits: Habit[]) {
  if (habits.length === 0) return { actual: 0, record: 0 }
  const completo = (f: string) => {
    const l = logs[f]
    return !!l && habits.every(h => l[h.id])
  }

  let actual = 0
  for (let i = completo(haceDias(0)) ? 0 : 1; i < 120; i++) {
    if (completo(haceDias(i))) actual++
    else break
  }

  let record = 0, corrida = 0
  for (let i = 119; i >= 0; i--) {
    if (completo(haceDias(i))) { corrida++; record = Math.max(record, corrida) }
    else corrida = 0
  }
  return { actual, record: Math.max(record, actual) }
}

export default function Habitos() {
  const {
    load, habits, logs, segundos, toggleToday, removeHabit,
  } = useHabitsStore()

  const [abierto, setAbierto] = useState<Momento | null>(null)
  const yaAbrio = useRef(false)
  const [editando, setEditando] = useState(false)

  useEffect(() => { void load() }, [load])

  /* Los avisos siguen a los hábitos: si cambias una hora, borras uno o añades
     otro, aquí se queda cuadrado. Solo toca lo que de verdad cambió. */
  useEffect(() => { void sincronizarRecordatorios(habits) }, [habits])

  const hoy = hoyLocal()
  /* Memorizados: `logs[hoy] ?? {}` crea un objeto nuevo en cada pintada, y eso
     hacía recalcular todos los `useMemo` que dependen de él. */
  const deHoy = useMemo(() => logs[hoy] ?? {}, [logs, hoy])
  const secsHoy = useMemo(() => segundos[hoy] ?? {}, [segundos, hoy])
  const hechos = habits.filter(h => deHoy[h.id]).length

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

  const racha = useMemo(() => rachaDelDia(logs, habits), [logs, habits])
  /* El rescate del día, si lo hay. Uno solo: tres rescates a la vez son tres
     deudas, y el día que fallas tres cosas eso es lo último que ayuda. */
  const seguro = useMemo(() => buscarSeguro(habits, logs, hoy), [habits, logs, hoy])

  const porMomento = useMemo(() => MOMENTOS.map(m => {
    const suyos = habits
      .filter(h => h.momento === m.id)
      .sort((a, b) => (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99'))
    return { ...m, habitos: suyos, hechos: suyos.filter(h => deHoy[h.id]).length }
  }), [habits, deHoy])

  /**
   * Qué toca AHORA. Primero el que ya se pasó de hora —lo atrasado manda—;
   * si no hay, el siguiente por reloj; y si nadie tiene hora, el primero
   * pendiente del momento en que estamos.
   */
  const ahora = useMemo(() => {
    const pendientes = habits.filter(h => !deHoy[h.id])
    if (pendientes.length === 0) return null

    const d = new Date()
    const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    const conHora = pendientes.filter(h => h.hora).sort((a, b) => a.hora!.localeCompare(b.hora!))

    const pasados = conHora.filter(h => h.hora! <= hhmm)
    if (pasados.length) return pasados[pasados.length - 1]
    if (conHora.length) return conHora[0]

    const m = momentoAhora()
    return pendientes.find(h => h.momento === m) ?? pendientes[0]
  }, [habits, deHoy])

  /* Qué bloque nace abierto, UNA sola vez y cuando ya hay hábitos.
     No basta con el momento en que estamos: si a las dos de la tarde no hay
     nada en TARDE, abrir «tarde» deja la pantalla entera plegada y parece que
     el desplegable está roto. Se cae entonces al momento de lo que toca ahora,
     y en último caso al primero que tenga algo. */
  useEffect(() => {
    if (yaAbrio.current || habits.length === 0) return
    yaAbrio.current = true
    const tiene = (m: Momento) => habits.some(h => h.momento === m)
    const deAhora = momentoAhora()
    setAbierto(
      tiene(deAhora) ? deAhora
        : ahora && tiene(ahora.momento) ? ahora.momento
        : (MOMENTOS.map(m => m.id).find(tiene) ?? null),
    )
  }, [habits, ahora])

  const inicial = (fecha: string) => {
    const [a, m, d] = fecha.split('-').map(Number)
    return DIAS[(new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7]
  }
  const numero = (fecha: string) => Number(fecha.slice(8, 10))

  const abrir = (m: Momento) => {
    elegir()
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setAbierto(v => (v === m ? null : m))
  }

  const empezar = (h: Habit) => {
    elegir()
    router.push({ pathname: '/salud/sesion', params: { id: h.id } })
  }


  /* ── una fila dentro de un bloque abierto ───────────────────────────────── */
  const Fila = ({ h }: { h: Habit }) => {
    const puesto = !!deHoy[h.id]
    const dias = rachaDe(logs, h.id)
    const evitar = h.tipo === 'evitar'
    const meta = h.metaSegundos
    const va = meta ? (secsHoy[h.id] ?? 0) : 0
    const pct = puesto ? 1 : meta ? Math.min(1, va / meta) : 0

    return (
      <View style={s.linea}>
        <View style={s.gutter}>
          {h.hora
            ? <Text style={[s.hora, puesto && s.horaOn]}>{h.hora}</Text>
            : <View style={s.sinHora} />}
        </View>

        <Pressable
          onPress={() => {
            if (editando) { elegir(); router.push({ pathname: '/salud/habito', params: { id: h.id } }); return }
            puesto ? elegir() : confirmar()
            void toggleToday(h.id)
          }}
          onLongPress={() => { elegir(); router.push({ pathname: '/salud/habito', params: { id: h.id } }) }}
          delayLongPress={320}
          style={({ pressed }) => [s.fila, puesto && s.filaOn, pressed && s.pulsado]}
          accessibilityRole={editando ? 'button' : 'checkbox'}
          accessibilityState={editando ? undefined : { checked: puesto }}
          accessibilityLabel={editando ? `Editar ${h.label}` : (evitar ? `${h.label} (evitar)` : h.label)}
        >
          {/* La capa a sangre es necesaria: un absoluto con `width:'100%'` mide
              contra la caja de contenido, no la del borde, y el relleno se
              quedaba corto justo el padding de la fila. */}
          {pct > 0 && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <LinearGradient
                colors={[ROJO_HONDO, ROJO]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[s.relleno, { width: `${pct * 100}%` }, !puesto && s.rellenoParcial]}
              />
            </View>
          )}

          <View style={[s.caja, puesto && s.cajaOn]}>
            <Ionicons name={h.icon as IconName} size={19} color={puesto ? '#fff' : 'rgba(255,255,255,0.62)'} />
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
              <Text style={[s.crono, puesto && s.cronoOn]}>{reloj(va)} de {reloj(meta)}</Text>
            )}
          </View>

          {editando ? (
            /* En modo edición la fila entera lleva a editar y este botón borra:
               dos destinos distintos necesitan dos sitios distintos que tocar. */
            <Pressable onPress={() => { elegir(); void removeHabit(h.id) }} hitSlop={12}
                       accessibilityLabel={`Quitar ${h.label}`}>
              <Ionicons name="close-circle" size={22} color="rgba(255,255,255,0.45)" />
            </Pressable>
          ) : (
            <>
              {dias >= 2 && (
                <View style={s.racha}>
                  <Ionicons name="flame" size={13} color={puesto ? '#fff' : ROJO} />
                  <Text style={[s.rachaTxt, puesto && s.rachaTxtOn]}>{dias}</Text>
                </View>
              )}
              {!!meta && !puesto && (
                <Pressable onPress={() => empezar(h)} hitSlop={10} style={s.play}
                           accessibilityLabel={`Empezar ${h.label}`}>
                  <Ionicons name="play" size={15} color={ROJO} />
                </Pressable>
              )}
              <View style={[s.marca, puesto && s.marcaOn]}>
                {puesto && (
                  <Ionicons name={evitar ? 'shield-checkmark' : 'checkmark'}
                            size={evitar ? 15 : 17} color="#fff" />
                )}
              </View>
            </>
          )}
        </Pressable>
      </View>
    )
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
              {/* `BotonPerfil` flota en esa esquina sobre TODAS las pantallas:
                  sin reservarle su hueco se pone encima y se lleva el toque. */}
              <View style={s.headBotones}>
                <Pressable onPress={() => { elegir(); setEditando(v => !v) }}
                           style={({ pressed }) => [s.redondo, pressed && s.pulsado]}
                           accessibilityLabel={editando ? 'Terminar de editar' : 'Editar la lista'}>
                  <Ionicons name={editando ? 'checkmark' : 'list'} size={18} color="rgba(255,255,255,0.65)" />
                </Pressable>
                <Pressable onPress={() => { elegir(); router.push('/salud/habito') }}
                           style={({ pressed }) => [s.redondo, s.redondoRojo, pressed && s.pulsado]}
                           accessibilityLabel="Crear un hábito">
                  <Ionicons name="add" size={22} color="#fff" />
                </Pressable>
              </View>
            </View>
            <Text style={s.eyebrow}>ZENCRUS · SALUD</Text>
            <Text style={s.titulo}>Hábitos</Text>
            <Text style={s.sub}>
              {habits.length ? `${hechos} de ${habits.length} hoy` : 'Todavía no has creado ninguno'}
            </Text>
          </View>

          {/* ── La semana ───────────────────────────────────────────────── */}
          {habits.length > 0 && (
            <>
              <View style={s.semana}>
                {semana.map((d, i) => {
                  const esHoy = d.date === hoy
                  const r = esHoy ? 21 : 18
                  const vuelta = 2 * Math.PI * r
                  const enlaza = d.lleno && semana[i + 1]?.lleno
                  return (
                    <View key={d.date} style={s.dia}>
                      <Text style={[s.diaEt, esHoy && s.diaEtHoy]}>{inicial(d.date)}</Text>
                      <View style={s.aro}>
                        {enlaza && <View style={s.hilo} />}
                        <Svg width={50} height={50} style={s.svg}>
                          <Circle cx={25} cy={25} r={r} stroke="rgba(255,255,255,0.13)"
                                  strokeWidth={esHoy ? 3.2 : 2.6} fill="none" />
                          {d.pct > 0 && (
                            <Circle cx={25} cy={25} r={r} stroke={ROJO}
                                    strokeWidth={esHoy ? 3.2 : 2.6} fill="none" strokeLinecap="round"
                                    strokeDasharray={vuelta} strokeDashoffset={vuelta * (1 - d.pct)}
                                    transform="rotate(-90 25 25)" />
                          )}
                        </Svg>
                        <Text style={s.diaNum}>{numero(d.date)}</Text>
                      </View>
                    </View>
                  )
                })}
              </View>

              <View style={s.rachaLin}>
                <Ionicons name="flame" size={15} color={racha.actual ? ROJO : 'rgba(255,255,255,0.32)'} />
                <Text style={s.rachaLinTxt}>
                  {racha.actual
                    ? <>RACHA <Text style={s.rachaLinFuerte}>{racha.actual} DÍAS</Text></>
                    : <>SIN RACHA</>}
                  {racha.record > 0 && <> · RÉCORD <Text style={s.rachaLinFuerte}>{racha.record}</Text></>}
                </Text>
              </View>
            </>
          )}

          {/* ── El seguro: no fallar dos veces ──────────────────────────── */}
          {seguro && (
            <View style={s.seguro}>
              <View style={s.seguroCab}>
                <View style={s.seguroPunta}>
                  <Ionicons name="sparkles" size={16} color="#fff" />
                </View>
                <Text style={s.seguroZena}>ZENA</Text>
              </View>
              <Text style={s.seguroTxt}>
                Fallar un día no rompe nada. Lo que rompe un hábito es el segundo.{' '}
                <Text style={s.seguroFuerte}>Hoy con {loQueBastaHoy(seguro).toLowerCase()} cuenta.</Text>
              </Text>
              <Text style={s.seguroPie}>
                {seguro.habito.label} · llevabas {seguro.rachaPerdida}{' '}
                {seguro.rachaPerdida === 1 ? 'día' : 'días'}
              </Text>
              <Pressable
                onPress={() => {
                  confirmar()
                  if (seguro.metaReducida) {
                    router.push({
                      pathname: '/salud/sesion',
                      params: { id: seguro.habito.id, meta: String(seguro.metaReducida) },
                    })
                  } else {
                    void toggleToday(seguro.habito.id)
                  }
                }}
                style={({ pressed }) => [s.seguroBtn, pressed && s.pulsado]}
              >
                <Ionicons name={seguro.metaReducida ? 'play' : 'checkmark'} size={18} color={ROJO_HONDO} />
                <Text style={s.seguroBtnTxt}>
                  {seguro.metaReducida ? loQueBastaHoy(seguro).toUpperCase() : 'RECUPERARLO'}
                </Text>
              </Pressable>
            </View>
          )}

          {/* ── Lo que toca ahora ───────────────────────────────────────── */}
          {ahora ? (
            <View style={s.ahora}>
              <LinearGradient colors={[ROJO_HONDO, ROJO]}
                              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                              style={StyleSheet.absoluteFill} />
              <Text style={s.ahoraEt}>
                AHORA{ahora.hora ? ` · ${ahora.hora}` : ''}
              </Text>
              <View style={s.ahoraCuerpo}>
                <View style={s.ahoraTile}>
                  <Ionicons name={ahora.icon as IconName} size={29} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.ahoraNm} numberOfLines={2}>{ahora.label}</Text>
                  <Text style={s.ahoraMeta}>
                    {ahora.metaSegundos ? `${Math.round(ahora.metaSegundos / 60)} minutos` : 'Marcar cuando lo hagas'}
                    {rachaDe(logs, ahora.id) >= 2 ? ` · racha ${rachaDe(logs, ahora.id)}` : ''}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => {
                  if (ahora.metaSegundos) empezar(ahora)
                  else { confirmar(); void toggleToday(ahora.id) }
                }}
                style={({ pressed }) => [s.ahoraBtn, pressed && s.pulsado]}
              >
                <Ionicons name={ahora.metaSegundos ? 'play' : 'checkmark'} size={18} color={ROJO_HONDO} />
                <Text style={s.ahoraBtnTxt}>{ahora.metaSegundos ? 'EMPEZAR' : 'CUMPLIR'}</Text>
              </Pressable>
            </View>
          ) : habits.length > 0 && (
            <View style={s.todoHecho}>
              <Ionicons name="checkmark-done" size={26} color={ROJO} />
              <Text style={s.todoHechoTxt}>Todo hecho hoy</Text>
              <Text style={s.todoHechoSub}>Los {habits.length}. Vuelve mañana.</Text>
            </View>
          )}

          {/* ── Mañana · Tarde · Noche ──────────────────────────────────── */}
          <View style={s.bloques}>
            {porMomento.map(sec => sec.habitos.length === 0 ? null : (
              <View key={sec.id}>
                <Pressable onPress={() => abrir(sec.id)}
                           style={({ pressed }) => [s.bl, pressed && s.pulsado]}
                           accessibilityRole="button"
                           accessibilityLabel={`${sec.titulo}, ${sec.hechos} de ${sec.habitos.length}`}>
                  <View style={s.blTile}>
                    <Ionicons name={sec.icono} size={22} color="rgba(255,255,255,0.85)" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.blNm}>{sec.titulo}</Text>
                    <Text style={s.blQue} numberOfLines={1}>
                      {sec.habitos.map(h => h.label).join(' · ')}
                    </Text>
                  </View>
                  <Text style={s.blCuenta}>
                    <Text style={s.blCuentaFuerte}>{sec.hechos}</Text>/{sec.habitos.length}
                  </Text>
                  <Ionicons name={abierto === sec.id ? 'chevron-up' : 'chevron-down'}
                            size={16} color="rgba(255,255,255,0.32)" style={{ marginLeft: 8 }} />
                  <View style={[s.barra, { width: `${(sec.hechos / sec.habitos.length) * 100}%` }]} />
                </Pressable>

                {abierto === sec.id && (
                  <View style={s.abierto}>
                    {sec.habitos.map(h => <Fila key={h.id} h={h} />)}
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* ── Añadir ──────────────────────────────────────────────────── */}
          {/* Un bloque, no una caja de borde punteado: es lo mismo que se toca
              en el resto de la pantalla y lleva a su propia pantalla. */}
          <Pressable onPress={() => { elegir(); router.push('/salud/habito') }}
                     style={({ pressed }) => [s.anadir, pressed && s.pulsado]}
                     accessibilityLabel="Crear un hábito">
            <View style={s.anadirMas}>
              <Ionicons name="add" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.anadirNm}>AÑADIR HÁBITO</Text>
              <Text style={s.anadirPie}>Con su hora y su cronómetro</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
          </Pressable>

        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const GUTTER = 46

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08080A' },
  safe: { flex: 1 },
  scroll: { paddingBottom: 140 },
  pulsado: { opacity: 0.78 },

  /* cabecera */
  head: { paddingHorizontal: Spacing[5], paddingTop: Spacing[2], paddingBottom: Spacing[4] },
  headFila: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: Spacing[2],
  },
  volver: { width: 34, height: 34, justifyContent: 'center', marginLeft: -6 },
  headBotones: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginRight: BotonIA.reserva,
  },
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

  /* la semana */
  semana: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: Spacing[5],
  },
  dia: { alignItems: 'center', flex: 1 },
  diaEt: { fontFamily: 'Inter_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.38)', marginBottom: 7 },
  diaEtHoy: { color: ROJO, fontFamily: 'Inter_600SemiBold' },
  aro: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  svg: { position: 'absolute' },
  // Nace del centro del anillo y llega al del siguiente: se alinea solo aunque
  // cambie el tamaño del aro.
  hilo: {
    position: 'absolute', left: '50%', width: '104%', height: 2.5,
    backgroundColor: ROJO, borderRadius: 2,
  },
  diaNum: {
    fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  rachaLin: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: Spacing[5], paddingTop: Spacing[4],
  },
  rachaLinTxt: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 13, letterSpacing: 2,
    color: 'rgba(255,255,255,0.55)',
  },
  rachaLinFuerte: { color: '#fff' },

  /* el seguro */
  seguro: {
    marginHorizontal: Spacing[5], marginTop: Spacing[5],
    borderRadius: 24, padding: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.35)',
  },
  seguroCab: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  seguroPunta: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: ROJO,
    alignItems: 'center', justifyContent: 'center',
  },
  seguroZena: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 14, letterSpacing: 3, color: ROJO,
  },
  seguroTxt: {
    fontFamily: 'Inter_400Regular', fontSize: 15.5, lineHeight: 22,
    color: 'rgba(255,255,255,0.9)',
  },
  seguroFuerte: { fontFamily: 'Inter_600SemiBold', color: ROJO },
  seguroPie: {
    fontFamily: 'Inter_400Regular', fontSize: 12.5,
    color: 'rgba(255,255,255,0.35)', marginTop: 8,
  },
  seguroBtn: {
    height: 52, borderRadius: 16, backgroundColor: '#fff', marginTop: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
  },
  seguroBtnTxt: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 16, letterSpacing: 2.4, color: ROJO_HONDO,
  },

  /* lo que toca ahora */
  ahora: {
    marginHorizontal: Spacing[5], marginTop: Spacing[5],
    borderRadius: 26, overflow: 'hidden', padding: 20,
  },
  ahoraEt: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 12, letterSpacing: 3,
    color: 'rgba(255,255,255,0.78)',
  },
  ahoraCuerpo: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 14, marginBottom: 18 },
  ahoraTile: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.24)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  ahoraNm: { fontFamily: 'Inter_800ExtraBold', fontSize: 26, color: '#fff', letterSpacing: -0.4 },
  ahoraMeta: { fontFamily: 'Inter_400Regular', fontSize: 13.5, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  ahoraBtn: {
    height: 56, borderRadius: 18, backgroundColor: '#fff',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  ahoraBtnTxt: { fontFamily: 'Rajdhani_700Bold', fontSize: 17, letterSpacing: 3, color: ROJO_HONDO },

  todoHecho: {
    marginHorizontal: Spacing[5], marginTop: Spacing[5], borderRadius: 26, padding: 26,
    alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,31,61,0.3)',
  },
  todoHechoTxt: { fontFamily: 'Inter_800ExtraBold', fontSize: 20, color: '#fff' },
  todoHechoSub: { fontFamily: 'Inter_400Regular', fontSize: 13.5, color: 'rgba(255,255,255,0.55)' },

  /* bloques de momento */
  bloques: { paddingHorizontal: Spacing[5], paddingTop: Spacing[4], gap: 11 },
  bl: {
    position: 'relative', borderRadius: 22, padding: 16, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  blTile: {
    width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  blNm: { fontFamily: 'Rajdhani_700Bold', fontSize: 21, color: '#fff', letterSpacing: 2.6 },
  blQue: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: 'rgba(255,255,255,0.32)', marginTop: 2 },
  blCuenta: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 20, color: 'rgba(255,255,255,0.55)',
    fontVariant: ['tabular-nums'],
  },
  blCuentaFuerte: { color: '#fff' },
  barra: { position: 'absolute', left: 0, bottom: 0, height: 3, backgroundColor: ROJO },
  abierto: { marginTop: 11, gap: 10 },

  /* filas */
  linea: { flexDirection: 'row', alignItems: 'center' },
  gutter: { width: GUTTER, alignItems: 'center' },
  hora: {
    fontFamily: 'Inter_600SemiBold', fontSize: 12.5,
    color: 'rgba(255,255,255,0.5)', fontVariant: ['tabular-nums'],
  },
  horaOn: { color: ROJO },
  sinHora: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.14)' },
  fila: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingHorizontal: 13, paddingVertical: 12, borderRadius: 18,
    overflow: 'hidden', minHeight: 68,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  filaOn: { borderColor: 'transparent' },
  relleno: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  rellenoParcial: { opacity: 0.55 },
  caja: {
    width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  cajaOn: { backgroundColor: 'rgba(0,0,0,0.22)', borderColor: 'rgba(255,255,255,0.16)' },
  txt: { flex: 1, minWidth: 0 },
  nmFila: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  nm: { flexShrink: 1, fontFamily: 'Inter_600SemiBold', fontSize: 15, color: 'rgba(255,255,255,0.92)' },
  nmOn: { color: '#fff' },
  pastilla: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    backgroundColor: 'rgba(255,31,61,0.16)', borderWidth: 1, borderColor: 'rgba(255,31,61,0.4)',
  },
  pastillaOn: { backgroundColor: 'rgba(0,0,0,0.24)', borderColor: 'rgba(255,255,255,0.3)' },
  pastillaTxt: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 0.8, color: ROJO },
  pastillaTxtOn: { color: '#fff' },
  crono: {
    fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 3,
    color: 'rgba(255,255,255,0.5)', fontVariant: ['tabular-nums'],
  },
  cronoOn: { color: 'rgba(255,255,255,0.85)' },
  racha: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rachaTxt: {
    fontFamily: 'Inter_600SemiBold', fontSize: 13.5,
    color: 'rgba(255,255,255,0.75)', fontVariant: ['tabular-nums'],
  },
  rachaTxtOn: { color: '#fff' },
  play: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,31,61,0.14)', borderWidth: 1, borderColor: 'rgba(255,31,61,0.45)',
  },
  marca: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.28)',
  },
  marcaOn: { backgroundColor: 'rgba(255,255,255,0.26)', borderColor: 'rgba(255,255,255,0.5)' },

  /* añadir */
  anadir: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: Spacing[5], marginTop: Spacing[4],
    borderRadius: 22, padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  anadirMas: {
    width: 50, height: 50, borderRadius: 16, backgroundColor: ROJO,
    alignItems: 'center', justifyContent: 'center',
  },
  anadirNm: { fontFamily: 'Rajdhani_700Bold', fontSize: 19, letterSpacing: 2.2, color: '#fff' },
  anadirPie: {
    fontFamily: 'Inter_400Regular', fontSize: 12.5,
    color: 'rgba(255,255,255,0.32)', marginTop: 2,
  },
  guardarOff: { opacity: 0.4 },
  guardarTxt: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#fff' },
})
