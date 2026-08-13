/**
 * TU SEMANA
 * ─────────
 * Cuántos días entrenas, qué días, y qué toca cada uno. Tres preguntas.
 *
 * ── Por qué la semana y no «día 1, día 2» ───────────────────────────────────
 * Esto era antes un constructor de programas: días numerados que avanzaban al
 * entrenar. Tenía una virtud real —saltarte el martes no marcaba nada como
 * fallado— y un defecto que pesa más: NADIE organiza su vida en «día 2». La
 * gente piensa «los martes entreno pierna». Una app que no habla ese idioma
 * obliga a abrirla para saber qué toca, que es justo lo contrario de planificar.
 *
 * La virtud no se pierde: un día que se queda atrás sigue PENDIENTE y se puede
 * hacer otro día contando como él. Eso lo resuelve el servidor.
 *
 * ── Se pregunta lo que el usuario sabe ──────────────────────────────────────
 * Sabe cuántos días puede ir y qué quiere entrenar. NO sabe —ni tiene por qué—
 * cuántas series lleva un press de banca ni cuánto descansar entre ellas. Así
 * que se le preguntan las dos primeras y ZENCRUS pone el resto, y todo lo que
 * pone se puede cambiar. Es la regla de siempre: proponer sin bloquear.
 *
 * ── Una sola pantalla que se va abriendo ────────────────────────────────────
 * Y no un asistente de cuatro pasos con botones de «siguiente». Un asistente
 * esconde lo que ya decidiste y obliga a ir y volver para cambiar una cosa;
 * aquí las tres preguntas están a la vista y cada una aparece cuando la
 * anterior tiene respuesta.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, Platform,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, {
  FadeInDown, FadeIn, FadeOut, LinearTransition,
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { CabeceraSeccion } from '@/components/workout/MenuSeccion'
import { Miniatura } from '@/components/workout/Miniatura'
import {
  guardarPlan, inscribirse, getPrograma, getMusculos, proponerEjercicios,
  EjercicioPlan, PlanPropio, Musculo, DIAS_SEMANA, DIAS_CORTOS, prescripcion,
} from '@/services/programService'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

const T = Typography
const C = Colors

/** Cuántas semanas dura antes de replantearlo. La semana manda; esto es el mes. */
const SEMANAS = [4, 8, 12]

const SITIOS = [
  { id: 'gym' as const, label: 'Gimnasio', icono: 'barbell-outline' as const },
  { id: 'home' as const, label: 'En casa', icono: 'home-outline' as const },
]

/** Un día de la semana con entrenamiento, tal y como se está montando. */
interface DiaEnMontaje {
  diaSemana: number
  musculos: string[]
  nombre: string
  ejercicios: (EjercicioPlan & { musculo?: string })[]
  posters: Record<string, string>
}

// ─────────────────────────────────────────────────────────────────────────────

