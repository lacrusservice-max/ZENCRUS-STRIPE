/**
 * HACER UN EJERCICIO
 * ──────────────────
 * El vídeo arriba y, debajo, todo lo que hace falta para hacerlo: en qué serie
 * vas, cuántas reps buscas, qué peso toca, el botón de anotarla y el descanso.
 *
 * ── Una pantalla por EJERCICIO, no una lista de la sesión entera ────────────
 * Antes se entrenaba desde una pantalla con todos los ejercicios del día y sus
 * series. Sirve para consultar, pero no para el momento en que de verdad se
 * usa: estás de pie, con las manos ocupadas, mirando el móvil dos segundos
 * entre serie y serie. Ahí una lista larga obliga a buscar tu sitio cada vez.
 *
 * Aquí solo hay una cosa a la vez, y siempre la misma: LA SERIE QUE TOCA. El
 * botón grande no cambia de sitio en toda la sesión.
 *
 * ── Anotar es un toque, corregir es opcional ────────────────────────────────
 * El peso y las reps vienen puestos —del plan y de tus marcas— así que la serie
 * normal se anota sin escribir nada. Los campos están ahí para el día que
 * levantes 2,5 kg más o te queden dos reps, que es justo el dato que interesa.
 * Pedir que se escriba todo cada vez es lo que hace que la gente deje de
 * registrar a la tercera semana.
 *
 * ── El descanso empieza SOLO ────────────────────────────────────────────────
 * Al anotar. Nadie se acuerda de arrancar un cronómetro con la respiración
 * agitada, y un descanso a ojo convierte un plan de fuerza en otra cosa.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Platform, Alert, Switch,
} from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { LinearGradient } from 'expo-linear-gradient'
import { volverA } from '@/components/workout/MenuSeccion'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, {
  FadeIn, FadeInDown, FadeOut, LinearTransition,
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { RestTimer } from '@/components/workout/RestTimer'
import { getExercise, ExerciseDetail } from '@/services/exerciseService'
import { calentamiento, fijarPeso } from '@/services/programService'
import { useSessionStore } from '@/store/sessionStore'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

const T = Typography
const C = Colors

/**
 * Lo que llega por la URL desde la ficha del día.
 *
 * Todo `string` porque una URL no tiene tipos, y todo opcional porque puede
 * faltar: se entra aquí desde varios sitios y la pantalla tiene que aguantar
 * que le manden la mitad. Los valores se convierten y se acotan abajo.
 */
type Params = Record<
  'slug' | 'nombre' | 'orden' | 'series' | 'reps' | 'duracion'
  | 'descanso' | 'peso' | 'carga' | 'alFallo'
  | 'programId' | 'semana' | 'dia' | 'titulo' | 'clavePlan' | 'motivo',
  string | undefined
>

