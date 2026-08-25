/**
 * SESIÓN DE ENTRENAMIENTO
 * ───────────────────────
 * La pantalla donde se entrena. Todo lo demás de la sección —estadísticas,
 * récords, programas— sale de lo que se registra aquí: sin una serie anotada no
 * hay nada que contar.
 *
 * ── Está pensada para usarse con una mano y sudando ─────────────────────────
 * Los objetivos: registrar una serie en dos toques, ver el descanso desde el
 * suelo y no tener que apuntar nada dos veces. De ahí que el peso y las
 * repeticiones vengan rellenos con lo de la serie anterior, que el descanso
 * arranque solo y que el esfuerzo sea opcional.
 *
 * ── Nada espera a la red ────────────────────────────────────────────────────
 * Registrar una serie es instantáneo aunque no haya cobertura; el store la
 * manda cuando puede. Lo único que se ve es un punto discreto de «sin enviar».
 *
 * ── Los cuatro modos ────────────────────────────────────────────────────────
 * La sesión nace con un modo (gimnasio, casa, aire libre o clase) y el modelo
 * de datos los admite los cuatro desde hoy. Aquí están construidos los dos de
 * series —gimnasio y casa—; lo que cambia entre ellos es el tipo de carga por
 * defecto y si tiene sentido enseñar la calculadora de discos.
 */

import { hoyLocal } from '@/utils/fechas'
import { RachaEncendida } from '@/components/racha/RachaEncendida'
import { useRachaDelDia } from '@/hooks/useRachaDelDia'
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  Alert, Modal, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from '@/components/ui/Imagen'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, router } from 'expo-router'
import { volverA } from '@/components/workout/MenuSeccion'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useKeepAwake } from 'expo-keep-awake'
import { useSessionStore, SerieLocal } from '@/store/sessionStore'
import { useWorkoutStore } from '@/store/workoutStore'
import { useAchievementStore } from '@/store/achievementStore'
import { historialEjercicio } from '@/services/sessionService'
import type { Modo, TipoCarga, TipoSerie, Serie, Marca } from '@/services/sessionService'
import { listExercises, getPosters, ExerciseCard } from '@/services/exerciseService'
import { getEntrenamiento, leerReceta } from '@/services/quickService'
import { getDia } from '@/services/programService'
import { RestTimer } from '@/components/workout/RestTimer'
import { PlateCalculator } from '@/components/workout/PlateCalculator'
import { EffortPicker } from '@/components/workout/EffortPicker'
import { Miniatura } from '@/components/workout/Miniatura'
import { repartirDiscos } from '@/utils/discos'
import { FOTOS, FOTO_MODO } from '@/constants/imagenes'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

// ── Formas locales ───────────────────────────────────────────────────────────

/**
 * Un hueco de la sesión: un ejercicio y lo que se pretende hacer en él.
 *
 * Se llama hueco y no «ejercicio» porque el servidor identifica el ejercicio
 * por su posición dentro de la sesión: las cuatro series del hueco 0 son el
 * mismo ejercicio aunque se le cambie el nombre a mitad.
 */
interface Hueco {
  orderIndex: number
  slug?: string
  nombre: string
  muscle?: string | null
  seriesObjetivo: number
  repsObjetivo: string
  descanso: number
  /**
   * Póster firmado del catálogo.
   *
   * Los tres estados son distintos y hacen falta los tres: `undefined` es «aún
   * no se ha preguntado» —y es lo que dispara la búsqueda—, `null` es «no tiene
   * imagen» y una cadena es la imagen. Con solo dos estados, un ejercicio
   * escrito a mano se pediría en bucle para siempre.
   */
  poster?: string | null
  /**
   * Lo que propone el programa para hoy. Rellena el formulario la primera vez
   * y no manda: quien entrena lo cambia si hoy no toca eso, y en cuanto hay una
   * serie registrada gana lo que se hizo de verdad.
   */
  pesoSugerido?: number | null
  cargaSugerida?: TipoCarga
}

const MODOS: { id: Modo; label: string; icono: keyof typeof Ionicons.glyphMap; listo: boolean }[] = [
  { id: 'gym',     label: 'Gimnasio',   icono: 'barbell',        listo: true  },
  { id: 'home',    label: 'En casa',    icono: 'home',           listo: true  },
  { id: 'outdoor', label: 'Aire libre', icono: 'trail-sign',     listo: false },
  { id: 'class',   label: 'Clases',     icono: 'play-circle',    listo: false },
]

const TIPOS_SERIE: { id: TipoSerie; label: string }[] = [
  { id: 'warmup',  label: 'Calent.' },
  { id: 'normal',  label: 'Normal' },
  { id: 'dropset', label: 'Drop' },
  { id: 'failure', label: 'Fallo' },
]

const CARGAS: { id: TipoCarga; label: string }[] = [
  { id: 'weight',     label: 'Con peso' },
  { id: 'bodyweight', label: 'Peso corporal' },
  { id: 'band',       label: 'Goma' },
  { id: 'assisted',   label: 'Asistido' },
]

const num = (s: string): number | null => {
  const v = parseFloat(s.replace(',', '.'))
  return Number.isFinite(v) ? v : null
}

/**
 * El cronómetro de la sesión.
 *
 * Pasa a horas al llegar a los sesenta minutos. Sin eso, una sesión larga —o
 * una que se quedó abierta, que pasa— marcaba «204:53», y un reloj de más de
 * cien minutos no se lee: hay que dividir mentalmente para saber que son tres
 * horas y pico.
 */
