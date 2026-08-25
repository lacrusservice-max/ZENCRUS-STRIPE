/**
 * TU SEMANA · UNA PREGUNTA CADA VEZ
 * ─────────────────────────────────
 * Cuatro pasos a pantalla completa, cada uno con su fotografía: cuántos días,
 * qué días, qué entrenas cada uno, y cómo se llama.
 *
 * ── Por qué pasos y no una pantalla larga ───────────────────────────────────
 * Montar una semana son cuatro decisiones ENCADENADAS: no se pueden repartir
 * los días sin saber cuántos, ni elegir los músculos sin saber qué días. Puestas
 * todas a la vez, la pantalla enseña tres preguntas que aún no se pueden
 * contestar, y eso es justo lo que hace que alguien la cierre.
 *
 * ── El defecto de los asistentes, resuelto ──────────────────────────────────
 * Un asistente por pasos esconde lo ya decidido y obliga a volver atrás para
 * recordarlo. Por eso arriba hay SIEMPRE un resumen de lo elegido —los días, y
 * cuáles ya tienen ejercicios— y se puede retroceder en cualquier momento sin
 * perder nada. Sin eso, esta forma sería peor que una lista.
 *
 * ── La fotografía no es decoración ──────────────────────────────────────────
 * Cambia con la pregunta: al elegir cuántos días sale la montaña —el ritmo, la
 * constancia—, al elegir qué se entrena sale el gimnasio. Es lo que impide que
 * un formulario de cuatro pantallas se sienta como un trámite. Va oscurecida y
 * con el degradado cubriendo la caja ENTERA, acabando en opaco: uno que se
 * corta antes de su borde dibuja una costura recta, y eso ya costó semanas.
 *
 * ── Editar entra por el paso 2 ──────────────────────────────────────────────
 * Quien viene a cambiar su semana ya contestó cuántos días hace tiempo. Hacerle
 * pasar otra vez por esa pregunta sería el defecto clásico de los asistentes.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, Platform, Pressable,
} from 'react-native'
import { Image } from '@/components/ui/Imagen'
import { useEspacioBarra } from '@/components/ui/BarraDeSeccion'
import { useCasaMaterial } from '@/store/casaMaterialStore'
import { ListaAparejos, cuantosCon, EJERCICIOS_SIN_MATERIAL } from '@/components/workout/MaterialCasa'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, {
  FadeIn, FadeInDown, FadeOut, SlideInRight, SlideOutLeft, LinearTransition,
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated'
import { Miniatura } from '@/components/workout/Miniatura'
import {
  guardarPlan, inscribirse, getPrograma, getMusculos, proponerEjercicios,
  EjercicioPlan, PlanPropio, Musculo, DIAS_SEMANA, DIAS_CORTOS, prescripcion,
} from '@/services/programService'
import { FOTOS } from '@/constants/imagenes'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

const T = Typography
const C = Colors

const SEMANAS = [4, 8, 12]
const TOPE_MUSCULOS = 3

/** Una foto por paso. La pregunta y la imagen cuentan lo mismo. */
const FOTO_PASO = ['montana', 'gimnasio', 'fuerza', 'brazos']

interface DiaEnMontaje {
  diaSemana: number
  musculos: string[]
  nombre: string
  ejercicios: (EjercicioPlan & { musculo?: string })[]
  posters: Record<string, string>
}