export default function TuSemana() {
  const { id } = useLocalSearchParams<{ id?: string }>()

  const [cuantos, setCuantos] = useState<number | null>(null)
  const [elegidos, setElegidos] = useState<number[]>([])
  const [dias, setDias] = useState<Record<number, DiaEnMontaje>>({})
  const [sitio, setSitio] = useState<'gym' | 'home'>('gym')
  const [semanas, setSemanas] = useState(8)
  const [nombre, setNombre] = useState('')

  const [musculos, setMusculos] = useState<Musculo[]>([])
  const [sugeridos, setSugeridos] = useState<Record<number, number[]>>({})
  const [editando, setEditando] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(true)

  // ── Arranque ──────────────────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const m = await getMusculos()
        setMusculos(m.musculos)
        setSugeridos(Object.fromEntries(m.diasSugeridos.map(d => [d.n, d.dias])))

        if (id) {
          const p = await getPrograma(id)
          setNombre(p.name)
          setSemanas(p.weeks)
          setSitio(p.mode === 'home' ? 'home' : 'gym')
          const cargados: Record<number, DiaEnMontaje> = {}
          for (const d of p.plan.dias) {
            const ds = d.diaSemana ?? 0
            cargados[ds] = {
              diaSemana: ds,
              musculos: d.musculos ?? [],
              nombre: d.nombre,
              ejercicios: d.ejercicios,
              posters: {},
            }
          }
          setDias(cargados)
          setElegidos(Object.keys(cargados).map(Number).sort((a, b) => a - b))
          setCuantos(Object.keys(cargados).length)
        }
      } catch {
        Alert.alert('No se pudo cargar', 'Revisa la conexión y vuelve a intentarlo.')
      } finally {
        setCargando(false)
      }
    })()
  }, [id])

  /**
   * Elegir cuántos días RESPETA lo que ya habías tocado.
   *
   * Si ya habías puesto lunes y jueves y subes a tres, se queda lunes y jueves
   * y se añade uno; no se borra tu elección para poner la sugerencia entera.
   * Al bajar se quitan los últimos. Sobrescribir lo que alguien acaba de elegir
   * es la clase de detalle que hace que una pantalla se sienta hostil.
   */
  const elegirCuantos = useCallback((n: number) => {
    void Haptics.selectionAsync()
    setCuantos(n)
    setElegidos(prev => {
      if (prev.length === 0) return [...(sugeridos[n] ?? [0, 2, 4])].slice(0, n).sort((a, b) => a - b)
      if (prev.length === n) return prev
      if (prev.length > n) return prev.slice(0, n)
      const faltan = n - prev.length
      const candidatos = (sugeridos[n] ?? [0, 1, 2, 3, 4, 5, 6]).filter(d => !prev.includes(d))
      const resto = [0, 1, 2, 3, 4, 5, 6].filter(d => !prev.includes(d) && !candidatos.includes(d))
      return [...prev, ...[...candidatos, ...resto].slice(0, faltan)].sort((a, b) => a - b)
    })
  }, [sugeridos])

  const alternarDia = useCallback((d: number) => {
    void Haptics.selectionAsync()
    setElegidos(prev => {
      const dentro = prev.includes(d)
      if (dentro) {
        setDias(({ [d]: _fuera, ...resto }) => resto)
        return prev.filter(x => x !== d)
      }
      return [...prev, d].sort((a, b) => a - b)
    })
    setCuantos(prev => {
      const dentro = elegidos.includes(d)
      return Math.max(1, (prev ?? elegidos.length) + (dentro ? -1 : 1))
    })
  }, [elegidos])

  /** Elegir músculos para un día y que ZENCRUS lo rellene. */
  const ponerMusculos = useCallback(async (diaSemana: number, ms: string[]) => {
    if (ms.length === 0) {
      setDias(prev => ({ ...prev, [diaSemana]: { diaSemana, musculos: [], nombre: '', ejercicios: [], posters: {} } }))
      return
    }
    try {
      const p = await proponerEjercicios(ms, sitio)
      setDias(prev => ({
        ...prev,
        [diaSemana]: {
          diaSemana, musculos: ms, nombre: p.nombre,
          ejercicios: p.ejercicios, posters: p.posters ?? {},
        },
      }))
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      Alert.alert('No se pudo proponer', 'Revisa la conexión. Puedes elegir los músculos otra vez.')
    }
  }, [sitio])

  /**
   * Al cambiar de sitio se rehacen los días que ya estaban.
   *
   * En casa no hay prensa. Si no se rehicieran, alguien que monta su semana en
   * el gimnasio y luego cambia a «en casa» se quedaría con un plan que no puede
   * hacer, y sin ninguna pista de por qué.
   */
  const cambiarSitio = useCallback(async (s: 'gym' | 'home') => {
    void Haptics.selectionAsync()
    setSitio(s)
    const conMusculos = Object.values(dias).filter(d => d.musculos.length > 0)
    for (const d of conMusculos) {
      try {
        const p = await proponerEjercicios(d.musculos, s)
        setDias(prev => ({
          ...prev,
          [d.diaSemana]: { ...prev[d.diaSemana], ejercicios: p.ejercicios, posters: p.posters ?? {} },
        }))
      } catch { /* se queda el que había: mejor eso que vaciarle el día */ }
    }
  }, [dias])

  const quitarEjercicio = useCallback((ds: number, i: number) => {
    void Haptics.selectionAsync()
    setDias(prev => ({
      ...prev,
      [ds]: { ...prev[ds], ejercicios: prev[ds].ejercicios.filter((_, j) => j !== i) },
    }))
  }, [])

  const moverEjercicio = useCallback((ds: number, i: number, hacia: -1 | 1) => {
    setDias(prev => {
      const l = [...prev[ds].ejercicios]
      const j = i + hacia
      if (j < 0 || j >= l.length) return prev
      ;[l[i], l[j]] = [l[j], l[i]]
      void Haptics.selectionAsync()
      return { ...prev, [ds]: { ...prev[ds], ejercicios: l } }
    })
  }, [])

  // ── Guardar ───────────────────────────────────────────────────────────────
  const listos = elegidos.filter(d => (dias[d]?.ejercicios.length ?? 0) > 0)
  const puedeGuardar = listos.length > 0 && listos.length === elegidos.length

  const guardar = async () => {
    if (!puedeGuardar || guardando) return
    setGuardando(true)
    try {
      const plan: PlanPropio = {
        name: nombre.trim() || 'Mi semana',
        weeks: semanas,
        goal: 'hypertrophy',
        level: 'intermediate',
        mode: sitio,
        deloadEvery: 4,
        dias: elegidos.map((ds, i) => ({
          dia: i + 1,
          diaSemana: ds,
          musculos: dias[ds].musculos,
          nombre: dias[ds].nombre,
          foco: dias[ds].musculos[0],
          ejercicios: dias[ds].ejercicios.map(({ musculo: _m, ...e }) => e),
        })),
      }
      const guardado = await guardarPlan(plan, id)
      // Y se sigue solo: montar una semana y que no pase nada sería la mitad
      // del trabajo. Si ya estaba inscrito, el servidor lo resuelve.
      if (!id) await inscribirse(guardado.id).catch(() => {})
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.replace('/(tabs)/workout')
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      Alert.alert('No se pudo guardar', msg ?? 'Revisa la conexión y vuelve a intentarlo.')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return (
      <Screen>
        <CabeceraSeccion titulo="Tu semana" />
        <View style={s.centro}><ActivityIndicator color={C.neon.red} /></View>
      </Screen>
    )
  }

  return (
    <Screen>
      <CabeceraSeccion
        titulo={id ? 'Editar tu semana' : 'Tu semana'}
        subtitulo={cuantos ? `${elegidos.length} ${elegidos.length === 1 ? 'día' : 'días'} · ${listos.length} ${listos.length === 1 ? 'listo' : 'listos'}` : undefined}
      />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── 1 · CUÁNTOS DÍAS ─────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(340)} style={s.bloque}>
          <Pregunta n={1} texto="¿Cuántos días quieres entrenar?" />
          <View style={s.numeros}>
            {[1, 2, 3, 4, 5, 6, 7].map(n => (
              <Numero key={n} n={n} activo={cuantos === n} onPress={() => elegirCuantos(n)} />
            ))}
          </View>
        </Animated.View>

        {/* ── 2 · QUÉ DÍAS ─────────────────────────────────────────────── */}
        {cuantos !== null && (
          <Animated.View entering={FadeInDown.duration(340)} style={s.bloque}>
            <Pregunta n={2} texto="¿Qué días?" />
            <Text style={s.pista}>
              Te proponemos días repartidos. El músculo se recupera en 48 horas y
              luego empieza a perder, así que tres seguidos rinden menos que tres
              alternos. Cámbialos si tu semana es otra.
            </Text>
            <View style={s.semana}>
              {DIAS_CORTOS.map((letra, d) => (
                <Dia key={d} letra={letra} activo={elegidos.includes(d)} onPress={() => alternarDia(d)} />
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── 3 · QUÉ TOCA CADA DÍA ────────────────────────────────────── */}
        {elegidos.length > 0 && (
          <Animated.View entering={FadeInDown.duration(340)} style={s.bloque}>
            <Pregunta n={3} texto="¿Qué entrenas cada día?" />

            <View style={s.sitios}>
              {SITIOS.map(x => (
                <TouchableOpacity
                  key={x.id}
                  style={[s.sitio, sitio === x.id && s.sitioOn]}
                  onPress={() => void cambiarSitio(x.id)}
                  activeOpacity={0.85}
                >
                  <Ionicons name={x.icono} size={15} color={sitio === x.id ? C.neon.white : C.neon.w3} />
                  <Text style={[s.sitioTxt, sitio === x.id && s.sitioTxtOn]}>{x.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ gap: Spacing[3] }}>
              {elegidos.map(ds => (
                <Animated.View key={ds} layout={LinearTransition.springify().damping(18)}>
                  <TarjetaDia
                    dia={dias[ds]}
                    diaSemana={ds}
                    onElegirMusculos={() => setEditando(ds)}
                    onQuitar={i => quitarEjercicio(ds, i)}
                    onMover={(i, h) => moverEjercicio(ds, i, h)}
                  />
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── 4 · LOS DETALLES, AL FINAL Y PLEGADOS ────────────────────── */}
        {puedeGuardar && (
          <Animated.View entering={FadeInDown.duration(340)} style={s.bloque}>
            <Pregunta n={4} texto="Ponle nombre" opcional />
            <TextInput
              style={s.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Mi semana"
              placeholderTextColor={C.neon.w4}
              maxLength={60}
            />
            <Text style={[s.pista, { marginTop: Spacing[3] }]}>
              ¿Cuántas semanas antes de replantearlo?
            </Text>
            <View style={s.numeros}>
              {SEMANAS.map(n => (
                <TouchableOpacity
                  key={n}
                  style={[s.semanaBoton, semanas === n && s.semanaBotonOn]}
                  onPress={() => { void Haptics.selectionAsync(); setSemanas(n) }}
                  activeOpacity={0.85}
                >
                  <Text style={[s.semanaTxt, semanas === n && s.semanaTxtOn]}>{n}</Text>
                  <Text style={s.semanaUnidad}>sem</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── El botón, flotando ─────────────────────────────────────────── */}
      {elegidos.length > 0 && (
        <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut} style={s.pie}>
          <TouchableOpacity
            style={[s.guardar, !puedeGuardar && s.guardarOff]}
            onPress={() => void guardar()}
            disabled={!puedeGuardar || guardando}
            activeOpacity={0.9}
          >
            {guardando
              ? <ActivityIndicator color={C.neon.void} />
              : (
                <Text
                  style={[s.guardarTxt, !puedeGuardar && s.guardarTxtOff]}
                  numberOfLines={2}
                >
                  {puedeGuardar
                    ? id ? 'Guardar los cambios' : 'Empezar mi semana'
                    : `Elige qué entrenas ${elegidos.length - listos.length === 1 ? 'el día que falta' : `los ${elegidos.length - listos.length} días que faltan`}`}
                </Text>
              )}
          </TouchableOpacity>
        </Animated.View>
      )}

      <ModalMusculos
        abierto={editando !== null}
        diaSemana={editando}
        musculos={musculos}
        elegidos={editando !== null ? (dias[editando]?.musculos ?? []) : []}
        onCerrar={() => setEditando(null)}
        onConfirmar={ms => {
          const d = editando
          setEditando(null)
          if (d !== null) void ponerMusculos(d, ms)
        }}
      />
    </Screen>
  )
}

// ── Piezas ───────────────────────────────────────────────────────────────────

function Pregunta({ n, texto, opcional }: { n: number; texto: string; opcional?: boolean }) {
  return (
    <View style={s.pregunta}>
      <View style={s.preguntaN}><Text style={s.preguntaNTxt}>{n}</Text></View>
      <Text style={s.preguntaTxt}>{texto}</Text>
      {opcional && <Text style={s.opcional}>opcional</Text>}
    </View>
  )
}

/** Un número del 1 al 7, con un pequeño empujón al elegirlo. */
function Numero({ n, activo, onPress }: { n: number; activo: boolean; onPress: () => void }) {
  const escala = useSharedValue(1)
  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }))

  return (
    <Animated.View style={[{ flex: 1 }, estilo]}>
      <TouchableOpacity
        style={[s.numero, activo && s.numeroOn]}
        onPress={() => {
          escala.value = withSpring(0.9, { damping: 12 }, () => {
            escala.value = withSpring(1, { damping: 10 })
          })
          onPress()
        }}
        activeOpacity={0.9}
      >
        <Text style={[s.numeroTxt, activo && s.numeroTxtOn]}>{n}</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

function Dia({ letra, activo, onPress }: { letra: string; activo: boolean; onPress: () => void }) {
  const p = useSharedValue(activo ? 1 : 0)
  useEffect(() => { p.value = withTiming(activo ? 1 : 0, { duration: 200 }) }, [activo, p])
  const estilo = useAnimatedStyle(() => ({
    transform: [{ scale: 0.94 + p.value * 0.06 }],
  }))

  return (
    <Animated.View style={[{ flex: 1 }, estilo]}>
      <TouchableOpacity
        style={[s.diaChip, activo && s.diaChipOn]}
        onPress={onPress}
        activeOpacity={0.9}
      >
        <Text style={[s.diaTxt, activo && s.diaTxtOn]}>{letra}</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

function TarjetaDia({ dia, diaSemana, onElegirMusculos, onQuitar, onMover }: {
  dia?: DiaEnMontaje
  diaSemana: number
  onElegirMusculos: () => void
  onQuitar: (i: number) => void
  onMover: (i: number, hacia: -1 | 1) => void
}) {
  const vacio = !dia || dia.ejercicios.length === 0

  return (
    <View style={[s.tarjeta, vacio && s.tarjetaVacia]}>
      <TouchableOpacity style={s.tarjetaCabecera} onPress={onElegirMusculos} activeOpacity={0.85}>
        <View style={{ flex: 1 }}>
          <Text style={s.tarjetaDia}>{DIAS_SEMANA[diaSemana]}</Text>
          <Text style={[s.tarjetaNombre, vacio && s.tarjetaNombreVacio]} numberOfLines={1}>
            {vacio ? 'Elige qué entrenas' : dia!.nombre}
          </Text>
        </View>
        {!vacio && (
          <Text style={s.tarjetaCuenta}>
            {dia!.ejercicios.length} {dia!.ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}
          </Text>
        )}
        <Ionicons name={vacio ? 'add-circle' : 'create-outline'} size={20} color={vacio ? C.neon.red : C.neon.w3} />
      </TouchableOpacity>

      {!vacio && (
        <View style={s.lista}>
          {dia!.ejercicios.map((e, i) => (
            <Animated.View
              key={`${e.slug ?? e.nombre}-${i}`}
              entering={FadeInDown.delay(Math.min(i * 45, 220)).duration(300)}
              exiting={FadeOut.duration(160)}
              layout={LinearTransition.springify().damping(18)}
              style={s.fila}
            >
              {e.slug && dia!.posters[e.slug]
                ? <Miniatura poster={dia!.posters[e.slug]} tam={38} />
                : <View style={s.sinFoto}><Ionicons name="barbell-outline" size={15} color={C.neon.w3} /></View>}

              <View style={{ flex: 1 }}>
                <Text style={s.filaNombre} numberOfLines={1}>{e.nombre}</Text>
                <Text style={s.filaDosis}>
                  {prescripcion(e)}
                  {e.descanso ? ` · ${e.descanso}s de descanso` : ''}
                </Text>
              </View>

              <View style={s.filaBotones}>
                <TouchableOpacity onPress={() => onMover(i, -1)} hitSlop={8} disabled={i === 0}>
                  <Ionicons name="chevron-up" size={16} color={i === 0 ? C.neon.w4 : C.neon.w3} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onMover(i, 1)} hitSlop={8} disabled={i === dia!.ejercicios.length - 1}>
                  <Ionicons name="chevron-down" size={16} color={i === dia!.ejercicios.length - 1 ? C.neon.w4 : C.neon.w3} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onQuitar(i)} hitSlop={8}>
                  <Ionicons name="close" size={16} color={C.neon.w2} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          ))}
        </View>
      )}
    </View>
  )
}

/**
 * Elegir músculos. Tres como mucho.
 *
 * El tope no es capricho: con cuatro o más, cada músculo se queda con un solo
 * ejercicio y el día deja de entrenar nada en concreto. Se dice en la pantalla
 * en vez de desactivar botones en silencio.
 */
const TOPE = 3

function ModalMusculos({ abierto, diaSemana, musculos, elegidos, onCerrar, onConfirmar }: {
  abierto: boolean
  diaSemana: number | null
  musculos: Musculo[]
  elegidos: string[]
  onCerrar: () => void
  onConfirmar: (ms: string[]) => void
}) {
  const [sel, setSel] = useState<string[]>(elegidos)
  useEffect(() => { if (abierto) setSel(elegidos) }, [abierto, elegidos])

  const alternar = (clave: string) => {
    void Haptics.selectionAsync()
    setSel(prev => prev.includes(clave)
      ? prev.filter(x => x !== clave)
      : prev.length >= TOPE ? prev : [...prev, clave])
  }

  const lleno = sel.length >= TOPE

  return (
    <Modal visible={abierto} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={s.modalFondo}>
        <Animated.View entering={FadeInDown.duration(280)} style={s.modal}>
          <View style={s.modalAsa} />
          <Text style={s.modalTitulo}>
            {diaSemana !== null ? DIAS_SEMANA[diaSemana] : ''}
          </Text>
          <Text style={s.modalSub}>
            {lleno
              ? 'Tres músculos es el tope: con más, cada uno se queda en un solo ejercicio.'
              : 'Elige hasta tres. ZENCRUS pone los ejercicios y tú los cambias.'}
          </Text>

          <ScrollView contentContainerStyle={s.chips} showsVerticalScrollIndicator={false}>
            {musculos.map((m, i) => {
              const on = sel.includes(m.clave)
              const bloqueado = !on && lleno
              return (
                <Animated.View key={m.clave} entering={FadeIn.delay(Math.min(i * 22, 240)).duration(240)}>
                  <TouchableOpacity
                    style={[s.chip, on && s.chipOn, bloqueado && s.chipOff]}
                    onPress={() => alternar(m.clave)}
                    activeOpacity={0.85}
                    disabled={bloqueado}
                  >
                    {on && <Ionicons name="checkmark" size={13} color={C.neon.void} />}
                    <Text style={[s.chipTxt, on && s.chipTxtOn, bloqueado && s.chipTxtOff]}>{m.nombre}</Text>
                  </TouchableOpacity>
                </Animated.View>
              )
            })}
          </ScrollView>

          <View style={s.modalPie}>
            <TouchableOpacity style={s.modalCancelar} onPress={onCerrar} activeOpacity={0.85}>
              <Text style={s.modalCancelarTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modalOk, sel.length === 0 && s.modalOkOff]}
              onPress={() => onConfirmar(sel)}
              activeOpacity={0.9}
            >
              <Text style={s.modalOkTxt}>
                {sel.length === 0 ? 'Dejar en descanso' : 'Poner los ejercicios'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { paddingHorizontal: Spacing[4], gap: Spacing[5] },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bloque: { gap: Spacing[3] },

  pregunta: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  preguntaN: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: C.neon.red, alignItems: 'center', justifyContent: 'center',
  },
  preguntaNTxt: { fontSize: 11, fontWeight: '900', color: C.neon.void },
  preguntaTxt: { flex: 1, fontSize: T.fontSize.lg, fontWeight: '800', color: C.neon.white, letterSpacing: -0.3 },
  opcional: { fontSize: T.fontSize.xs, fontWeight: '700', color: C.neon.w3 },

  pista: { fontSize: T.fontSize.xs, color: C.neon.w3, lineHeight: 17 },

  numeros: { flexDirection: 'row', gap: Spacing[2] },
  numero: {
    height: 52, borderRadius: BorderRadius.lg,
    backgroundColor: C.neon.pane, borderWidth: 1, borderColor: C.neon.edge,
    alignItems: 'center', justifyContent: 'center',
  },
  numeroOn: { backgroundColor: C.neon.red, borderColor: C.neon.red },
  numeroTxt: { fontSize: T.fontSize.lg, fontWeight: '800', color: C.neon.w2 },
  numeroTxtOn: { color: C.neon.void },

  semana: { flexDirection: 'row', gap: Spacing[2] },
  diaChip: {
    height: 46, borderRadius: BorderRadius.lg,
    backgroundColor: C.neon.pane, borderWidth: 1, borderColor: C.neon.edge,
    alignItems: 'center', justifyContent: 'center',
  },
  diaChipOn: { backgroundColor: C.neon.red, borderColor: C.neon.red },
  diaTxt: { fontSize: T.fontSize.base, fontWeight: '800', color: C.neon.w3 },
  diaTxtOn: { color: C.neon.void },

  sitios: { flexDirection: 'row', gap: Spacing[2] },
  sitio: {
    flex: 1, flexDirection: 'row', gap: Spacing[2],
    height: 40, borderRadius: BorderRadius.lg,
    backgroundColor: C.neon.pane, borderWidth: 1, borderColor: C.neon.edge,
    alignItems: 'center', justifyContent: 'center',
  },
  sitioOn: { backgroundColor: C.neon.paneHi, borderColor: C.neon.redSoft },
  sitioTxt: { fontSize: T.fontSize.sm, fontWeight: '700', color: C.neon.w3 },
  sitioTxtOn: { color: C.neon.white },

  tarjeta: {
    borderRadius: BorderRadius.xl, backgroundColor: C.neon.pane,
    borderWidth: 1, borderColor: C.neon.edge, overflow: 'hidden',
  },
  tarjetaVacia: { borderStyle: 'dashed', borderColor: 'rgba(255,31,61,0.35)' },
  tarjetaCabecera: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[4],
  },
  tarjetaDia: { fontSize: 10, fontWeight: '800', color: C.neon.w3, letterSpacing: 1.2, textTransform: 'uppercase' },
  tarjetaNombre: { fontSize: T.fontSize.base, fontWeight: '800', color: C.neon.white, marginTop: 2 },
  tarjetaNombreVacio: { color: C.neon.redSoft },
  tarjetaCuenta: { fontSize: T.fontSize.xs, fontWeight: '700', color: C.neon.w3 },

  lista: { paddingHorizontal: Spacing[3], paddingBottom: Spacing[3], gap: Spacing[2] },
  fila: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[2], borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  sinFoto: {
    width: 38, height: 38, borderRadius: BorderRadius.md,
    backgroundColor: C.neon.pane, alignItems: 'center', justifyContent: 'center',
  },
  filaNombre: { fontSize: T.fontSize.sm, fontWeight: '700', color: C.neon.white },
  filaDosis: { fontSize: T.fontSize.xs, color: C.neon.w3, marginTop: 1 },
  filaBotones: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },

  input: {
    height: 46, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing[3],
    backgroundColor: C.neon.pane, borderWidth: 1, borderColor: C.neon.edge,
    color: C.neon.white, fontSize: T.fontSize.base, fontWeight: '600',
  },
  semanaBoton: {
    flex: 1, height: 52, borderRadius: BorderRadius.lg,
    backgroundColor: C.neon.pane, borderWidth: 1, borderColor: C.neon.edge,
    alignItems: 'center', justifyContent: 'center',
  },
  semanaBotonOn: { backgroundColor: C.neon.paneHi, borderColor: C.neon.redSoft },
  semanaTxt: { fontSize: T.fontSize.base, fontWeight: '800', color: C.neon.w2 },
  semanaTxtOn: { color: C.neon.white },
  semanaUnidad: { fontSize: 9, fontWeight: '700', color: C.neon.w3 },

  pie: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: Spacing[4], paddingTop: Spacing[3],
    paddingBottom: Platform.OS === 'ios' ? 34 : Spacing[4],
    backgroundColor: 'rgba(5,5,6,0.94)',
    borderTopWidth: 1, borderTopColor: C.neon.edge,
  },
  /**
   * `minHeight` y no `height`, y el texto con margen a los lados.
   *
   * Con altura FIJA, el aviso de «elige qué entrenas los 3 días que faltan»
   * pasaba de una línea a dos y se cortaba por arriba y por abajo: se veía la
   * mitad de las letras y parecía una pantalla rota. Solo se vio mirándola —el
   * compilador no tiene forma de saber cuánto ocupa una frase—.
   */
  guardar: {
    minHeight: 52, paddingVertical: Spacing[2], paddingHorizontal: Spacing[4],
    borderRadius: BorderRadius.xl, backgroundColor: C.neon.red,
    alignItems: 'center', justifyContent: 'center',
  },
  guardarOff: { backgroundColor: C.neon.pane },
  guardarTxt: {
    fontSize: T.fontSize.base, fontWeight: '800', color: C.neon.void,
    textAlign: 'center', lineHeight: 20,
  },
  /**
   * Apagado, el texto NO puede seguir siendo negro.
   *
   * El fondo pasa a gris muy oscuro y el negro sobre negro no se lee. Era el
   * mismo botón diciendo lo único que hace falta hacer para continuar, y no se
   * entendía nada.
   */
  guardarTxtOff: { color: C.neon.w2 },

  modalFondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modal: {
    maxHeight: '82%', backgroundColor: '#0d0d0f',
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderTopWidth: 1, borderColor: C.neon.edge,
    padding: Spacing[4], gap: Spacing[3],
  },
  modalAsa: {
    width: 36, height: 4, borderRadius: 2, alignSelf: 'center',
    backgroundColor: C.neon.w4, marginBottom: Spacing[1],
  },
  modalTitulo: { fontSize: T.fontSize.xl, fontWeight: '800', color: C.neon.white, letterSpacing: -0.4 },
  modalSub: { fontSize: T.fontSize.xs, color: C.neon.w3, lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2], paddingVertical: Spacing[1] },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing[3], height: 38, borderRadius: 19,
    backgroundColor: C.neon.pane, borderWidth: 1, borderColor: C.neon.edge,
  },
  chipOn: { backgroundColor: C.neon.red, borderColor: C.neon.red },
  chipOff: { opacity: 0.35 },
  chipTxt: { fontSize: T.fontSize.sm, fontWeight: '700', color: C.neon.w2 },
  chipTxtOn: { color: C.neon.void },
  chipTxtOff: { color: C.neon.w3 },
  modalPie: { flexDirection: 'row', gap: Spacing[2], paddingTop: Spacing[1] },
  modalCancelar: {
    paddingHorizontal: Spacing[4], height: 48, borderRadius: BorderRadius.xl,
    backgroundColor: C.neon.pane, alignItems: 'center', justifyContent: 'center',
  },
  modalCancelarTxt: { fontSize: T.fontSize.sm, fontWeight: '700', color: C.neon.w2 },
  modalOk: {
    flex: 1, height: 48, borderRadius: BorderRadius.xl, backgroundColor: C.neon.red,
    alignItems: 'center', justifyContent: 'center',
  },
  modalOkOff: { backgroundColor: C.neon.paneHi },
  modalOkTxt: { fontSize: T.fontSize.sm, fontWeight: '800', color: C.neon.void },
})