export default function HacerEjercicio() {
  const p = useLocalSearchParams() as Params
  const { sesion, series: anotadas, anotarSerie, empezar, empezarDescanso, pararDescanso,
    sumarAlDescanso, descansoHasta, descansoTotal } = useSessionStore()

  const slug = p.slug ?? ''
  const nombre = p.nombre ?? 'Ejercicio'
  const orden = Number(p.orden ?? 0)
  const totalSeries = Math.max(1, Number(p.series ?? 3))
  const repsObjetivo = p.reps ?? ''
  const duracionObjetivo = p.duracion ? Number(p.duracion) : null
  const descanso = Number(p.descanso ?? 90)
  const pesoSugerido = p.peso ? Number(p.peso) : null
  const carga = (p.carga ?? 'weight') as 'weight' | 'bodyweight' | 'band' | 'assisted' | 'none'
  const alFallo = p.alFallo === '1'
  const programId = p.programId ?? ''
  const semana = p.semana ? Number(p.semana) : null
  const dia = p.dia ? Number(p.dia) : null
  const titulo = p.titulo ?? ''
  const clavePlan = p.clavePlan ?? ''
  const motivo = p.motivo ?? ''

  const [ficha, setFicha] = useState<ExerciseDetail | null>(null)
  const [cargando, setCargando] = useState(true)

  /**
   * Las series de ESTE ejercicio, contadas del store.
   *
   * Por `orderIndex` y no por nombre: dentro de una sesión el hueco es lo que
   * identifica al ejercicio, y una serie que llegue sin slug partiría el
   * historial en dos. Es la misma regla que usa el servidor.
   */
  const hechas = useMemo(
    () => anotadas.filter(s => s.orderIndex === orden).length,
    [anotadas, orden],
  )
  const terminado = hechas >= totalSeries
  const serieActual = Math.min(hechas + 1, totalSeries)
  const esLaUltima = serieActual === totalSeries
  const vaAlFallo = alFallo && esLaUltima

  /**
   * Vacío, no «0», cuando el plan todavía no sabe qué peso te toca.
   *
   * Salía un 0 en el campo y un 0 kg es una afirmación: «levantaste nada». Lo
   * honesto cuando no hay dato es no poner nada y dejar que lo escriba quien
   * está delante de la máquina. En la primera semana de un plan nuevo, sin
   * marcas previas, este es EL caso normal, no el raro.
   */
  const [peso, setPeso] = useState(pesoSugerido != null && pesoSugerido > 0 ? String(pesoSugerido) : '')
  const [reps, setReps] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [empezando, setEmpezando] = useState(false)
  const [calentar, setCalentar] = useState(false)
  const [fijando, setFijando] = useState(false)

  /** Las series de aproximación hasta el peso de hoy. */
  const aprox = useMemo(
    () => (calentar ? calentamiento(pesoSugerido) : []),
    [calentar, pesoSugerido],
  )

  const fijarEnElPlan = useCallback(async () => {
    const kg = Number(peso)
    if (!clavePlan || fijando || !Number.isFinite(kg) || kg <= 0) return
    setFijando(true)
    try {
      await fijarPeso(clavePlan, kg)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert('Fijado', `A partir de ahora el plan parte de ${kg} kg en este ejercicio.`)
    } catch {
      Alert.alert('No se pudo fijar', 'Revisa la conexión y vuelve a intentarlo.')
    } finally {
      setFijando(false)
    }
  }, [clavePlan, peso, fijando])

  useEffect(() => {
    void (async () => {
      if (!slug) { setCargando(false); return }
      try { setFicha(await getExercise(slug)) }
      catch { /* sin vídeo se puede entrenar igual: no es un error que pare nada */ }
      finally { setCargando(false) }
    })()
  }, [slug])

  /** Las reps que se proponen: el extremo alto del rango. */
  const repsPropuestas = useMemo(() => {
    if (duracionObjetivo) return ''
    const m = repsObjetivo.match(/(\d+)\s*[-–]\s*(\d+)/)
    if (m) return m[2]
    const solo = repsObjetivo.match(/(\d+)/)
    return solo ? solo[1] : ''
  }, [repsObjetivo, duracionObjetivo])

  useEffect(() => { if (!reps) setReps(repsPropuestas) }, [repsPropuestas, reps])

  const anotar = useCallback(async () => {
    if (guardando || !sesion) return
    const r = Number(reps)
    const w = Number(peso)

    // Una serie tiene que traer AL MENOS UNA medida. Es la misma regla que la
    // base impone, y comprobarla aquí evita un viaje que va a fallar.
    if (!duracionObjetivo && (!Number.isFinite(r) || r <= 0)) {
      Alert.alert('¿Cuántas repeticiones?', 'Escribe cuántas te salieron para poder anotarla.')
      return
    }

    setGuardando(true)
    try {
      await anotarSerie({
        exerciseSlug: slug || undefined,
        exerciseName: nombre,
        orderIndex: orden,
        setIndex: hechas,
        kind: 'normal',
        loadType: carga,
        weightKg: carga === 'weight' && Number.isFinite(w) && w > 0 ? w : null,
        reps: duracionObjetivo ? null : r,
        durationSeconds: duracionObjetivo ?? null,
        distanceM: null,
        rir: null,
        rpe: null,
        restTakenSeconds: null,
      })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // El descanso arranca solo, y NO después de la última: ahí ya no hay nada
      // que esperar y un cronómetro corriendo solo estorba.
      if (hechas + 1 < totalSeries) empezarDescanso(descanso)
      else pararDescanso()
    } catch {
      Alert.alert('No se pudo anotar', 'Se guardó en el teléfono y se enviará sola cuando vuelva la conexión.')
    } finally {
      setGuardando(false)
    }
  }, [guardando, sesion, reps, peso, duracionObjetivo, anotarSerie, slug, nombre,
      orden, hechas, carga, totalSeries, descanso, empezarDescanso, pararDescanso])

  if (cargando) {
    return <Screen><View style={s.centro}><ActivityIndicator color={C.neon.red} /></View></Screen>
  }

  /**
   * ¿La sesión abierta es la de ESTE día?
   *
   * No basta con que haya una. Una sesión local que no llegó al servidor se
   * queda en el disco del teléfono para siempre —apareció una de hace dos días,
   * de un programa que ya ni se seguía— y anotar series ahí las manda a una cola
   * que no sube nunca. Con el contexto del día se distingue.
   *
   * PERO ESTO SOLO PUEDE BLOQUEAR EL REGISTRO, NO LA PANTALLA.
   *
   * La primera versión devolvía un cartel a pantalla completa y era un callejón
   * sin salida: tocabas un ejercicio para VERLO —su vídeo, cómo se hace, qué
   * toca— y te encontrabas un aviso y un botón de volver. Un ejercicio se
   * consulta muchas más veces de las que se registra: antes de ir al gimnasio,
   * al montar el plan, o simplemente por curiosidad.
   *
   * Así que la pantalla se enseña SIEMPRE y lo único que cambia es el bloque de
   * abajo: si no hay sesión, en vez de los campos hay un botón para empezar el
   * entrenamiento ahí mismo, sin volver atrás a buscarlo.
   */
  const laDeEsteDia = !!sesion
    && (!programId || (
      sesion.programId === programId
      && sesion.programWeek === semana
      && sesion.programDay === dia
    ))
  const puedeAnotar = !!sesion && laDeEsteDia

  const empezarYSeguir = async () => {
    if (empezando) return
    setEmpezando(true)
    try {
      await empezar({
        mode: 'gym',
        source: programId ? 'program' : 'freestyle',
        title: titulo || nombre,
        ...(programId ? { programId, programWeek: semana ?? 1, programDay: dia ?? 1 } : {}),
      })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      Alert.alert('No se pudo empezar', 'Revisa la conexión y vuelve a intentarlo.')
    } finally {
      setEmpezando(false)
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── El vídeo ──────────────────────────────────────────────────── */}
        <Animated.View entering={FadeIn.duration(320)} style={s.videoMarco}>
          {ficha?.video ? (
            <Video uri={ficha.video} />
          ) : (
            <View style={[StyleSheet.absoluteFill, s.sinVideo]}>
              <Ionicons name="barbell-outline" size={26} color={C.neon.w3} />
              <Text style={s.sinVideoTxt}>Sin vídeo</Text>
            </View>
          )}

          {/**
            * Un velo sobre el vídeo, y no es cosmético.
            *
            * Los vídeos del catálogo están grabados sobre FONDO BLANCO. A
            * pantalla completa en una app negra eso es una plancha luminosa que
            * deslumbra y se come todo lo demás — el mismo problema que ya dieron
            * los pósters, y por el mismo motivo. Se apaga un poco y se funde por
            * abajo con el fondo de la pantalla, así que el vídeo se sigue viendo
            * pero deja de ser lo único que se ve.
            *
            * El degradado va a lo ANCHO Y ALTO COMPLETOS de su caja y acaba en
            * transparente arriba: un degradado que se corta antes del borde
            * dibuja una costura recta, y ya nos costó semanas encontrar dos.
            */}
          <LinearGradient
            colors={['rgba(5,5,6,0.55)', 'rgba(5,5,6,0.10)', 'rgba(5,5,6,0.30)', C.neon.void]}
            locations={[0, 0.32, 0.72, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <TouchableOpacity style={s.atras} onPress={volverA('/(tabs)/workout')} hitSlop={10} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={20} color={C.neon.white} />
          </TouchableOpacity>
        </Animated.View>

        <View style={s.cuerpo}>
          <Text style={s.nombre} numberOfLines={2}>{nombre}</Text>

          {/* ── El contador de series ───────────────────────────────────── */}
          <View style={s.puntos}>
            {Array.from({ length: totalSeries }, (_, i) => (
              <Punto key={i} hecha={i < hechas} actual={i === hechas && !terminado} />
            ))}
          </View>

          {terminado ? (
            <Animated.View entering={FadeInDown.duration(340)} style={s.hecho}>
              <Ionicons name="checkmark-circle" size={22} color={C.neon.red} />
              <View style={{ flex: 1 }}>
                <Text style={s.hechoTitulo}>Ejercicio terminado</Text>
                <Text style={s.hechoSub}>
                  {totalSeries} {totalSeries === 1 ? 'serie anotada' : 'series anotadas'}. Ya cuentan
                  para tu progreso y tus récords.
                </Text>
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(340)} layout={LinearTransition} style={s.objetivo}>
              <Text style={s.objetivoEtiqueta}>
                SERIE {serieActual} DE {totalSeries}
              </Text>
              <Text style={s.objetivoCifra}>
                {vaAlFallo
                  ? 'Al fallo'
                  : duracionObjetivo
                    ? `${duracionObjetivo} s`
                    : repsObjetivo || '—'}
                {!vaAlFallo && !duracionObjetivo && repsObjetivo ? <Text style={s.objetivoUnidad}> reps</Text> : null}
              </Text>
              {vaAlFallo && (
                <Text style={s.objetivoNota}>
                  Las que salgan con buena técnica. Cuando la forma se rompa, se acabó
                  la serie — no es lo mismo llegar al fallo que llegar a hacerlo mal.
                </Text>
              )}
              {pesoSugerido != null && carga === 'weight' && (
                <Text style={s.objetivoPeso}>
                  Toca {pesoSugerido} kg{motivo ? ` — ${motivo.toLowerCase()}` : ', calculado con tus marcas'}
                </Text>
              )}
            </Animated.View>
          )}

          {/* ── El descanso ─────────────────────────────────────────────── */}
          {descansoHasta && !terminado && (
            <Animated.View entering={FadeIn.duration(240)} exiting={FadeOut} style={s.descanso}>
              <RestTimer
                hasta={descansoHasta}
                total={descansoTotal}
                onSaltar={pararDescanso}
                onSumar={sumarAlDescanso}
              />
            </Animated.View>
          )}

          {/**
            * Sin entrenamiento abierto: se empieza AQUÍ.
            *
            * El botón grande es SIEMPRE la acción que se puede hacer. La primera
            * versión ponía «Tienes otro a medias» en el botón rojo y lo dejaba
            * desactivado, con la acción de verdad en un botón gris debajo: el
            * elemento más llamativo de la pantalla era el único muerto. Un aviso
            * es texto; un botón es algo que pasa al tocarlo.
            */}
          {!terminado && !puedeAnotar && (
            <Animated.View entering={FadeInDown.duration(340)} style={s.anotar}>
              {sesion && !laDeEsteDia ? (
                <>
                  <Text style={s.aviso}>
                    Sigue abierto «{sesion.title}». Termínalo o descártalo y podrás
                    anotar las series de este ejercicio.
                  </Text>
                  <TouchableOpacity
                    style={s.boton}
                    onPress={() => {
                      // A su ficha del día si era de un plan; la pantalla vieja
                      // solo para lo suelto, que es lo único que no tiene ficha.
                      if (sesion.programId && sesion.programWeek && sesion.programDay) {
                        router.push(`/workout/program/day?week=${sesion.programWeek}&day=${sesion.programDay}`)
                      } else {
                        router.push('/workout/active')
                      }
                    }}
                    activeOpacity={0.9}
                  >
                    <Text style={s.botonTxt}>Ir a «{sesion.title}»</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={s.boton}
                    onPress={() => void empezarYSeguir()}
                    disabled={empezando}
                    activeOpacity={0.9}
                  >
                    {empezando
                      ? <ActivityIndicator color={C.neon.void} />
                      : <Text style={s.botonTxt}>Empezar el entrenamiento</Text>}
                  </TouchableOpacity>
                  <Text style={s.pieNota}>
                    Puedes mirar el ejercicio sin empezar nada. El botón es solo para
                    cuando quieras anotar las series.
                  </Text>
                </>
              )}
            </Animated.View>
          )}

          {/* ── Anotar ──────────────────────────────────────────────────── */}
          {!terminado && puedeAnotar && (
            <Animated.View entering={FadeInDown.duration(340)} style={s.anotar}>
              <View style={s.campos}>
                {carga === 'weight' && (
                  <Campo
                    etiqueta="PESO"
                    unidad="kg"
                    valor={peso}
                    onChange={setPeso}
                    onPaso={d => setPeso(v => String(Math.max(0, (Number(v) || 0) + d)))}
                    paso={2.5}
                  />
                )}
                {!duracionObjetivo && (
                  <Campo
                    etiqueta="REPETICIONES"
                    valor={reps}
                    onChange={setReps}
                    onPaso={d => setReps(v => String(Math.max(0, (Number(v) || 0) + d)))}
                    paso={1}
                  />
                )}
              </View>

              <TouchableOpacity
                style={s.boton}
                onPress={() => void anotar()}
                disabled={guardando}
                activeOpacity={0.9}
              >
                {guardando
                  ? <ActivityIndicator color={C.neon.void} />
                  : <Text style={s.botonTxt}>Serie hecha</Text>}
              </TouchableOpacity>

              <Text style={s.pieNota}>
                Vienen puestos del plan. Cámbialos solo si hoy hiciste otra cosa —
                eso es justo lo que hace que el peso de la próxima semana salga bien.
              </Text>

              {/**
                * Fijar el peso EN EL PLAN es otra cosa que anotar una serie.
                *
                * Anotar dice «hoy levanté esto». Fijar dice «de aquí en adelante
                * parte de este número», y sobrescribe lo que calcula la
                * progresión. Son decisiones distintas y por eso son dos botones
                * distintos: mezclarlas haría que corregir una serie mal escrita
                * te cambiara el plan de las próximas semanas sin pedírtelo.
                */}
              {clavePlan && carga === 'weight' && Number(peso) > 0 && Number(peso) !== pesoSugerido && (
                <TouchableOpacity
                  style={s.fijar}
                  onPress={() => void fijarEnElPlan()}
                  disabled={fijando}
                  activeOpacity={0.85}
                >
                  {fijando
                    ? <ActivityIndicator color={C.neon.w2} />
                    : (
                      <>
                        <Ionicons name="pin-outline" size={14} color={C.neon.w2} />
                        <Text style={s.fijarTxt}>
                          Fijar {peso} kg en el plan para las próximas semanas
                        </Text>
                      </>
                    )}
                </TouchableOpacity>
              )}

              {/**
                * Las series de aproximación, donde de verdad se deciden.
                *
                * Estaban en la ficha del día, dentro de la tarjeta de cada
                * ejercicio, y engordaban una lista que se recorre de un vistazo.
                * Aquí están en la pantalla en la que ya estás con la máquina
                * delante, que es el único momento en el que se sabe si hoy hace
                * falta calentar o se llega caliente de la calle.
                */}
              {pesoSugerido != null && pesoSugerido > 0 && carga === 'weight' && (
                <View style={s.calentar}>
                  <TouchableOpacity
                    style={s.calentarFila}
                    onPress={() => { void Haptics.selectionAsync(); setCalentar(v => !v) }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.calentarTitulo}>Series de aproximación</Text>
                      <Text style={s.calentarSub}>
                        Subir hasta los {pesoSugerido} kg poco a poco. No cuentan
                        en tu volumen ni en tus récords.
                      </Text>
                    </View>
                    <Switch
                      value={calentar}
                      onValueChange={v => { void Haptics.selectionAsync(); setCalentar(v) }}
                      trackColor={{ false: 'rgba(255,255,255,0.14)', true: C.neon.red }}
                      thumbColor="#fff"
                    />
                  </TouchableOpacity>

                  {calentar && aprox.length > 0 && (
                    <Animated.View entering={FadeInDown.duration(260)} style={s.aproxFilas}>
                      {aprox.map((a, i) => (
                        <View key={i} style={s.aproxPastilla}>
                          <Text style={s.aproxTxt}>{a.pesoKg} × {a.reps}</Text>
                        </View>
                      ))}
                    </Animated.View>
                  )}
                </View>
              )}
            </Animated.View>
          )}

          {terminado && (
            <TouchableOpacity style={s.boton} onPress={volverA('/(tabs)/workout')} activeOpacity={0.9}>
              <Text style={s.botonTxt}>Volver al entrenamiento</Text>
            </TouchableOpacity>
          )}

          {/* ── Cómo se hace, al final ──────────────────────────────────── */}
          {ficha?.comoSeHace && (
            <Animated.View entering={FadeInDown.delay(120).duration(340)} style={s.como}>
              <Text style={s.comoTitulo}>CÓMO SE HACE</Text>
              <Paso icono="body-outline" texto={ficha.comoSeHace.colocate} />
              <Paso icono="swap-vertical-outline" texto={ficha.comoSeHace.mueve} />
              <Paso icono="resize-outline" texto={ficha.comoSeHace.hastaDonde} />
              <Paso icono="alert-circle-outline" texto={ficha.comoSeHace.ojoCon} aviso />
            </Animated.View>
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </Screen>
  )
}

// ── Piezas ───────────────────────────────────────────────────────────────────

/**
 * El vídeo, en su propio componente.
 *
 * Y no en la pantalla, porque `useVideoPlayer` crea el reproductor cuando el
 * componente se monta: con la URL todavía vacía —que es como está mientras se
 * pide la ficha— nacería sin fuente y no se vería nada. Montándolo solo cuando
 * la URL existe, nace con ella. Es el mismo apaño que ya usa la ficha del
 * catálogo, y conviene que sean el mismo.
 *
 * En bucle porque la técnica se mira dos o tres veces seguidas, y CALLADO
 * porque nadie quiere que su móvil suene en un gimnasio.
 */
function Video({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, p => { p.loop = true; p.muted = true; p.play() })
  return (
    <VideoView
      style={StyleSheet.absoluteFill}
      player={player}
      nativeControls={false}
      contentFit="cover"
    />
  )
}

/** Un punto por serie. Lleno la hecha, con aro la que toca, hueco lo que queda. */
function Punto({ hecha, actual }: { hecha: boolean; actual: boolean }) {
  const e = useSharedValue(actual ? 1 : 0)
  useEffect(() => { e.value = withSpring(actual ? 1 : 0, { damping: 14 }) }, [actual, e])
  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: 1 + e.value * 0.28 }] }))

  return (
    <Animated.View style={estilo}>
      <View style={[s.punto, hecha && s.puntoHecho, actual && s.puntoActual]}>
        {hecha && <Ionicons name="checkmark" size={11} color={C.neon.void} />}
      </View>
    </Animated.View>
  )
}