const mmss = (segundos: number) => {
  const s = Math.max(0, Math.round(segundos))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(seg).padStart(2, '0')}`
    : `${m}:${String(seg).padStart(2, '0')}`
}

// ── Buscador de ejercicios ───────────────────────────────────────────────────

/**
 * Añade un ejercicio a la sesión sobre la marcha.
 *
 * Busca en la biblioteca de verdad —los 206 con su vídeo— en vez de en una
 * lista de nombres escritos a mano: así la serie queda atada al slug del
 * catálogo y el historial de ese ejercicio no se parte según cómo se escriba.
 * Aun así se puede escribir un nombre libre, porque en un gimnasio siempre hay
 * una máquina rara que no está en ningún catálogo.
 */
function BuscadorEjercicio({ visible, modo, onElegir, onCerrar }: {
  visible: boolean
  modo: Modo
  onElegir: (e: { slug?: string; nombre: string; muscle?: string | null; poster?: string | null }) => void
  onCerrar: () => void
}) {
  const [q, setQ] = useState('')
  const [lista, setLista] = useState<ExerciseCard[]>([])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!visible) return
    let vivo = true
    setCargando(true)
    const t = setTimeout(() => {
      listExercises({ q, place: modo === 'home' ? 'home' : undefined, limit: 30 })
        .then(r => { if (vivo) setLista(r.exercises) })
        .catch(() => { if (vivo) setLista([]) })
        .finally(() => { if (vivo) setCargando(false) })
    }, 280)   // sin esto se pide una vez por letra tecleada
    return () => { vivo = false; clearTimeout(t) }
  }, [q, visible, modo])

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCerrar}>
      <SafeAreaView style={b.wrap}>
        <View style={b.cabecera}>
          <Text style={b.titulo}>Añadir ejercicio</Text>
          <TouchableOpacity onPress={onCerrar} hitSlop={10}>
            <Ionicons name="close" size={22} color={Colors.neon.w2} />
          </TouchableOpacity>
        </View>

        <View style={b.buscador}>
          <Ionicons name="search" size={16} color={Colors.neon.w3} />
          <TextInput
            style={b.input}
            value={q}
            onChangeText={setQ}
            placeholder="Press, sentadilla, dominadas…"
            placeholderTextColor={Colors.neon.w3}
            autoCorrect={false}
          />
          {cargando && <ActivityIndicator size="small" color={Colors.neon.w3} />}
        </View>

        <ScrollView contentContainerStyle={{ padding: Spacing[4], paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {q.trim().length > 1 && (
            <TouchableOpacity
              style={b.libre}
              onPress={() => { onElegir({ nombre: q.trim() }); setQ('') }}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={16} color={Colors.neon.red} />
              <Text style={b.libreTxt}>Usar «{q.trim()}» tal cual</Text>
            </TouchableOpacity>
          )}

          {lista.map(e => (
            <TouchableOpacity
              key={e.slug}
              style={b.fila}
              onPress={() => {
                onElegir({ slug: e.slug, nombre: e.name, muscle: e.muscle, poster: e.poster })
                setQ('')
              }}
              activeOpacity={0.8}
            >
              {/* La imagen, no un punto de color. Buscando «press» salen ocho
                  variantes y la foto es lo que distingue la inclinada de la
                  declinada sin leerse los ocho nombres enteros. */}
              <Miniatura poster={e.poster} tam={44} />
              <View style={{ flex: 1 }}>
                <Text style={b.filaNombre}>{e.name}</Text>
                <Text style={b.filaSub}>{e.muscleEs ?? '—'} · {e.equipmentEs}</Text>
              </View>
              <Ionicons name="add-circle-outline" size={20} color={Colors.neon.w3} />
            </TouchableOpacity>
          ))}

          {!cargando && lista.length === 0 && (
            <Text style={b.vacio}>Nada con ese nombre en la biblioteca.</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

// ── Elegir modo ──────────────────────────────────────────────────────────────

function ElegirModo({ onElegir }: { onElegir: (m: Modo) => void }) {
  return (
    <SafeAreaView style={s.contenedor}>
      <View style={s.modoWrap}>
        <Text style={s.modoTitulo}>¿Cómo entrenas hoy?</Text>
        <Text style={s.modoSub}>
          Se puede cambiar de ejercicio sobre la marcha; el modo solo decide qué
          te enseña la pantalla.
        </Text>

        <View style={s.modoRejilla}>
          {MODOS.map(m => (
            <TouchableOpacity
              key={m.id}
              style={[s.modoCelda, !m.listo && s.modoCeldaPronto]}
              onPress={() => m.listo ? onElegir(m.id) : undefined}
              activeOpacity={m.listo ? 0.82 : 1}
            >
              <Ionicons
                name={m.icono}
                size={26}
                color={m.listo ? Colors.neon.white : Colors.neon.w4}
              />
              <Text style={[s.modoLabel, !m.listo && { color: Colors.neon.w4 }]}>{m.label}</Text>
              {!m.listo && <Text style={s.modoPronto}>Pronto</Text>}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={volverA('/(tabs)/workout')} style={s.modoVolver}>
          <Text style={s.modoVolverTxt}>Volver</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

export default function SesionActiva() {
  const racha = useRachaDelDia()
  useKeepAwake()   // la pantalla no se apaga a mitad de una serie

  const {
    routineId, mode, quick, programId, week, day, title,
  } = useLocalSearchParams<{
    routineId?: string; mode?: Modo; quick?: string
    programId?: string; week?: string; day?: string; title?: string
  }>()
  const { routines } = useWorkoutStore()
  const { addXP } = useAchievementStore()

  const {
    sesion, series, marcas, descansoHasta, descansoTotal, cargando,
    restaurar, empezar, anotarSerie, quitarSerie,
    empezarDescanso, pararDescanso, sumarAlDescanso,
    duracionSegundos, terminar, descartar, pendientes,
  } = useSessionStore()

  const rutina = routines.find(r => r.id === routineId)

  const [huecos, setHuecos] = useState<Hueco[]>([])
  const [actual, setActual] = useState(0)
  const [buscando, setBuscando] = useState(false)
  const [terminada, setTerminada] = useState<{
    duracion: number; series: number; volumen: number
    /** El gasto que estimó el servidor al cerrar. Null si no pudo. */
    kcal?: number | null
    /**
     * Las marcas y el título se COPIAN aquí al cerrar, no se leen del store.
     *
     * `terminar()` vacía el store —tiene que hacerlo: la sesión ya no está
     * abierta— y eso borraba los récords justo antes de que el resumen los
     * pintara. Se batían dos marcas y la pantalla de felicitación salía
     * vacía, que es el peor momento posible para perder ese dato.
     *
     * Con el título pasaba lo mismo y se veía menos: `sesion` ya era null al
     * pintar, así que el resumen de una rutina llamada «Empuje A» titulaba
     * «Entrenamiento», el valor de reserva. No parecía un fallo, solo un
     * resumen genérico.
     */
    marcas: typeof marcas
    titulo: string
  } | null>(null)
  const [reloj, setReloj] = useState(0)

  /**
   * Un entrenamiento generado llega como RECETA («upper-15-home»), no como
   * lista.
   *
   * Se vuelve a pedir al servidor en vez de arrastrar seis ejercicios por la
   * barra de direcciones o meter un estado global para pasar datos de una
   * pantalla a la de al lado. Funciona porque el generador es determinista: la
   * misma receta el mismo día da exactamente los mismos ejercicios.
   */
  const [tituloGenerado, setTituloGenerado] = useState<string | null>(null)


  // Entradas de la serie en curso
  const [peso, setPeso] = useState('')
  const [reps, setReps] = useState('')
  const [tipo, setTipo] = useState<TipoSerie>('normal')
  const [carga, setCarga] = useState<TipoCarga>('weight')
  const [rir, setRir] = useState<number | null>(null)
  const [verDiscos, setVerDiscos] = useState(false)
  const [barraKg, setBarraKg] = useState(20)
  const [ultimaVez, setUltimaVez] = useState<{ sets: Serie[]; records: Marca[] } | null>(null)

  const modo: Modo = sesion?.mode ?? (mode as Modo) ?? 'gym'

  // ── Arranque ───────────────────────────────────────────────────────────────
  useEffect(() => { void restaurar() }, [restaurar])

  /**
   * Un día de programa se pide igual que una receta: por su semana y su día.
   *
   * No se arrastran seis ejercicios con sus pesos por la barra de direcciones.
   * Y se pide con `week`/`day` explícitos, no «el de hoy», para que repetir un
   * día pasado desde la línea de tiempo traiga ESE día y no el que toca ahora.
   */
  useEffect(() => {
    if (!programId || huecos.length > 0) return
    let vivo = true
    getDia(week ? Number(week) : undefined, day ? Number(day) : undefined)
      .then(d => {
        if (!vivo) return
        setTituloGenerado(d.nombre)
        setHuecos(d.ejercicios.map((e, i) => ({
          orderIndex: i,
          slug: e.slug,
          nombre: e.nombre,
          muscle: e.muscle,
          seriesObjetivo: e.series,
          repsObjetivo: e.reps ?? (e.duracion ? `${e.duracion}s` : '—'),
          descanso: e.descanso,
          poster: (e.slug ? d.posters[e.slug] : null) ?? null,
          // El peso que propuso el programa, para rellenar el formulario. Es
          // una sugerencia: quien entrena lo cambia si hoy no toca.
          pesoSugerido: e.pesoKg,
          cargaSugerida: e.carga,
        })))
      })
      .catch(() => { if (vivo) setTituloGenerado(title ?? 'Entrenamiento') })
    return () => { vivo = false }
  }, [programId, week, day, huecos.length, title])

  /**
   * Se pidió abrir un entrenamiento y ya había OTRO en curso.
   *
   * Pasa más de lo que parece: se deja una sesión a medias —o se queda una
   * huérfana porque el servidor no respondió al abrirla— y días después se
   * entra desde el día del programa. Como el store no abre una sesión nueva
   * mientras haya otra viva, se recuperaba la vieja EN SILENCIO: la pantalla
   * decía «Empuje» y quien entrenaba creía estar haciendo su día del plan,
   * pero la sesión no llevaba programa y al terminar el plan no avanzaba.
   *
   * Ahora se pregunta. Y no se descarta nada por nuestra cuenta: lo registrado
   * es trabajo de alguien.
   */
  const [conflicto, setConflicto] = useState(false)

  useEffect(() => {
    if (!sesion || cargando || conflicto) return

    const pedido = programId
      ? { tipo: 'programa', id: `${programId}:${week}:${day}` }
      : rutina ? { tipo: 'rutina', id: rutina.id }
      : quick ? { tipo: 'rapido', id: quick }
      : null
    if (!pedido) return

    const enCurso = sesion.programId
      ? `${sesion.programId}:${sesion.programWeek}:${sesion.programDay}`
      : sesion.routineId ?? null

    if (enCurso === pedido.id) return   // es el mismo: no hay nada que preguntar

    setConflicto(true)
    Alert.alert(
      'Ya tenías un entrenamiento abierto',
      `Sigue abierto «${sesion.title}»${series.length > 0 ? ` con ${series.length} ${series.length === 1 ? 'serie' : 'series'}` : ' sin series registradas'}. ¿Qué hacemos?`,
      [
        { text: `Seguir con «${sesion.title}»`, style: 'cancel' },
        {
          text: 'Descartarlo y empezar lo nuevo',
          style: 'destructive',
          onPress: async () => { await descartar(); setConflicto(false) },
        },
      ],
    )
  }, [sesion, cargando, conflicto, programId, week, day, rutina, quick, series.length, descartar])

  useEffect(() => {
    if (sesion || cargando) return
    if (!rutina && !mode && !quick && !programId) return   // sin nada que abrir: se pregunta el modo

    /**
     * Con una receta, se espera al título del generador antes de abrir.
     *
     * Los dos efectos —abrir la sesión y pedir el entrenamiento generado—
     * arrancaban a la vez, y abrir siempre ganaba la carrera: la sesión se
     * creaba con «Entrenamiento libre» y el título de verdad llegaba un
     * instante tarde, cuando ya no se vuelve a llamar. Por eso el historial
     * acababa lleno de entradas idénticas llamadas «Entrenamiento libre», que
     * es justo lo que hace inútil una lista de entrenamientos.
     *
     * La espera son milisegundos y no puede quedarse colgada: si el generador
     * falla, su `catch` pone un título de reserva y esto sigue.
     */
    // Lo mismo para un día de programa: su nombre llega con el día.
    if ((quick || programId) && !tituloGenerado) return

    void empezar({
      mode: (mode as Modo) ?? 'gym',
      source: programId ? 'program' : rutina ? 'routine' : 'freestyle',
      title: tituloGenerado ?? rutina?.name ?? 'Entrenamiento libre',
      routineId: rutina?.id,
      programId,
      programWeek: week ? Number(week) : undefined,
      programDay: day ? Number(day) : undefined,
    }).then(({ reanudada }) => {
      if (reanudada) {
        Alert.alert(
          'Tenías un entrenamiento abierto',
          'Se ha recuperado con las series que ya llevabas. Si no era esto, ciérralo desde la X.',
        )
      }
    })
  }, [sesion, cargando, rutina, mode, quick, programId, week, day, tituloGenerado, empezar])

  useEffect(() => {
    if (!quick || huecos.length > 0) return
    const receta = leerReceta(quick)
    if (!receta) return
    let vivo = true
    getEntrenamiento(receta.region, receta.minutos, receta.lugar)
      .then(g => {
        if (!vivo) return
        setTituloGenerado(g.titulo)
        setHuecos(g.ejercicios.map((e, i) => ({
          orderIndex: i,
          slug: e.slug,
          nombre: e.nombre,
          muscle: e.muscle,
          seriesObjetivo: e.series,
          repsObjetivo: e.reps,
          descanso: e.descanso,
          // El generador ya devuelve el póster firmado: no hay que volver a
          // pedirlo. `?? null` para no dejarlo en «sin preguntar».
          poster: e.poster ?? null,
        })))
      })
      // Si el generador no responde, un título de reserva DESBLOQUEA la
      // apertura de la sesión. Sin esto, quien pulsara «Empezar ahora» sin
      // cobertura se quedaría mirando un indicador de carga para siempre.
      .catch(() => { if (vivo) setTituloGenerado('Entrenamiento libre') })
    return () => { vivo = false }
  }, [quick, huecos.length])

  // Los huecos salen de la rutina; en libre se van añadiendo.
  useEffect(() => {
    if (huecos.length > 0 || !rutina) return
    setHuecos(rutina.exercises.map((e, i) => ({
      orderIndex: i,
      // El slug ESTABA guardado en la rutina y se estaba tirando aquí. Sin él,
      // las series de un entrenamiento hecho desde una rutina entraban en el
      // historial por nombre y no por ejercicio del catálogo, así que no
      // casaban con las mismas hechas desde la biblioteca.
      slug: e.slug,
      muscle: e.muscle,
      nombre: e.name,
      seriesObjetivo: e.sets,
      repsObjetivo: e.reps,
      descanso: e.rest,
    })))
  }, [rutina, huecos.length])

  /**
   * Las imágenes que falten, de una tacada.
   *
   * Cubre los dos caminos que no las traen: una rutina guardada en el teléfono
   * —que solo tiene el slug— y una sesión recuperada del servidor a mitad de
   * entrenamiento. Los ejercicios escritos a mano no tienen slug y se quedan
   * fuera de la petición.
   *
   * Al responder marca TODOS los pedidos, encontrados o no: un ejercicio sin
   * imagen pasa de «sin preguntar» a `null` y deja de entrar en la lista, que
   * es lo que impide que esto se pida en bucle.
   */
  useEffect(() => {
    const faltan = huecos
      .filter(h => h.slug && h.poster === undefined)
      .map(h => h.slug as string)
    if (faltan.length === 0) return

    let vivo = true
    void getPosters(faltan).then(p => {
      if (!vivo) return
      setHuecos(prev => prev.map(h =>
        h.slug && h.poster === undefined ? { ...h, poster: p[h.slug] ?? null } : h))
    })
    return () => { vivo = false }
  }, [huecos])

  // Las series recuperadas del servidor traen huecos que aquí no existen (se
  // cerró la app en mitad de un entrenamiento libre). Se reconstruyen.
  useEffect(() => {
    if (series.length === 0) return
    setHuecos(previos => {
      const conocidos = new Set(previos.map(h => h.orderIndex))
      const nuevos = series
        .filter(s => !conocidos.has(s.orderIndex))
        .reduce<Hueco[]>((acc, s) => {
          if (acc.some(h => h.orderIndex === s.orderIndex)) return acc
          acc.push({
            orderIndex: s.orderIndex, slug: s.exerciseSlug, nombre: s.exerciseName,
            seriesObjetivo: 3, repsObjetivo: '—', descanso: 90,
          })
          return acc
        }, [])
      return nuevos.length ? [...previos, ...nuevos].sort((a, b) => a.orderIndex - b.orderIndex) : previos
    })
  }, [series])

  // El reloj de la cabecera. Un segundo: no hace falta más y no cuesta nada.
  useEffect(() => {
    const t = setInterval(() => setReloj(duracionSegundos()), 1000)
    return () => clearInterval(t)
  }, [duracionSegundos])

  const hueco = huecos[actual]

  // Lo que se hizo la última vez en este ejercicio. Se pide al ABRIRLO: es lo
  // que evita repetir el mismo peso durante meses sin darse cuenta.
  useEffect(() => {
    if (!hueco) { setUltimaVez(null); return }
    let vivo = true
    const clave = hueco.slug ?? hueco.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
    historialEjercicio(clave, 6)
      .then(r => { if (vivo) setUltimaVez(r) })
      .catch(() => { if (vivo) setUltimaVez(null) })
    return () => { vivo = false }
  }, [hueco?.orderIndex, hueco?.slug, hueco?.nombre])

  const seriesDelHueco = useMemo(
    () => series.filter(s => s.orderIndex === hueco?.orderIndex).sort((a, b) => a.setIndex - b.setIndex),
    [series, hueco?.orderIndex],
  )

  // El peso y las repeticiones se rellenan con lo último que se hizo: en la
  // inmensa mayoría de las series se repite lo mismo, y teclearlo cada vez es
  // el motivo por el que la gente deja de registrar a la tercera serie.
  useEffect(() => {
    const ultima = seriesDelHueco[seriesDelHueco.length - 1]
    if (ultima) {
      setPeso(ultima.weightKg != null ? String(ultima.weightKg) : '')
      setReps(ultima.reps != null ? String(ultima.reps) : '')
      setCarga(ultima.loadType)
    } else if (hueco?.pesoSugerido != null) {
      // Lo que propone el programa manda sobre «lo que hiciste la última vez»:
      // es que YA lo ha tenido en cuenta, y encima sabe si toca subir o si esta
      // semana es de descarga.
      setPeso(String(hueco.pesoSugerido))
      setReps(hueco.repsObjetivo.match(/\d+/)?.[0] ?? '')
      setCarga(hueco.cargaSugerida ?? 'weight')
    } else {
      const previa = ultimaVez?.sets?.[0]
      setPeso(previa?.weight_kg != null ? String(previa.weight_kg) : '')
      setReps(previa?.reps != null ? String(previa.reps) : (hueco?.repsObjetivo.match(/\d+/)?.[0] ?? ''))
      setCarga(hueco?.cargaSugerida ?? (modo === 'home' ? 'bodyweight' : 'weight'))
    }
    setRir(null)
    setTipo('normal')
  }, [hueco?.orderIndex, seriesDelHueco.length, ultimaVez, modo, hueco?.repsObjetivo])

  // ── Acciones ───────────────────────────────────────────────────────────────

  const registrar = useCallback(async () => {
    if (!hueco) return
    const r = num(reps)
    const p = num(peso)

    if (r === null || r <= 0) {
      Alert.alert('Faltan las repeticiones', 'Anota cuántas hiciste en esta serie.')
      return
    }
    if (carga === 'weight' && (p === null || p <= 0)) {
      Alert.alert('Falta el peso', 'Con carga, el peso hace falta. Si no llevabas, cambia a peso corporal.')
      return
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    await anotarSerie({
      exerciseSlug: hueco.slug,
      exerciseName: hueco.nombre,
      orderIndex: hueco.orderIndex,
      setIndex: seriesDelHueco.length,
      kind: tipo,
      loadType: carga,
      weightKg: carga === 'weight' || carga === 'assisted' ? p : null,
      reps: r,
      rir,
    })

    // El calentamiento no lleva descanso largo: se encadena.
    if (tipo !== 'warmup') empezarDescanso(hueco.descanso || 90)
    setRir(null)
  }, [hueco, reps, peso, carga, tipo, rir, seriesDelHueco.length, anotarSerie, empezarDescanso])

  const anadirHueco = (e: { slug?: string; nombre: string; muscle?: string | null; poster?: string | null }) => {
    const orderIndex = huecos.length === 0 ? 0 : Math.max(...huecos.map(h => h.orderIndex)) + 1
    setHuecos(h => [...h, {
      orderIndex, slug: e.slug, nombre: e.nombre, muscle: e.muscle,
      // Llega firmado del buscador: pedirlo otra vez sería un viaje de más.
      poster: e.poster ?? null,
      seriesObjetivo: 3, repsObjetivo: '8-12', descanso: 90,
    }])
    setActual(huecos.length)
    setBuscando(false)
  }

  const cerrar = async () => {
    const duracion = duracionSegundos()
    const totalSeries = series.length
    const volumen = series.reduce(
      (a, x) => a + (x.kind !== 'warmup' && x.loadType === 'weight' && x.weightKg && x.reps ? x.weightKg * x.reps : 0),
      0,
    )

    if (totalSeries === 0) {
      Alert.alert('Sin series registradas', 'No hay nada que guardar. ¿Descartar el entrenamiento?', [
        { text: 'Seguir entrenando', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: async () => { await descartar(); volverA('/(tabs)/workout')() } },
      ])
      return
    }

    // Se copian ANTES de cerrar: `terminar` limpia el store.
    const marcasDeLaSesion = [...marcas]
    const tituloDeLaSesion = sesion?.title ?? 'Entrenamiento'

    const guardada = await terminar()
    if (!guardada) {
      Alert.alert(
        'No se pudo guardar todavía',
        'Tus series están a salvo en el teléfono y se enviarán en cuanto vuelva la conexión. Puedes salir sin perder nada.',
      )
      return
    }

    /* Ya no basta con marcar el día: `registrarGesto` marca Y enciende la
       racha si es el primer gesto de hoy. Terminar una sesión es el momento
       más ganado de todos, así que si alguien llega aquí sin haber apuntado
       nada antes, es aquí donde toca celebrarlo. */
    void racha.registrarGesto('loggedWorkout')
    await addXP(25 + marcasDeLaSesion.length * 15)
    setTerminada({
      duracion, series: totalSeries, volumen,
      // Del servidor, que es quien lo estima con tu peso y el catálogo.
      kcal: guardada.calories_kcal,
      marcas: marcasDeLaSesion, titulo: tituloDeLaSesion,
    })
  }

  const salir = () => {
    Alert.alert('¿Salir del entrenamiento?', 'Lo registrado se queda guardado. Puedes volver y seguir donde lo dejaste.', [
      { text: 'Seguir', style: 'cancel' },
      { text: 'Salir', onPress: volverA('/(tabs)/workout') },
      {
        text: 'Descartar todo',
        style: 'destructive',
        onPress: async () => { await descartar(); volverA('/(tabs)/workout')() },
      },
    ])
  }

  // ── Pantallas ──────────────────────────────────────────────────────────────

  /**
   * El RESUMEN manda sobre todo lo demás, y por eso va el primero.
   *
   * Estaba por debajo de la pregunta del modo, y eso hacía desaparecer la
   * pantalla de felicitación entera: `terminar()` vacía el store —tiene que
   * hacerlo—, así que al cerrar un entrenamiento `sesion` pasa a null; si
   * además se había entrado sin parámetros en la dirección —que es justo lo que
   * hace «Seguir entrenando» desde la portada— se cumplía la condición de
   * «no hay nada que abrir» y la app preguntaba «¿cómo entrenas hoy?» a alguien
   * que acababa de terminar de entrenar. Las cifras, los récords recién batidos
   * y el resumen no se veían nunca por ese camino.
   */
  if (terminada) {
    return (
      <>
        <Resumen
          datos={terminada}
          marcas={terminada.marcas}
          titulo={terminada.titulo}
          modo={modo}
          posters={huecos.map(h => h.poster ?? null)}
        />
        {/* Encima del resumen: la racha es lo primero que hay que ver, y el
            resumen queda detrás esperando a que se cierre. */}
        <RachaEncendida
          visible={racha.visible}
          dias={racha.dias}
          semana={racha.semana}
          onCerrar={racha.cerrar}
        />
      </>
    )
  }

  if (!sesion && !rutina && !mode && !quick) return <ElegirModo onElegir={m => router.setParams({ mode: m })} />

  if (!sesion) {
    return (
      <SafeAreaView style={[s.contenedor, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.neon.red} />
      </SafeAreaView>
    )
  }

  const sinEnviar = pendientes()
  const pesoNum = num(peso) ?? 0

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={s.contenedor}>
        {/* ── Cabecera ─────────────────────────────────────────────────── */}
        <View style={s.cabecera}>
          <TouchableOpacity onPress={salir} hitSlop={10}>
            <Ionicons name="chevron-down" size={24} color={Colors.neon.w2} />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={s.tituloSesion} numberOfLines={1}>{sesion.title}</Text>
            <Text style={s.relojTxt}>
              {mmss(reloj)} · {series.length} {series.length === 1 ? 'serie' : 'series'}
              {sinEnviar > 0 ? ` · ${sinEnviar} sin enviar` : ''}
            </Text>
          </View>

          <TouchableOpacity onPress={cerrar} style={s.botonTerminar} hitSlop={8}>
            <Text style={s.botonTerminarTxt}>Terminar</Text>
          </TouchableOpacity>
        </View>

        {/* ── Tira de ejercicios ───────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.tira}
          contentContainerStyle={s.tiraContenido}
        >
          {huecos.map((h, i) => {
            const hechas = series.filter(x => x.orderIndex === h.orderIndex).length
            const activo = i === actual
            const completo = hechas >= h.seriesObjetivo
            return (
              <TouchableOpacity
                key={h.orderIndex}
                style={[s.tiraChip, activo && s.tiraChipOn]}
                onPress={() => { void Haptics.selectionAsync(); setActual(i) }}
                activeOpacity={0.85}
              >
                {/* La miniatura, que es lo que hace navegable la tira: con seis
                    ejercicios y nombres cortados a mitad, saber cuál era el
                    tercero obligaba a tocarlos uno a uno. */}
                <View>
                  <Miniatura poster={h.poster} tam={34} />
                  {completo && (
                    <View style={s.tiraHecho}>
                      <Ionicons name="checkmark" size={10} color={Colors.neon.void} />
                    </View>
                  )}
                </View>
                <View style={{ flexShrink: 1 }}>
                  <Text style={[s.tiraNombre, activo && s.tiraNombreOn]} numberOfLines={1}>
                    {h.nombre}
                  </Text>
                  <Text style={[s.tiraCuenta, activo && { color: Colors.neon.white }]}>
                    {hechas}/{h.seriesObjetivo}
                  </Text>
                </View>
              </TouchableOpacity>
            )
          })}

          <TouchableOpacity style={s.tiraAnadir} onPress={() => setBuscando(true)} activeOpacity={0.85}>
            <Ionicons name="add" size={18} color={Colors.neon.w2} />
          </TouchableOpacity>
        </ScrollView>

        {!hueco ? (
          <View style={s.vacioWrap}>
            <Ionicons name="barbell-outline" size={44} color={Colors.neon.w4} />
            <Text style={s.vacioTitulo}>Sin ejercicios todavía</Text>
            <Text style={s.vacioTxt}>Añade el primero y empieza a registrar series.</Text>
            <TouchableOpacity style={s.vacioBoton} onPress={() => setBuscando(true)}>
              <Text style={s.vacioBotonTxt}>Añadir ejercicio</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: Spacing[4], paddingBottom: descansoHasta ? 260 : 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Ejercicio ──────────────────────────────────────────── */}
            {/**
              * La ficha del ejercicio en curso.
              *
              * ── Por qué el póster NO va de fondo a pantalla completa ────────
              * Se probó y quedaba mal. Los pósters del catálogo son fichas
              * anatómicas sobre fondo CLARO, y estirado a 148 px de alto el
              * blanco gana al degradado: en una app negra sale una mancha
              * luminosa en mitad de la pantalla. Funcionan en pequeño, dentro
              * de un marco, que es como se usan en todas partes.
              *
              * Así que el fondo lo pone la fotografía del sitio donde se
              * entrena —ya viene oscurecida y con viñeta— y el póster va de
              * miniatura grande al lado. Se sigue viendo el movimiento y la
              * pieza pega con el resto de la sección.
              */}
            <View style={s.ficha}>
              <Image
                source={FOTOS[FOTO_MODO[modo] ?? 'gimnasio'].fuente}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={220}
              />
              <LinearGradient
                colors={['rgba(5,5,6,0.55)', 'rgba(5,5,6,0.88)']}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />

              <View style={s.fichaDentro}>
                <Miniatura poster={hueco.poster} tam={72} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.ejercicioNombre} numberOfLines={2}>{hueco.nombre}</Text>
                  <Text style={s.ejercicioSub}>
                    {hueco.seriesObjetivo} series objetivo · {hueco.repsObjetivo} reps
                  </Text>

                  {ultimaVez && ultimaVez.sets.length > 0 && (
                    <View style={s.ultimaVez}>
                      <Ionicons name="time-outline" size={13} color={Colors.neon.w2} />
                      <Text style={s.ultimaVezTxt} numberOfLines={1}>
                        La última vez: {ultimaVez.sets.slice(0, 3).map(x =>
                          x.weight_kg ? `${x.weight_kg}×${x.reps}` : `${x.reps} reps`,
                        ).join(' · ')}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* ── Series ya hechas ───────────────────────────────────── */}
            {seriesDelHueco.map((x, i) => (
              <FilaSerie key={x.clientId} serie={x} n={i + 1} onQuitar={() => quitarSerie(x.clientId)} />
            ))}

            {/* ── Registrar ──────────────────────────────────────────── */}
            <View style={s.formulario}>
              <View style={s.entradas}>
                {carga !== 'bodyweight' && carga !== 'none' && (
                  <Campo
                    etiqueta={carga === 'assisted' ? 'Ayuda (kg)' : 'Peso (kg)'}
                    valor={peso}
                    onCambiar={setPeso}
                    paso={2.5}
                  />
                )}
                <Campo etiqueta="Repeticiones" valor={reps} onCambiar={setReps} paso={1} entero />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsScroll} contentContainerStyle={s.chips}>
                {CARGAS.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[s.chip, carga === c.id && s.chipOn]}
                    onPress={() => setCarga(c.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.chipTxt, carga === c.id && s.chipTxtOn]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsScroll} contentContainerStyle={s.chips}>
                {TIPOS_SERIE.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[s.chip, tipo === t.id && s.chipOn, tipo === t.id && t.id === 'failure' && s.chipFallo]}
                    onPress={() => setTipo(t.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.chipTxt, tipo === t.id && s.chipTxtOn]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <EffortPicker valor={rir} onCambiar={setRir} />

              {/* La calculadora solo donde hay barra que cargar. */}
              {modo === 'gym' && carga === 'weight' && (
                <>
                  <TouchableOpacity
                    style={s.discosBoton}
                    onPress={() => setVerDiscos(v => !v)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="disc-outline" size={16} color={Colors.neon.w2} />
                    <Text style={s.discosBotonTxt}>
                      {verDiscos ? 'Ocultar discos' : 'Qué discos pongo'}
                    </Text>
                    {!verDiscos && pesoNum > 0 && (
                      <Text style={s.discosPista}>
                        {repartirDiscos(pesoNum, barraKg).kgPorLado} kg/lado
                      </Text>
                    )}
                    <Ionicons
                      name={verDiscos ? 'chevron-up' : 'chevron-down'}
                      size={15}
                      color={Colors.neon.w3}
                    />
                  </TouchableOpacity>

                  {verDiscos && (
                    <PlateCalculator
                      peso={pesoNum}
                      barraKg={barraKg}
                      onCambiarBarra={setBarraKg}
                      onAjustar={kg => setPeso(String(kg))}
                    />
                  )}
                </>
              )}

              <TouchableOpacity style={s.registrar} onPress={registrar} activeOpacity={0.88}>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={s.registrarTxt}>Registrar serie {seriesDelHueco.length + 1}</Text>
              </TouchableOpacity>
            </View>

            {actual + 1 < huecos.length && (
              <TouchableOpacity style={s.siguiente} onPress={() => setActual(a => a + 1)} activeOpacity={0.8}>
                <Miniatura poster={huecos[actual + 1].poster} tam={36} />
                <View style={{ flex: 1 }}>
                  <Text style={s.siguienteEtiqueta}>SIGUIENTE</Text>
                  <Text style={s.siguienteTxt} numberOfLines={1}>{huecos[actual + 1].nombre}</Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color={Colors.neon.w2} />
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        {/* ── Descanso ─────────────────────────────────────────────────── */}
        {descansoHasta && (
          <View style={s.descansoPanel}>
            <RestTimer
              hasta={descansoHasta}
              total={descansoTotal}
              onSaltar={pararDescanso}
              onSumar={sumarAlDescanso}
            />
          </View>
        )}

        <BuscadorEjercicio
          visible={buscando}
          modo={modo}
          onElegir={anadirHueco}
          onCerrar={() => setBuscando(false)}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  )
}

// ── Piezas ───────────────────────────────────────────────────────────────────

/**
 * Un número con dos botones.
 *
 * Los botones existen porque el teclado numérico tapa media pantalla y subir
 * 2,5 kg no merece abrirlo. El campo sigue ahí para el que prefiera teclear.
 */
function Campo({ etiqueta, valor, onCambiar, paso, entero }: {
  etiqueta: string
  valor: string
  onCambiar: (v: string) => void
  paso: number
  entero?: boolean
}) {
  const mover = (signo: 1 | -1) => {
    const v = (num(valor) ?? 0) + signo * paso
    if (v < 0) return
    void Haptics.selectionAsync()
    onCambiar(entero ? String(Math.round(v)) : String(Math.round(v * 100) / 100))
  }

  return (
    <View style={c.wrap}>
      <Text style={c.etiqueta}>{etiqueta.toUpperCase()}</Text>
      <View style={c.fila}>
        <TouchableOpacity style={c.boton} onPress={() => mover(-1)} activeOpacity={0.7}>
          <Ionicons name="remove" size={18} color={Colors.neon.w2} />
        </TouchableOpacity>
        <TextInput
          style={c.input}
          value={valor}
          onChangeText={onCambiar}
          keyboardType={entero ? 'number-pad' : 'decimal-pad'}
          placeholder="0"
          placeholderTextColor={Colors.neon.w4}
          selectTextOnFocus
        />
        <TouchableOpacity style={c.boton} onPress={() => mover(1)} activeOpacity={0.7}>
          <Ionicons name="add" size={18} color={Colors.neon.w2} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const c = StyleSheet.create({
  wrap: { flex: 1, gap: 6 },
  etiqueta: { fontSize: 10, fontWeight: '700', color: Colors.neon.w3, letterSpacing: 1.2 },
  fila: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  boton: { paddingHorizontal: Spacing[3], paddingVertical: Spacing[3] },
  input: {
    flex: 1, textAlign: 'center',
    fontSize: 24, fontWeight: '800', color: Colors.neon.white,
    paddingVertical: Spacing[2],
  },
})

function FilaSerie({ serie, n, onQuitar }: { serie: SerieLocal; n: number; onQuitar: () => void }) {
  const carga = serie.loadType === 'weight' && serie.weightKg
    ? `${serie.weightKg} kg × ${serie.reps}`
    : serie.loadType === 'assisted' && serie.weightKg
      ? `−${serie.weightKg} kg × ${serie.reps}`
      : `${serie.reps} reps`

  return (
    <View style={f.fila}>
      <View style={[f.n, serie.kind === 'warmup' && f.nCalent]}>
        <Text style={f.nTxt}>{serie.kind === 'warmup' ? 'C' : n}</Text>
      </View>

      <Text style={f.carga}>{carga}</Text>

      {serie.rir != null && <Text style={f.rir}>RIR {serie.rir}</Text>}
      {serie.est1RM ? <Text style={f.rm}>1RM ~{serie.est1RM}</Text> : null}

      {/* Un punto, no un cartel: que no haya cobertura no es un problema de
          quien entrena, y su serie ya está guardada. */}
      {serie.pendiente && <View style={f.pendiente} />}

      <TouchableOpacity onPress={onQuitar} hitSlop={10} style={{ paddingLeft: Spacing[2] }}>
        <Ionicons name="close" size={15} color={Colors.neon.w4} />
      </TouchableOpacity>
    </View>
  )
}

const f = StyleSheet.create({
  fila: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    paddingVertical: Spacing[2], paddingHorizontal: Spacing[3],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.neon.edge,
    marginBottom: 6,
  },
  n: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  nCalent: { backgroundColor: 'rgba(255,255,255,0.05)' },
  nTxt: { fontSize: 11, fontWeight: '800', color: Colors.neon.w2 },
  carga: { flex: 1, fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  rir: { fontSize: 10, fontWeight: '700', color: Colors.neon.w3 },
  rm: { fontSize: 10, fontWeight: '700', color: Colors.neon.w2 },
  pendiente: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.neon.red },
})

/**
 * Lo que se hizo, al terminar.
 *
 * ── Es el momento con más carga de toda la app ──────────────────────────────
 * Alguien acaba de terminar de entrenar y esta es la pantalla que se lo
 * reconoce. Antes era un tic gris y tres cajas: la misma información con la
 * temperatura de un recibo. Ahora las cifras van sobre la fotografía del sitio
 * donde se entrenó, con los kilos en grande, porque es el número que la gente
 * mira.
 *
 * ── `marcas` lleva valor por defecto ────────────────────────────────────────
 * Es una lista opcional y una pantalla de felicitación no puede reventar por no
 * haber batido ningún récord. Sin el defecto, cualquier camino que no la pasara
 * —un estado recuperado, una versión anterior de la app— tiraba la pantalla
 * entera con «Cannot read property 'length' of undefined».
 */
function Resumen({ datos, marcas = [], titulo, modo, posters = [] }: {
  datos: { duracion: number; series: number; volumen: number; kcal?: number | null }
  marcas?: { metric: string; value: number; previous: number | null; exerciseName: string }[]
  titulo: string
  modo: Modo
  posters?: (string | null)[]
}) {
  const NOMBRE_METRICA: Record<string, string> = {
    est_1rm: '1RM estimado',
    max_weight: 'peso máximo',
    max_reps: 'repeticiones',
    max_duration: 'tiempo',
    max_distance: 'distancia',
  }

  const conImagen = posters.filter((p): p is string => !!p)

  return (
    <SafeAreaView style={s.contenedor}>
      <ScrollView contentContainerStyle={r.scroll} showsVerticalScrollIndicator={false}>
        <View style={r.hero}>
          <Image
            source={FOTOS[FOTO_MODO[modo] ?? 'gimnasio'].fuente}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={320}
          />
          <LinearGradient
            colors={['rgba(5,5,6,0.25)', 'rgba(5,5,6,0.78)', 'rgba(5,5,6,0.98)']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <View style={r.heroDentro}>
            <View style={r.sello}>
              <Ionicons name="checkmark" size={12} color={Colors.neon.void} />
              <Text style={r.selloTxt}>GUARDADO</Text>
            </View>

            <View>
              {/* Los kilos en grande cuando los hay; si no, las series. En un
                  entrenamiento de peso corporal el volumen es cero, y presidir
                  la pantalla con un cero después de cuarenta minutos de fondos
                  es exactamente el mensaje contrario al que toca. */}
              {datos.volumen > 0 ? (
                <Text style={r.cifra}>
                  {Math.round(datos.volumen).toLocaleString('es-ES')}
                  <Text style={r.cifraUnidad}> kg</Text>
                </Text>
              ) : (
                <Text style={r.cifra}>
                  {datos.series}
                  <Text style={r.cifraUnidad}> {datos.series === 1 ? 'serie' : 'series'}</Text>
                </Text>
              )}
              <Text style={r.heroTitulo} numberOfLines={2}>{titulo}</Text>
              {/* Las series solo si arriba mandan los kilos. Con peso corporal
                  la cifra grande YA son las series, y repetirlas aquí deja un
                  «1 serie / 4:38 entrenando · 1 serie» que parece un error. */}
              <Text style={r.heroPie}>
                {mmss(datos.duracion)} entrenando
                {datos.volumen > 0
                  ? ` · ${datos.series} ${datos.series === 1 ? 'serie' : 'series'}`
                  : ''}
                {/* El gasto lo calcula el SERVIDOR al cerrar y llega en la
                    sesión guardada; aquí no se estima nada. Si no viene —perfil
                    sin peso, o sesión demasiado corta— no se pinta: es el mismo
                    criterio que con el volumen, un cero diría lo que no es. */}
                {datos.kcal ? ` · ${datos.kcal} kcal` : ''}
              </Text>
            </View>
          </View>
        </View>

        <View style={r.cuerpo}>
          {conImagen.length > 0 && (
            <View style={r.tira}>
              {conImagen.slice(0, 6).map((p, i) => (
                <Miniatura key={i} poster={p} tam={46} />
              ))}
            </View>
          )}

          {marcas.length > 0 && (
            <View style={r.marcas}>
              <Text style={r.marcasTitulo}>
                {marcas.length === 1 ? 'UN RÉCORD NUEVO' : `${marcas.length} RÉCORDS NUEVOS`}
              </Text>
              {marcas.map((m, i) => (
                <View key={i} style={r.marca}>
                  <Ionicons name="trophy" size={16} color={Colors.neon.red} />
                  <Text style={r.marcaTxt}>
                    {m.exerciseName} · {NOMBRE_METRICA[m.metric] ?? m.metric} {m.value}
                    {m.previous ? ` (antes ${m.previous})` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={r.boton} onPress={() => router.replace(modo === 'home' ? '/workout/casa' : '/workout/gym')} activeOpacity={0.88}>
            <Text style={r.botonTxt}>Volver a Entrena</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={r.secundario}
            onPress={() => router.replace(`/workout/history?mode=${modo}`)}
            activeOpacity={0.8}
          >
            <Text style={r.secundarioTxt}>Ver el historial</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const r = StyleSheet.create({
  scroll: { paddingBottom: Spacing[6] },

  hero: { height: 380, justifyContent: 'flex-end', backgroundColor: Colors.neon.void },
  heroDentro: { padding: Spacing[5], gap: Spacing[5], justifyContent: 'space-between', flex: 1 },
  sello: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingHorizontal: Spacing[3], paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  selloTxt: { fontSize: 9, fontWeight: '800', color: Colors.neon.void, letterSpacing: 1.2 },
  cifra: { fontSize: 58, fontWeight: '800', color: Colors.neon.white, letterSpacing: -2.4, lineHeight: 62 },
  cifraUnidad: { fontSize: 22, fontWeight: '700', color: Colors.neon.w2, letterSpacing: 0 },
  heroTitulo: { fontSize: Typography.fontSize.lg, fontWeight: '800', color: Colors.neon.white, marginTop: 2 },
  heroPie: { fontSize: 12, color: Colors.neon.w2, marginTop: 4 },

  cuerpo: { padding: Spacing[4], gap: Spacing[4] },
  tira: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },

  marcas: {
    gap: Spacing[2],
    backgroundColor: Colors.neon.redDim,
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.3)',
    borderRadius: BorderRadius.lg, padding: Spacing[4],
  },
  marcasTitulo: { fontSize: 10, fontWeight: '800', color: Colors.neon.redCore, letterSpacing: 1.3 },
  marca: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  marcaTxt: { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.neon.white },

  boton: {
    alignItems: 'center',
    backgroundColor: Colors.neon.red,
    borderRadius: BorderRadius.lg, padding: Spacing[4],
  },
  botonTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
  secundario: { alignItems: 'center', paddingVertical: Spacing[2] },
  secundarioTxt: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.w2 },
})

const b = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.neon.void },
  cabecera: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing[4], borderBottomWidth: 1, borderBottomColor: Colors.neon.edge,
  },
  titulo: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white },
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    margin: Spacing[4], paddingHorizontal: Spacing[3],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  input: { flex: 1, paddingVertical: Spacing[3], fontSize: Typography.fontSize.base, color: Colors.neon.white },
  libre: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    padding: Spacing[3], marginBottom: Spacing[3],
    backgroundColor: Colors.neon.redDim,
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.3)',
    borderRadius: BorderRadius.md,
  },
  libreTxt: { fontSize: Typography.fontSize.sm, color: Colors.neon.redCore, fontWeight: '700' },
  fila: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingVertical: Spacing[3], paddingHorizontal: Spacing[3],
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  filaNombre: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  filaSub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },
  vacio: { fontSize: Typography.fontSize.sm, color: Colors.neon.w3, textAlign: 'center', marginTop: Spacing[6] },
})

const s = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.neon.void },

  cabecera: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[3],
    borderBottomWidth: 1, borderBottomColor: Colors.neon.edge,
  },
  tituloSesion: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white },
  relojTxt: { fontSize: 11, color: Colors.neon.w3, marginTop: 2 },
  botonTerminar: {
    paddingHorizontal: Spacing[3], paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.neon.redDim,
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.35)',
  },
  botonTerminarTxt: { fontSize: 12, fontWeight: '800', color: Colors.neon.redCore },

  // El ScrollView horizontal lleva flexGrow:0 o crece dentro de la columna y
  // aplasta a sus hijos hasta dejarlos sin texto.
  // Las DOS propiedades: `flexGrow:0` impide que crezca y aplaste a sus hijos,
  // `flexShrink:0` impide que el contenido de debajo la comprima y corte las
  // pastillas por la mitad. Es el mismo tropiezo que el menú de la sección.
  tira: { flexGrow: 0, flexShrink: 0, borderBottomWidth: 1, borderBottomColor: Colors.neon.edge },
  tiraContenido: { paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], gap: Spacing[2], alignItems: 'center' },
  tiraChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    maxWidth: 190,
    paddingHorizontal: Spacing[2], paddingVertical: Spacing[2],
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.neon.pane,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  tiraChipOn: { borderColor: Colors.neon.red, backgroundColor: Colors.neon.redDim },
  tiraNombre: { fontSize: 12, fontWeight: '700', color: Colors.neon.w2 },
  tiraNombreOn: { color: Colors.neon.white },
  tiraCuenta: { fontSize: 10, fontWeight: '700', color: Colors.neon.w3, marginTop: 1 },
  /** El tic de «ya está», sobre la esquina de la miniatura. */
  tiraHecho: {
    position: 'absolute', right: -4, bottom: -4,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.neon.white,
    borderWidth: 1.5, borderColor: Colors.neon.void,
  },
  tiraAnadir: {
    width: 38, height: 38, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.neon.edge,
    backgroundColor: Colors.neon.pane,
  },

  /**
   * Alto por el CONTENIDO, no fijo.
   *
   * Un nombre como «Press de banca alto inclinado con barra» ocupa dos líneas y
   * con altura fija se comía la línea de «la última vez», que es el dato por el
   * que existe esta pieza. La miniatura de 72 px marca el mínimo.
   */
  ficha: {
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.neon.edge,
    backgroundColor: Colors.neon.void,
    marginBottom: Spacing[3],
  },
  fichaDentro: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[3] + 2,
  },
  ejercicioNombre: { fontSize: 19, fontWeight: '800', color: Colors.neon.white, letterSpacing: -0.4, lineHeight: 23 },
  ejercicioSub: { fontSize: Typography.fontSize.sm, color: Colors.neon.w2 },
  ultimaVez: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 5, paddingHorizontal: Spacing[2] + 2,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    marginTop: 6,
  },
  ultimaVezTxt: { flexShrink: 1, fontSize: 11, fontWeight: '600', color: Colors.neon.white },

  formulario: { gap: Spacing[3], marginTop: Spacing[3] },
  entradas: { flexDirection: 'row', gap: Spacing[3] },
  chipsScroll: { flexGrow: 0 },
  chips: { flexDirection: 'row', gap: Spacing[2], alignItems: 'center' },
  chip: {
    paddingHorizontal: Spacing[3], paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.neon.edge,
    backgroundColor: Colors.neon.pane,
  },
  chipOn: { borderColor: 'rgba(255,255,255,0.5)', backgroundColor: Colors.neon.paneHi },
  chipFallo: { borderColor: Colors.neon.red, backgroundColor: Colors.neon.redDim },
  chipTxt: { fontSize: 11, fontWeight: '700', color: Colors.neon.w2 },
  chipTxtOn: { color: Colors.neon.white },

  discosBoton: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    paddingVertical: Spacing[3], paddingHorizontal: Spacing[3],
    borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.neon.edge,
    backgroundColor: Colors.neon.pane,
  },
  discosBotonTxt: { flex: 1, fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.w2 },
  discosPista: { fontSize: 11, fontWeight: '700', color: Colors.neon.w3 },

  registrar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[2],
    backgroundColor: Colors.neon.red,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing[4],
  },
  registrarTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },

  siguiente: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    marginTop: Spacing[5], padding: Spacing[3],
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
    backgroundColor: Colors.neon.pane,
  },
  siguienteEtiqueta: { fontSize: 9, fontWeight: '800', color: Colors.neon.w3, letterSpacing: 1.2 },
  siguienteTxt: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white, marginTop: 1 },

  descansoPanel: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingTop: Spacing[5], paddingBottom: Spacing[6],
    backgroundColor: 'rgba(5,5,6,0.97)',
    borderTopWidth: 1, borderTopColor: Colors.neon.edge,
  },

  vacioWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing[3], padding: Spacing[6] },
  vacioTitulo: { fontSize: Typography.fontSize.lg, fontWeight: '800', color: Colors.neon.white },
  vacioTxt: { fontSize: Typography.fontSize.sm, color: Colors.neon.w3, textAlign: 'center' },
  vacioBoton: {
    paddingHorizontal: Spacing[5], paddingVertical: Spacing[3],
    borderRadius: BorderRadius.full, backgroundColor: Colors.neon.red, marginTop: Spacing[2],
  },
  vacioBotonTxt: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: '#fff' },

  modoWrap: { flex: 1, justifyContent: 'center', padding: Spacing[6], gap: Spacing[3] },
  modoTitulo: { fontSize: 26, fontWeight: '800', color: Colors.neon.white, letterSpacing: -0.5 },
  modoSub: { fontSize: Typography.fontSize.sm, color: Colors.neon.w3, lineHeight: 20, marginBottom: Spacing[3] },
  modoRejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  modoCelda: {
    width: '47%', aspectRatio: 1.35,
    alignItems: 'center', justifyContent: 'center', gap: Spacing[2],
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
    backgroundColor: Colors.neon.pane,
  },
  modoCeldaPronto: { opacity: 0.45 },
  modoLabel: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  modoPronto: { fontSize: 9, fontWeight: '700', color: Colors.neon.w3, letterSpacing: 1 },
  modoVolver: { alignItems: 'center', paddingVertical: Spacing[4], marginTop: Spacing[3] },
  modoVolverTxt: { fontSize: Typography.fontSize.sm, color: Colors.neon.w2, fontWeight: '700' },
})