export default function TuSemana() {
  // El hueco de la barra flotante: sin esto el pie queda debajo y no se toca.
  const espacioBarra = useEspacioBarra()
  const { tengo, preguntado, marcarPreguntado } = useCasaMaterial()
  const { id, modo: modoParam } = useLocalSearchParams<{ id?: string; modo?: string }>()

  /**
   * Se arranca en el primer paso de VERDAD. En casa ese es el material, y con
   * `useState(0)` el asistente abría en «cuántos días» diciendo «paso 2 de 5»,
   * que es el mismo defecto que ya tenía al editar: un paso 1 que nadie vio.
   *
   * Editar lo pisa luego con `setPaso(1)` al cargar el plan, que es lo que se
   * quiere: quien ya contestó no repite.
   */
  const [paso, setPaso] = useState(() => (modoParam === 'home' ? -1 : 0))
  /**
   * Editar salta la pregunta de cuántos días —ya la contestaste—, así que el
   * asistente pasa a tener TRES pasos y hay que contarlos como tres. Antes
   * entraba directo en «PASO 2 DE 4» sin haber visto el 1, que se lee como que
   * algo se saltó solo.
   */
  const esEdicion = !!id
  /**
   * LOS PASOS DE VERDAD, NO SIEMPRE LOS MISMOS
   * ──────────────────────────────────────────
   * · Editar salta «cuántos días»: ya lo contestaste.
   * · En casa se antepone «qué tienes», porque de esa respuesta depende TODO lo
   *   que se propone después. Preguntarla en un modal suelto, como estaba, era
   *   el error: aparecía una vez, no alimentaba nada y no volvía. Aquí es el
   *   primer eslabón de la cadena y se ve que lo es.
   *
   * En gimnasio no se pregunta: hay de todo y sería un trámite sin premio.
   */
  const [cuantos, setCuantos] = useState<number | null>(null)
  const [elegidos, setElegidos] = useState<number[]>([])
  const [dias, setDias] = useState<Record<number, DiaEnMontaje>>({})
  /**
   * EL LUGAR NO SE PREGUNTA DENTRO DE UNA SECCIÓN
   * ─────────────────────────────────────────────
   * Si entraste por Gimnasio, el plan es de gimnasio. Enseñar ahí un botón de
   * «En casa» no es solo ruido: es ofrecer salir de la sección desde dentro, y
   * quien lo toca acaba con un plan de casa colgando de la portada del gimnasio.
   *
   * Solo se pregunta cuando nadie ha dicho de dónde viene.
   */
  const lugarFijado = modoParam === 'gym' || modoParam === 'home'
  const [sitio, setSitio] = useState<'gym' | 'home'>(
    modoParam === 'home' ? 'home' : 'gym'
  )
  const [semanas, setSemanas] = useState(8)
  const [nombre, setNombre] = useState('')

  const [musculos, setMusculos] = useState<Musculo[]>([])
  const [sugeridos, setSugeridos] = useState<Record<number, number[]>>({})
  const [editando, setEditando] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(true)

  const PASO_MATERIAL = -1
  const base = esEdicion ? [1, 2, 3] : [0, 1, 2, 3]
  const visibles = sitio === 'home' ? [PASO_MATERIAL, ...base] : base


  const indice = Math.max(0, visibles.indexOf(paso))

  useEffect(() => {
    void (async () => {
      try {
        const m = await getMusculos()
        setMusculos(m.musculos)
        setSugeridos(Object.fromEntries(m.diasSugeridos.map(d => [d.n, d.dias])))

        if (id) {
          const p = await getPrograma(id)
          setNombre(p.name); setSemanas(p.weeks)
          setSitio(p.mode === 'home' ? 'home' : 'gym')
          const cargados: Record<number, DiaEnMontaje> = {}
          for (const d of p.plan.dias) {
            const ds = d.diaSemana ?? 0
            cargados[ds] = {
              diaSemana: ds, musculos: d.musculos ?? [],
              nombre: d.nombre, ejercicios: d.ejercicios, posters: {},
            }
          }
          setDias(cargados)
          setElegidos(Object.keys(cargados).map(Number).sort((a, b) => a - b))
          setCuantos(Object.keys(cargados).length)
          setPaso(1)
        }
      } catch {
        Alert.alert('No se pudo cargar', 'Revisa la conexión y vuelve a intentarlo.')
      } finally { setCargando(false) }
    })()
  }, [id])

  /**
   * Elegir cuántos días RESPETA lo que ya habías tocado.
   *
   * Si ya habías puesto lunes y jueves y subes a tres, se queda lunes y jueves y
   * se añade uno. Sobrescribir lo que alguien acaba de elegir es la clase de
   * detalle que hace que una pantalla se sienta hostil.
   */
  const elegirCuantos = useCallback((n: number) => {
    void Haptics.selectionAsync()
    setCuantos(n)
    setElegidos(prev => {
      if (prev.length === 0) return [...(sugeridos[n] ?? [0, 2, 4])].slice(0, n).sort((a, b) => a - b)
      if (prev.length === n) return prev
      if (prev.length > n) return prev.slice(0, n)
      const faltan = n - prev.length
      const cand = (sugeridos[n] ?? [0, 1, 2, 3, 4, 5, 6]).filter(d => !prev.includes(d))
      const resto = [0, 1, 2, 3, 4, 5, 6].filter(d => !prev.includes(d) && !cand.includes(d))
      return [...prev, ...[...cand, ...resto].slice(0, faltan)].sort((a, b) => a - b)
    })
  }, [sugeridos])

  const alternarDia = useCallback((d: number) => {
    void Haptics.selectionAsync()
    setElegidos(prev => {
      if (prev.includes(d)) {
        setDias(({ [d]: _f, ...resto }) => resto)
        return prev.filter(x => x !== d)
      }
      return [...prev, d].sort((a, b) => a - b)
    })
  }, [])

  const ponerMusculos = useCallback(async (diaSemana: number, ms: string[]) => {
    if (ms.length === 0) {
      setDias(prev => ({ ...prev, [diaSemana]: { diaSemana, musculos: [], nombre: '', ejercicios: [], posters: {} } }))
      return
    }
    try {
      const p = await proponerEjercicios(ms, sitio, sitio === 'home' ? (preguntado ? tengo : null) : null)
      setDias(prev => ({
        ...prev,
        [diaSemana]: { diaSemana, musculos: ms, nombre: p.nombre, ejercicios: p.ejercicios, posters: p.posters ?? {} },
      }))
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      Alert.alert('No se pudo proponer', 'Revisa la conexión. Puedes elegir los músculos otra vez.')
    }
  }, [sitio, tengo, preguntado])

  const quitarEjercicio = useCallback((ds: number, i: number) => {
    void Haptics.selectionAsync()
    setDias(prev => ({ ...prev, [ds]: { ...prev[ds], ejercicios: prev[ds].ejercicios.filter((_, j) => j !== i) } }))
  }, [])

  const listos = elegidos.filter(d => (dias[d]?.ejercicios.length ?? 0) > 0)
  const completo = listos.length > 0 && listos.length === elegidos.length

  /** Qué hace falta para poder pasar de cada paso. */
  const puedeSeguir = paso === PASO_MATERIAL ? true
    : paso === 0 ? cuantos !== null
    : paso === 1 ? elegidos.length > 0
    : paso === 2 ? completo
    : true

  const guardar = async () => {
    if (!completo || guardando) return
    setGuardando(true)
    try {
      const plan: PlanPropio = {
        name: nombre.trim() || 'Mi semana',
        weeks: semanas, goal: 'hypertrophy', level: 'intermediate',
        mode: sitio, deloadEvery: 4,
        dias: elegidos.map((ds, i) => ({
          dia: i + 1, diaSemana: ds,
          musculos: dias[ds].musculos, nombre: dias[ds].nombre,
          foco: dias[ds].musculos[0],
          ejercicios: dias[ds].ejercicios.map(({ musculo: _m, ...e }) => e),
        })),
      }
      const guardado = await guardarPlan(plan, id)
      if (!id) await inscribirse(guardado.id).catch(() => {})
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      // Al lugar del plan que acabas de montar, no siempre al gimnasio: quien
      // monta uno de casa acababa mirando la portada del gimnasio.
      router.replace(sitio === 'home' ? '/workout/casa' : '/workout/gym')
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      Alert.alert('No se pudo guardar', msg ?? 'Revisa la conexión y vuelve a intentarlo.')
    } finally { setGuardando(false) }
  }

  const atras = () => {
    void Haptics.selectionAsync()
    // Se retrocede por la lista de pasos visibles, no restando uno: con el
    // paso del material en -1 y editando saltándose el 0, restar caía en huecos.
    const i = visibles.indexOf(paso)
    if (i <= 0) router.back()
    else setPaso(visibles[i - 1])
  }

  const siguiente = () => {
    if (!puedeSeguir) return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (paso === PASO_MATERIAL) marcarPreguntado()
    if (paso === 3) void guardar()
    else {
      const i = visibles.indexOf(paso)
      setPaso(visibles[Math.min(i + 1, visibles.length - 1)])
    }
  }

  if (cargando) {
    return <View style={s.negro}><ActivityIndicator color={C.neon.red} /></View>
  }

  return (
    <View style={s.negro}>
      {/* ── El hero, que cambia con la pregunta ──────────────────────── */}
      <Animated.View key={`foto-${paso}`} entering={FadeIn.duration(520)} style={s.hero}>
        <Image
          source={FOTOS[FOTO_PASO[paso]].fuente}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={420}
        />
        <LinearGradient
          colors={['rgba(5,5,6,0.45)', 'rgba(5,5,6,0.72)', 'rgba(5,5,6,0.97)', C.neon.void]}
          locations={[0, 0.4, 0.82, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </Animated.View>

      <View style={[s.contenido, { paddingBottom: espacioBarra }]}>
        <View style={s.arriba}>
          <View style={s.progreso}>
            {visibles.map((v, i) => <Barra key={v} activa={i <= indice} />)}
          </View>
          <Text style={s.pasoTxt}>PASO {indice + 1} DE {visibles.length}</Text>

          {(cuantos !== null || elegidos.length > 0) && (
            <Animated.View entering={FadeIn.duration(320)} style={s.resumen}>
              {cuantos !== null && <Pastilla texto={`${elegidos.length} días`} />}
              {elegidos.map(d => (
                <Pastilla key={d} texto={DIAS_CORTOS[d]} lleno={(dias[d]?.ejercicios.length ?? 0) > 0} />
              ))}
            </Animated.View>
          )}
        </View>

        <Animated.View
          key={`paso-${paso}`}
          entering={SlideInRight.duration(320)}
          exiting={SlideOutLeft.duration(200)}
          style={s.pregunta}
        >
          {paso === PASO_MATERIAL && <PasoMaterial />}
          {paso === 0 && <Paso0 cuantos={cuantos} onElegir={elegirCuantos} sitio={sitio} onSitio={setSitio}
              lugarFijado={lugarFijado}
            />}
          {paso === 1 && <Paso1 elegidos={elegidos} onAlternar={alternarDia} />}
          {paso === 2 && <Paso2 elegidos={elegidos} dias={dias} onEditar={setEditando} onQuitar={quitarEjercicio} />}
          {paso === 3 && (
            <Paso3
              nombre={nombre} onNombre={setNombre}
              semanas={semanas} onSemanas={setSemanas}
              elegidos={elegidos} dias={dias}
            />
          )}
        </Animated.View>

        <View style={s.pie}>
          <TouchableOpacity style={s.atras} onPress={atras} activeOpacity={0.85}>
            <Ionicons name="chevron-back" size={17} color={C.neon.w2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.siguiente, !puedeSeguir && s.siguienteOff]}
            onPress={siguiente}
            disabled={!puedeSeguir || guardando}
            activeOpacity={0.9}
          >
            {guardando
              ? <ActivityIndicator color={C.neon.void} />
              : (
                <Text style={[s.siguienteTxt, !puedeSeguir && s.siguienteTxtOff]} numberOfLines={2}>
                  {paso === 3 ? (id ? 'Guardar los cambios' : 'Empezar mi semana')
                    : paso === 2 && !completo
                      ? `Elige qué entrenas ${elegidos.length - listos.length === 1 ? 'el día que falta' : `los ${elegidos.length - listos.length} días que faltan`}`
                      : 'Siguiente'}
                </Text>
              )}
          </TouchableOpacity>
        </View>
      </View>

      <ModalMusculos
        abierto={editando !== null}
        diaSemana={editando}
        musculos={musculos}
        elegidos={editando !== null ? (dias[editando]?.musculos ?? []) : []}
        onCerrar={() => setEditando(null)}
        onConfirmar={ms => { const d = editando; setEditando(null); if (d !== null) void ponerMusculos(d, ms) }}
      />
    </View>
  )
}

// ── Los cuatro pasos ─────────────────────────────────────────────────────────


/**
 * PASO · ¿QUÉ TIENES EN CASA?
 * ═══════════════════════════
 * El primer eslabón: de esta respuesta salen los ejercicios que se proponen en
 * los pasos siguientes, así que va antes que nada. No bloquea nunca —«no tengo
 * nada» es una respuesta válida y deja 34 ejercicios de peso corporal— porque
 * un paso que obliga a marcar algo se contesta mintiendo.
 */
function PasoMaterial() {
  const tengo = useCasaMaterial(st => st.tengo)
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing[3] }}>
      <Text style={s.h}>¿Qué tienes en casa?</Text>
      <Text style={s.p}>
        Marca solo lo que de verdad tengas a mano. Con esto monto tu semana con ejercicios
        que puedes hacer hoy, no con una lista bonita que no sirve.
      </Text>
      <View style={{ height: Spacing[3] }} />
      <ListaAparejos />
      <Text style={s.pMini}>
        {tengo.length === 0
          ? `Sin material te quedan ${EJERCICIOS_SIN_MATERIAL} ejercicios de peso corporal. Sobra para entrenar.`
          : `Podré elegir entre ${cuantosCon(tengo)} ejercicios, contando los ${EJERCICIOS_SIN_MATERIAL} de peso corporal.`}
      </Text>
    </ScrollView>
  )
}