/**
 * Un campo con sus botones de más y de menos.
 *
 * Los botones existen porque en un gimnasio se escribe fatal: manos sudadas,
 * pantalla pequeña y prisa. Subir 2,5 kg es un toque; abrir el teclado para
 * cambiar un número es lo que hace que la gente deje de anotar.
 */
function Campo({ etiqueta, unidad, valor, onChange, onPaso, paso }: {
  etiqueta: string
  unidad?: string
  valor: string
  onChange: (v: string) => void
  onPaso: (d: number) => void
  paso: number
}) {
  return (
    <View style={s.campo}>
      <Text style={s.campoEtiqueta}>{etiqueta}</Text>
      <View style={s.campoFila}>
        <TouchableOpacity
          onPress={() => { void Haptics.selectionAsync(); onPaso(-paso) }}
          style={s.paso} hitSlop={6} activeOpacity={0.7}
        >
          <Ionicons name="remove" size={17} color={C.neon.w2} />
        </TouchableOpacity>

        <View style={s.campoCentro}>
          <TextInput
            style={s.campoInput}
            value={valor}
            onChangeText={onChange}
            keyboardType="decimal-pad"
            selectTextOnFocus
            placeholder="—"
            placeholderTextColor={C.neon.w4}
          />
          {unidad && <Text style={s.campoUnidad}>{unidad}</Text>}
        </View>

        <TouchableOpacity
          onPress={() => { void Haptics.selectionAsync(); onPaso(paso) }}
          style={s.paso} hitSlop={6} activeOpacity={0.7}
        >
          <Ionicons name="add" size={17} color={C.neon.w2} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

function Paso({ icono, texto, aviso }: {
  icono: keyof typeof Ionicons.glyphMap; texto: string; aviso?: boolean
}) {
  return (
    <View style={s.pasoFila}>
      <Ionicons name={icono} size={15} color={aviso ? C.neon.redSoft : C.neon.w3} />
      <Text style={[s.pasoTxt, aviso && { color: C.neon.w2 }]}>{texto}</Text>
    </View>
  )
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { paddingBottom: Spacing[6] },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing[3] },
  vacio: { fontSize: T.fontSize.sm, color: C.neon.w2, textAlign: 'center' },
  volver: {
    paddingHorizontal: Spacing[5], paddingVertical: Spacing[3],
    borderRadius: BorderRadius.full, backgroundColor: C.neon.pane,
  },
  volverTxt: { fontSize: T.fontSize.sm, fontWeight: '700', color: C.neon.white },

  videoMarco: {
    height: 230, backgroundColor: '#111', overflow: 'hidden',
  },
  sinVideo: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  sinVideoTxt: { fontSize: T.fontSize.xs, color: C.neon.w3, fontWeight: '600' },
  atras: {
    position: 'absolute', top: Platform.OS === 'ios' ? 8 : 12, left: 12,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },

  cuerpo: { paddingHorizontal: Spacing[4], paddingTop: Spacing[4], gap: Spacing[4] },
  nombre: { fontSize: T.fontSize['2xl'], fontWeight: '800', color: C.neon.white, letterSpacing: -0.6 },

  puntos: { flexDirection: 'row', gap: Spacing[2], alignItems: 'center' },
  punto: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  puntoHecho: { backgroundColor: C.neon.white, borderColor: C.neon.white },
  puntoActual: { borderColor: C.neon.red, borderWidth: 2.5 },

  objetivo: {
    padding: Spacing[4], borderRadius: BorderRadius.xl,
    backgroundColor: C.neon.pane, borderWidth: 1, borderColor: C.neon.edge,
    gap: 4,
  },
  objetivoEtiqueta: { fontSize: 10, fontWeight: '800', color: C.neon.w3, letterSpacing: 1.3 },
  objetivoCifra: { fontSize: 34, fontWeight: '800', color: C.neon.white, letterSpacing: -1 },
  objetivoUnidad: { fontSize: T.fontSize.base, fontWeight: '700', color: C.neon.w2 },
  objetivoNota: { fontSize: T.fontSize.xs, color: C.neon.w3, lineHeight: 17, marginTop: 4 },
  objetivoPeso: { fontSize: T.fontSize.xs, color: C.neon.redSoft, fontWeight: '700', marginTop: 4 },

  descanso: { paddingVertical: Spacing[2] },

  anotar: { gap: Spacing[3] },
  campos: { flexDirection: 'row', gap: Spacing[3] },
  campo: { flex: 1, gap: 6 },
  campoEtiqueta: { fontSize: 9.5, fontWeight: '800', color: C.neon.w3, letterSpacing: 1.1 },
  campoFila: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.neon.pane, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: C.neon.edge, height: 54,
  },
  paso: { width: 40, height: '100%', alignItems: 'center', justifyContent: 'center' },
  campoCentro: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 3 },
  campoInput: {
    fontSize: T.fontSize.xl, fontWeight: '800', color: C.neon.white,
    textAlign: 'center', minWidth: 44, padding: 0,
  },
  campoUnidad: { fontSize: T.fontSize.xs, fontWeight: '700', color: C.neon.w3 },

  boton: {
    minHeight: 56, borderRadius: BorderRadius.xl, backgroundColor: C.neon.red,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing[4],
  },
  botonTxt: { fontSize: T.fontSize.lg, fontWeight: '800', color: C.neon.void, textAlign: 'center' },
  pieNota: { fontSize: T.fontSize.xs, color: C.neon.w3, lineHeight: 16, textAlign: 'center' },

  fijar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 44, paddingHorizontal: Spacing[4],
    borderRadius: BorderRadius.xl,
    backgroundColor: C.neon.pane, borderWidth: 1, borderColor: C.neon.edge,
  },
  fijarTxt: { fontSize: T.fontSize.xs, fontWeight: '700', color: C.neon.w2, textAlign: 'center' },

  calentar: { gap: Spacing[2], paddingTop: Spacing[1] },
  calentarFila: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  calentarTitulo: { fontSize: 12.5, fontWeight: '700', color: C.neon.w2 },
  calentarSub: { fontSize: 11, color: C.neon.w3, marginTop: 2, lineHeight: 15 },
  aproxFilas: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  aproxPastilla: {
    paddingHorizontal: Spacing[2] + 2, paddingVertical: 4,
    borderRadius: BorderRadius.full, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  aproxTxt: { fontSize: 11, fontWeight: '700', color: C.neon.w2 },
  aviso: {
    fontSize: T.fontSize.sm, color: C.neon.w2, lineHeight: 20, textAlign: 'center',
    paddingHorizontal: Spacing[2],
  },

  hecho: {
    flexDirection: 'row', gap: Spacing[3], alignItems: 'flex-start',
    padding: Spacing[4], borderRadius: BorderRadius.xl,
    backgroundColor: 'rgba(255,31,61,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.30)',
  },
  hechoTitulo: { fontSize: T.fontSize.base, fontWeight: '800', color: C.neon.white },
  hechoSub: { fontSize: T.fontSize.xs, color: C.neon.w2, lineHeight: 17, marginTop: 2 },

  como: { gap: Spacing[2], paddingTop: Spacing[2] },
  comoTitulo: { fontSize: 10, fontWeight: '800', color: C.neon.w3, letterSpacing: 1.3 },
  pasoFila: { flexDirection: 'row', gap: Spacing[2], alignItems: 'flex-start' },
  pasoTxt: { flex: 1, fontSize: T.fontSize.sm, color: C.neon.w3, lineHeight: 19 },
})