function Paso0({ cuantos, onElegir, sitio, onSitio, lugarFijado }: {
  cuantos: number | null; onElegir: (n: number) => void
  sitio: 'gym' | 'home'; onSitio: (s: 'gym' | 'home') => void
  /** Si entraste por una sección, el lugar ya está decidido y no se pregunta. */
  lugarFijado?: boolean
}) {
  return (
    <>
      <Text style={s.h}>¿Cuántos días{'\n'}puedes entrenar?</Text>
      <Text style={s.p}>Cuenta los que de verdad vas a ir, no los que te gustaría.</Text>
      <View style={s.numeros}>
        {[1, 2, 3, 4, 5, 6, 7].map(n => (
          <Numero key={n} n={n} activo={cuantos === n} onPress={() => onElegir(n)} />
        ))}
      </View>
      {!lugarFijado && (
      <View style={s.sitios}>
        {([
          { id: 'gym' as const, label: 'Gimnasio', icono: 'barbell-outline' as const },
          { id: 'home' as const, label: 'En casa', icono: 'home-outline' as const },
        ]).map(x => (
          <TouchableOpacity
            key={x.id}
            style={[s.sitio, sitio === x.id && s.sitioOn]}
            onPress={() => { void Haptics.selectionAsync(); onSitio(x.id) }}
            activeOpacity={0.85}
          >
            <Ionicons name={x.icono} size={15} color={sitio === x.id ? '#fff' : C.neon.w3} />
            <Text style={[s.sitioTxt, sitio === x.id && s.sitioTxtOn]}>{x.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      )}
    </>
  )
}

function Paso1({ elegidos, onAlternar }: { elegidos: number[]; onAlternar: (d: number) => void }) {
  return (
    <>
      <Text style={s.h}>¿Qué días?</Text>
      <Text style={s.p}>
        Te los proponemos repartidos: el músculo se recupera en 48 horas y luego
        empieza a perder, así que tres seguidos rinden menos que tres alternos.
      </Text>
      <View style={s.semana}>
        {DIAS_CORTOS.map((letra, d) => (
          <Dia key={d} letra={letra} activo={elegidos.includes(d)} onPress={() => onAlternar(d)} />
        ))}
      </View>
      <Text style={s.pMini}>
        {elegidos.length === 0
          ? 'Toca los días que te vengan bien.'
          : elegidos.map(d => DIAS_SEMANA[d]).join(' · ')}
      </Text>
    </>
  )
}

function Paso2({ elegidos, dias, onEditar, onQuitar }: {
  elegidos: number[]
  dias: Record<number, DiaEnMontaje>
  onEditar: (d: number) => void
  onQuitar: (ds: number, i: number) => void
}) {
  return (
    <>
      <Text style={s.h}>¿Qué entrenas{'\n'}cada día?</Text>
      <Text style={s.p}>Hasta tres músculos por día. ZENCRUS pone los ejercicios y tú los cambias.</Text>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: Spacing[3], paddingBottom: Spacing[3] }}
        showsVerticalScrollIndicator={false}
      >
        {elegidos.map(ds => {
          const d = dias[ds]
          const vacio = !d || d.ejercicios.length === 0
          return (
            <Animated.View key={ds} layout={LinearTransition.springify().damping(18)}>
              <View style={[s.tarjeta, vacio && s.tarjetaVacia]}>
                <TouchableOpacity style={s.tarjetaCab} onPress={() => onEditar(ds)} activeOpacity={0.85}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.tarjetaDia}>{DIAS_SEMANA[ds]?.toUpperCase()}</Text>
                    <Text style={[s.tarjetaNombre, vacio && { color: C.neon.redSoft }]} numberOfLines={1}>
                      {vacio ? 'Elige qué entrenas' : d.nombre}
                    </Text>
                  </View>
                  {!vacio && <Text style={s.tarjetaCuenta}>{d.ejercicios.length}</Text>}
                  <Ionicons
                    name={vacio ? 'add-circle' : 'create-outline'}
                    size={19}
                    color={vacio ? C.neon.red : C.neon.w3}
                  />
                </TouchableOpacity>

                {!vacio && (
                  <View style={s.lista}>
                    {d.ejercicios.map((e, i) => (
                      <Animated.View
                        key={`${e.slug ?? e.nombre}-${i}`}
                        entering={FadeInDown.delay(Math.min(i * 40, 200)).duration(280)}
                        exiting={FadeOut.duration(140)}
                        layout={LinearTransition.springify().damping(18)}
                        style={s.fila}
                      >
                        {e.slug && d.posters[e.slug]
                          ? <Miniatura poster={d.posters[e.slug]} tam={32} />
                          : <View style={s.sinFoto}><Ionicons name="barbell-outline" size={13} color={C.neon.w3} /></View>}
                        <View style={{ flex: 1 }}>
                          <Text style={s.filaNombre} numberOfLines={1}>{e.nombre}</Text>
                          <Text style={s.filaDosis}>{prescripcion(e)}</Text>
                        </View>
                        <TouchableOpacity onPress={() => onQuitar(ds, i)} hitSlop={8}>
                          <Ionicons name="close" size={15} color={C.neon.w3} />
                        </TouchableOpacity>
                      </Animated.View>
                    ))}
                  </View>
                )}
              </View>
            </Animated.View>
          )
        })}
      </ScrollView>
    </>
  )
}

function Paso3({ nombre, onNombre, semanas, onSemanas, elegidos, dias }: {
  nombre: string; onNombre: (v: string) => void
  semanas: number; onSemanas: (n: number) => void
  elegidos: number[]; dias: Record<number, DiaEnMontaje>
}) {
  const total = elegidos.reduce((a, d) => a + (dias[d]?.ejercicios.length ?? 0), 0)
  return (
    <>
      <Text style={s.h}>Ya está.{'\n'}Ponle nombre.</Text>
      <Text style={s.p}>{elegidos.length} días · {total} ejercicios. Todo se puede cambiar después.</Text>
      <TextInput
        style={s.input}
        value={nombre}
        onChangeText={onNombre}
        placeholder="Mi semana"
        placeholderTextColor={C.neon.w4}
        maxLength={60}
      />
      <Text style={s.pMini}>¿Cuántas semanas antes de replantearlo?</Text>
      <View style={s.numeros}>
        {SEMANAS.map(n => (
          <TouchableOpacity
            key={n}
            style={[s.semanaBoton, semanas === n && s.semanaBotonOn]}
            onPress={() => { void Haptics.selectionAsync(); onSemanas(n) }}
            activeOpacity={0.85}
          >
            <Text style={[s.semanaTxt, semanas === n && s.semanaTxtOn]}>{n}</Text>
            <Text style={s.semanaUnidad}>sem</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  )
}

// ── Piezas ───────────────────────────────────────────────────────────────────

function Barra({ activa }: { activa: boolean }) {
  const p = useSharedValue(activa ? 1 : 0)
  useEffect(() => { p.value = withTiming(activa ? 1 : 0, { duration: 380 }) }, [activa, p])
  const estilo = useAnimatedStyle(() => ({ opacity: 0.18 + p.value * 0.82 }))
  return <Animated.View style={[s.barra, activa && s.barraOn, estilo]} />
}

function Pastilla({ texto, lleno }: { texto: string; lleno?: boolean }) {
  return (
    <View style={[s.pastilla, lleno && s.pastillaOn]}>
      <Text style={[s.pastillaTxt, lleno && s.pastillaTxtOn]}>{texto}</Text>
    </View>
  )
}

function Numero({ n, activo, onPress }: { n: number; activo: boolean; onPress: () => void }) {
  const e = useSharedValue(1)
  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: e.value }] }))
  return (
    <Animated.View style={[{ flex: 1 }, estilo]}>
      <TouchableOpacity
        style={[s.numero, activo && s.numeroOn]}
        onPress={() => {
          e.value = withSpring(0.88, { damping: 12 }, () => { e.value = withSpring(1, { damping: 10 }) })
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
  useEffect(() => { p.value = withSpring(activo ? 1 : 0, { damping: 14 }) }, [activo, p])
  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: 0.92 + p.value * 0.08 }] }))
  return (
    <Animated.View style={[{ flex: 1 }, estilo]}>
      <TouchableOpacity style={[s.diaChip, activo && s.diaChipOn]} onPress={onPress} activeOpacity={0.9}>
        <Text style={[s.diaTxt, activo && s.diaTxtOn]}>{letra}</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

/**
 * Elegir músculos. Tres como mucho.
 *
 * El tope no es capricho: con cuatro o más, cada músculo se queda con un solo
 * ejercicio y el día deja de entrenar nada en concreto. Se dice en la pantalla
 * en vez de desactivar botones en silencio.
 */
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
      : prev.length >= TOPE_MUSCULOS ? prev : [...prev, clave])
  }
  const lleno = sel.length >= TOPE_MUSCULOS

  return (
    <Modal visible={abierto} animationType="slide" transparent onRequestClose={onCerrar}>
      <Pressable style={s.modalFondo} onPress={onCerrar}>
        <Animated.View entering={FadeInDown.duration(280)} style={s.modal}>
          <Pressable>
            <View style={s.asa} />
            <Text style={s.modalTitulo}>{diaSemana !== null ? DIAS_SEMANA[diaSemana] : ''}</Text>
            <Text style={s.modalSub}>
              {lleno
                ? 'Tres es el tope: con más, cada músculo se queda en un solo ejercicio.'
                : 'Elige hasta tres. ZENCRUS pone los ejercicios y tú los cambias.'}
            </Text>
            <ScrollView contentContainerStyle={s.chips} showsVerticalScrollIndicator={false}>
              {musculos.map((m, i) => {
                const on = sel.includes(m.clave)
                const bloq = !on && lleno
                return (
                  <Animated.View key={m.clave} entering={FadeIn.delay(Math.min(i * 22, 240)).duration(240)}>
                    <TouchableOpacity
                      style={[s.chip, on && s.chipOn, bloq && s.chipOff]}
                      onPress={() => alternar(m.clave)}
                      activeOpacity={0.85}
                      disabled={bloq}
                    >
                      {on && <Ionicons name="checkmark" size={13} color={C.neon.void} />}
                      <Text style={[s.chipTxt, on && s.chipTxtOn]}>{m.nombre}</Text>
                    </TouchableOpacity>
                  </Animated.View>
                )
              })}
            </ScrollView>
            <View style={s.modalPie}>
              <TouchableOpacity style={s.modalCancelar} onPress={onCerrar} activeOpacity={0.85}>
                <Text style={s.modalCancelarTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalOk} onPress={() => onConfirmar(sel)} activeOpacity={0.9}>
                <Text style={s.modalOkTxt}>
                  {sel.length === 0 ? 'Dejar en descanso' : 'Poner los ejercicios'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  )
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  negro: { flex: 1, backgroundColor: C.neon.void, alignItems: 'stretch', justifyContent: 'center' },
  hero: { position: 'absolute', top: 0, left: 0, right: 0, height: '58%' },
  contenido: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 58 : 34,
    paddingHorizontal: Spacing[4],
    // El hueco de abajo lo pone `useEspacioBarra`, no un número a ojo:
    // la barra flota encima y aquí el pie dejaba de poderse tocar.
  },

  arriba: { gap: Spacing[2] },
  progreso: { flexDirection: 'row', gap: 4 },
  barra: { flex: 1, height: 3, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' },
  barraOn: { backgroundColor: C.neon.red },
  pasoTxt: { fontSize: 9.5, fontWeight: '800', color: 'rgba(255,255,255,0.55)', letterSpacing: 1.3 },

  resumen: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 },
  pastilla: {
    paddingHorizontal: 9, paddingVertical: 3.5, borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  pastillaOn: { backgroundColor: C.neon.red },
  pastillaTxt: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.75)' },
  pastillaTxtOn: { color: '#fff' },

  pregunta: { flex: 1, justifyContent: 'center', gap: Spacing[3] },
  h: { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.9, lineHeight: 34 },
  p: { fontSize: T.fontSize.sm, color: 'rgba(255,255,255,0.72)', lineHeight: 20 },
  pMini: { fontSize: T.fontSize.xs, color: 'rgba(255,255,255,0.55)' },

  numeros: { flexDirection: 'row', gap: Spacing[2] },
  numero: {
    height: 52, borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  numeroOn: { backgroundColor: C.neon.red, borderColor: C.neon.red },
  numeroTxt: { fontSize: T.fontSize.lg, fontWeight: '800', color: 'rgba(255,255,255,0.8)' },
  numeroTxtOn: { color: '#fff' },

  sitios: { flexDirection: 'row', gap: Spacing[2], marginTop: Spacing[1] },
  sitio: {
    flex: 1, flexDirection: 'row', gap: Spacing[2], height: 42,
    borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  sitioOn: { backgroundColor: 'rgba(255,31,61,0.22)', borderColor: C.neon.red },
  sitioTxt: { fontSize: T.fontSize.sm, fontWeight: '700', color: C.neon.w3 },
  sitioTxtOn: { color: '#fff' },

  semana: { flexDirection: 'row', gap: Spacing[2] },
  diaChip: {
    height: 50, borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  diaChipOn: { backgroundColor: C.neon.red, borderColor: C.neon.red },
  diaTxt: { fontSize: T.fontSize.base, fontWeight: '800', color: 'rgba(255,255,255,0.7)' },
  diaTxtOn: { color: '#fff' },

  tarjeta: {
    borderRadius: BorderRadius.xl, backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)', overflow: 'hidden',
  },
  tarjetaVacia: { borderStyle: 'dashed', borderColor: 'rgba(255,31,61,0.4)' },
  tarjetaCab: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], padding: Spacing[3] },
  tarjetaDia: { fontSize: 9.5, fontWeight: '800', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.1 },
  tarjetaNombre: { fontSize: T.fontSize.sm, fontWeight: '800', color: '#fff', marginTop: 2 },
  tarjetaCuenta: { fontSize: T.fontSize.xs, fontWeight: '800', color: 'rgba(255,255,255,0.5)' },

  lista: { paddingHorizontal: Spacing[3], paddingBottom: Spacing[3], gap: 6 },
  fila: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    padding: 5, borderRadius: BorderRadius.md, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  sinFoto: {
    width: 32, height: 32, borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center',
  },
  filaNombre: { fontSize: 12, fontWeight: '700', color: '#fff' },
  filaDosis: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 1 },

  input: {
    height: 48, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing[3],
    backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    color: '#fff', fontSize: T.fontSize.base, fontWeight: '700',
  },
  semanaBoton: {
    flex: 1, height: 52, borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  semanaBotonOn: { backgroundColor: 'rgba(255,31,61,0.22)', borderColor: C.neon.red },
  semanaTxt: { fontSize: T.fontSize.base, fontWeight: '800', color: 'rgba(255,255,255,0.8)' },
  semanaTxtOn: { color: '#fff' },
  semanaUnidad: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.45)' },

  pie: { flexDirection: 'row', gap: Spacing[2], alignItems: 'stretch' },
  atras: {
    width: 52, borderRadius: BorderRadius.xl,
    backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  siguiente: {
    flex: 1, minHeight: 54, borderRadius: BorderRadius.xl, backgroundColor: C.neon.red,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing[4],
  },
  siguienteOff: { backgroundColor: 'rgba(255,255,255,0.09)' },
  siguienteTxt: { fontSize: T.fontSize.base, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 20 },
  siguienteTxtOff: { color: 'rgba(255,255,255,0.55)' },

  modalFondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.62)' },
  modal: {
    maxHeight: '82%', backgroundColor: '#0d0d0f',
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderTopWidth: 1, borderColor: C.neon.edge,
    padding: Spacing[4], gap: Spacing[3],
  },
  asa: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: C.neon.w4 },
  modalTitulo: { fontSize: T.fontSize.xl, fontWeight: '800', color: C.neon.white, letterSpacing: -0.4 },
  modalSub: { fontSize: T.fontSize.xs, color: C.neon.w3, marginTop: -6, lineHeight: 17 },
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
  modalOkTxt: { fontSize: T.fontSize.sm, fontWeight: '800', color: C.neon.void },
})
