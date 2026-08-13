/**
 * RUTINAS
 * ───────
 * Sesiones guardadas para repetir. El PLAN, no lo realizado: lo realizado vive
 * en el historial y casi nunca coincide, que es lo interesante.
 *
 * ── Rehecha con el sistema de la sección ────────────────────────────────────
 * · La rutina que más se usa manda: ocupa una pieza entera sobre fotografía con
 *   su botón de empezar. Antes todas las rutinas eran tarjetas iguales y elegir
 *   entre cinco cajas idénticas cuesta más que entre una grande y cuatro
 *   pequeñas, aunque haya la misma información.
 * · Los ejercicios se enseñan con su IMAGEN, no con una lista de texto ni con
 *   un punto de color. Una rutina se reconoce por lo que hay dentro.
 * · La fotografía sale del sitio donde se entrena, que es lo que de verdad
 *   distingue una rutina de otra al ojearlas.
 *
 * ── Lo que ya cambió antes y sigue igual ────────────────────────────────────
 * · Los ejercicios se eligen del CATÁLOGO de 206, con su músculo, su material y
 *   su vídeo. Antes se elegían de una lista de doce nombres escritos a mano en
 *   el código, que no llevaban a ninguna ficha y envejecían solas.
 * · Al guardar un ejercicio se guarda su SLUG, no solo su nombre. Es lo que
 *   hace que al entrenarlo las series entren en el historial de ese ejercicio
 *   y no en el de un nombre parecido.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, FlatList,
} from 'react-native'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { CabeceraSeccion } from '@/components/workout/MenuSeccion'
import { Vacio } from '@/components/workout/Charts'
import { MaterialIcon } from '@/components/workout/Kit'
import { Miniatura, MazoMiniaturas } from '@/components/workout/Miniatura'
import { NOMBRE_GRUPO } from '@/components/workout/anatomy'
import { useWorkoutStore, Routine, Exercise } from '@/store/workoutStore'
import { listExercises, getPosters, ExerciseCard } from '@/services/exerciseService'
import { FOTOS, FOTO_MODO } from '@/constants/imagenes'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

/**
 * Los tipos de entrenamiento.
 *
 * Cuatro, no diez. Los diez de antes —hyrox, crossfit, natación, artes
 * marciales…— no cambiaban NADA en la app: eran una etiqueta y un emoji. Estos
 * cuatro son los que de verdad cambian qué se te enseña al entrenar, y coinciden
 * con los cuatro modos de sesión, que es lo que evita tener dos taxonomías
 * distintas para la misma cosa.
 */
const TIPOS = [
  { id: 'gym', label: 'Gimnasio', icono: 'barbell' },
  { id: 'home', label: 'En casa', icono: 'bodyweight' },
  { id: 'outdoor', label: 'Aire libre', icono: 'kettlebell' },
  { id: 'class', label: 'Dirigido', icono: 'bench' },
] as const

const NOMBRE_TIPO: Record<string, string> = {
  gym: 'Gimnasio', home: 'En casa', outdoor: 'Aire libre', class: 'Dirigido',
}

const fotoDeTipo = (tipo: string) => FOTOS[FOTO_MODO[tipo] ?? 'gimnasio'].fuente

/** A dónde va el botón de empezar. Los dos modos construidos son estos. */
const modoDe = (tipo: string) => tipo === 'home' ? 'home' : 'gym'

// ── Buscador del catálogo ────────────────────────────────────────────────────

function Buscador({ visible, tipo, onElegir, onCerrar }: {
  visible: boolean
  tipo: string
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
    // Se espera a que pare de teclear: sin esto se pide una vez por letra.
    const t = setTimeout(() => {
      listExercises({ q, place: tipo === 'home' ? 'home' : undefined, limit: 40 })
        .then(r => { if (vivo) setLista(r.exercises) })
        .catch(() => { if (vivo) setLista([]) })
        .finally(() => { if (vivo) setCargando(false) })
    }, 280)
    return () => { vivo = false; clearTimeout(t) }
  }, [q, visible, tipo])

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
            style={b.input} value={q} onChangeText={setQ}
            placeholder="Buscar en los 206 ejercicios…"
            placeholderTextColor={Colors.neon.w3} autoCorrect={false}
          />
          {cargando && <ActivityIndicator size="small" color={Colors.neon.w3} />}
        </View>

        <FlatList
          data={lista}
          keyExtractor={e => e.slug}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: Spacing[4], paddingBottom: 40 }}
          ListHeaderComponent={
            q.trim().length > 1 ? (
              <TouchableOpacity style={b.libre} onPress={() => { onElegir({ nombre: q.trim() }); setQ('') }} activeOpacity={0.85}>
                <Ionicons name="create-outline" size={16} color={Colors.neon.red} />
                <Text style={b.libreTxt}>Usar «{q.trim()}» tal cual</Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            !cargando ? <Text style={b.vacio}>Nada con ese nombre en la biblioteca.</Text> : null
          }
          renderItem={({ item: e }) => (
            <TouchableOpacity
              style={b.fila}
              onPress={() => {
                void Haptics.selectionAsync()
                onElegir({ slug: e.slug, nombre: e.name, muscle: e.muscle, poster: e.poster })
                setQ('')
              }}
              activeOpacity={0.85}
            >
              {/* La imagen del ejercicio, no un punto de color: quien busca
                  «press» ve cuál es cuál sin leer las cuatro variantes. */}
              <Miniatura poster={e.poster} tam={44} />
              <View style={{ flex: 1 }}>
                <Text style={b.filaNombre}>{e.name}</Text>
                <Text style={b.filaSub}>{e.muscleEs ?? '—'} · {e.equipmentEs}</Text>
              </View>
              <MaterialIcon id={e.equipment} size={18} color={Colors.neon.w3} />
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    </Modal>
  )
}

// ── Editor ───────────────────────────────────────────────────────────────────

function Editor({ visible, inicial, posters, onGuardar, onCerrar }: {
  visible: boolean
  inicial: Routine | null
  posters: Record<string, string>
  onGuardar: (r: Routine) => void
  onCerrar: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<string>('gym')
  const [ejercicios, setEjercicios] = useState<Exercise[]>([])
  const [buscando, setBuscando] = useState(false)

  /**
   * Las imágenes de lo que se acaba de añadir, solo mientras dura la edición.
   *
   * Los pósters que llegan del padre son de las rutinas YA GUARDADAS, así que
   * un ejercicio recién elegido salía con el hueco vacío hasta guardar y volver
   * a entrar — justo mientras se está montando la rutina, que es cuando más
   * falta hace verlo.
   *
   * El buscador ya trae la URL firmada, así que se guarda aquí y se acabó. En
   * memoria y NO en el disco con la rutina: caducan en una hora, y una URL
   * rescatada al día siguiente sería una imagen rota guardada para siempre.
   */
  const [postersNuevos, setPostersNuevos] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!visible) return
    setNombre(inicial?.name ?? '')
    setTipo(inicial?.trainingType ?? 'gym')
    setEjercicios(inicial?.exercises ?? [])
    setPostersNuevos({})
  }, [visible, inicial])

  const anadir = (e: { slug?: string; nombre: string; muscle?: string | null; poster?: string | null }) => {
    setEjercicios(prev => [...prev, {
      id: `${Date.now()}-${prev.length}`,
      slug: e.slug,
      muscle: e.muscle ?? undefined,
      name: e.nombre,
      sets: 3, reps: '8-12', weight: '', rest: 90,
    }])
    if (e.slug && e.poster) {
      const { slug, poster } = e as { slug: string; poster: string }
      setPostersNuevos(p => ({ ...p, [slug]: poster }))
    }
    setBuscando(false)
  }

  const cambiar = (id: string, campo: keyof Exercise, valor: string) => {
    setEjercicios(prev => prev.map(x => x.id === id
      ? { ...x, [campo]: campo === 'sets' || campo === 'rest' ? (parseInt(valor) || 0) : valor }
      : x))
  }

  const guardar = () => {
    if (!nombre.trim()) { Alert.alert('Falta el nombre', 'Ponle un nombre a la rutina para reconocerla luego.'); return }
    if (ejercicios.length === 0) { Alert.alert('Sin ejercicios', 'Añade al menos uno.'); return }
    onGuardar({
      id: inicial?.id ?? Date.now().toString(),
      name: nombre.trim(),
      trainingType: tipo,
      exercises: ejercicios,
      estimatedMinutes: Math.max(15, ejercicios.reduce((a, e) => a + e.sets * ((e.rest + 45) / 60), 0)),
      createdAt: inicial?.createdAt ?? Date.now(),
    })
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onCerrar}>
      {/**
        * El `SafeAreaProvider` va DENTRO del modal, y hace falta.
        *
        * Un `Modal` a pantalla completa monta su propia ventana, fuera del
        * árbol de la app, así que el `SafeAreaView` de dentro no encontraba
        * proveedor y sus márgenes salían a cero: «Cancelar» y «Guardar»
        * aparecían pisados por el reloj y la batería del iPhone, sin forma de
        * tocarlos bien. El proveedor mide esta ventana y los devuelve.
        */}
      <SafeAreaProvider>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={ed.wrap}>
          <View style={ed.cabecera}>
            <TouchableOpacity onPress={onCerrar} hitSlop={10}><Text style={ed.cancelar}>Cancelar</Text></TouchableOpacity>
            <Text style={ed.titulo}>{inicial ? 'Editar rutina' : 'Nueva rutina'}</Text>
            <TouchableOpacity onPress={guardar} hitSlop={10}><Text style={ed.guardar}>Guardar</Text></TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: Spacing[4], paddingBottom: 60, gap: Spacing[5] }}>
            <View style={{ gap: Spacing[2] }}>
              <Text style={ed.etiqueta}>NOMBRE</Text>
              <TextInput
                style={ed.input} value={nombre} onChangeText={setNombre}
                placeholder="Empuje A · Pecho y tríceps"
                placeholderTextColor={Colors.neon.w3}
              />
            </View>

            <View style={{ gap: Spacing[2] }}>
              <Text style={ed.etiqueta}>DÓNDE</Text>
              <View style={ed.tipos}>
                {TIPOS.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[ed.tipo, tipo === t.id && ed.tipoOn]}
                    onPress={() => { void Haptics.selectionAsync(); setTipo(t.id) }}
                    activeOpacity={0.85}
                  >
                    <MaterialIcon id={t.icono} size={20}
                      color={tipo === t.id ? Colors.neon.white : Colors.neon.w3} />
                    <Text style={[ed.tipoTxt, tipo === t.id && { color: Colors.neon.white }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ gap: Spacing[2] }}>
              <View style={ed.filaTitulo}>
                <Text style={ed.etiqueta}>EJERCICIOS ({ejercicios.length})</Text>
                <TouchableOpacity onPress={() => setBuscando(true)} hitSlop={8}>
                  <Text style={ed.anadir}>+ Añadir</Text>
                </TouchableOpacity>
              </View>

              {ejercicios.length === 0 ? (
                <TouchableOpacity onPress={() => setBuscando(true)} activeOpacity={0.85}>
                  <Vacio texto="Toca «Añadir» y busca en la biblioteca de 206 ejercicios." />
                </TouchableOpacity>
              ) : (
                ejercicios.map((e, i) => (
                  <View key={e.id} style={ed.ejercicio}>
                    <View style={ed.ejercicioCabecera}>
                      <Text style={ed.ejercicioNum}>{i + 1}</Text>
                      <Miniatura
                        poster={e.slug ? posters[e.slug] ?? postersNuevos[e.slug] : null}
                        tam={40}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={ed.ejercicioNombre} numberOfLines={1}>{e.name}</Text>
                        {e.muscle ? <Text style={ed.ejercicioSub}>{NOMBRE_GRUPO[e.muscle] ?? e.muscle}</Text> : null}
                      </View>
                      <TouchableOpacity onPress={() => setEjercicios(p => p.filter(x => x.id !== e.id))} hitSlop={10}>
                        <Ionicons name="close" size={17} color={Colors.neon.w4} />
                      </TouchableOpacity>
                    </View>

                    <View style={ed.campos}>
                      <Campo label="Series" valor={String(e.sets)} onCambiar={v => cambiar(e.id, 'sets', v)} numerico />
                      <Campo label="Reps" valor={e.reps} onCambiar={v => cambiar(e.id, 'reps', v)} />
                      <Campo label="Descanso" valor={String(e.rest)} onCambiar={v => cambiar(e.id, 'rest', v)} numerico sufijo="s" />
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>

            <Buscador visible={buscando} tipo={tipo} onElegir={anadir} onCerrar={() => setBuscando(false)} />
          </SafeAreaView>
        </KeyboardAvoidingView>
      </SafeAreaProvider>
    </Modal>
  )
}

function Campo({ label, valor, onCambiar, numerico, sufijo }: {
  label: string; valor: string; onCambiar: (v: string) => void; numerico?: boolean; sufijo?: string
}) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={ed.campoLabel}>{label.toUpperCase()}</Text>
      <View style={ed.campoCaja}>
        <TextInput
          style={ed.campoInput} value={valor} onChangeText={onCambiar}
          keyboardType={numerico ? 'number-pad' : 'default'}
          selectTextOnFocus
        />
        {sufijo ? <Text style={ed.campoSufijo}>{sufijo}</Text> : null}
      </View>
    </View>
  )
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

export default function Rutinas() {
  const { routines, loadAll, saveRoutine, deleteRoutine } = useWorkoutStore()
  const [editor, setEditor] = useState(false)
  const [editando, setEditando] = useState<Routine | null>(null)
  const [posters, setPosters] = useState<Record<string, string>>({})

  useEffect(() => { void loadAll() }, [loadAll])

  /**
   * Las imágenes de todos los ejercicios de todas las rutinas, de una vez.
   *
   * Las rutinas viven en el TELÉFONO y solo guardan el slug, así que la foto
   * hay que pedirla. Una petición para todas y no una por tarjeta: con seis
   * rutinas de seis ejercicios serían treinta y seis peticiones para pintar una
   * sola pantalla.
   *
   * Depende de los slugs y no de `routines`: el objeto de las rutinas cambia de
   * identidad al guardar cualquier cosa —hasta el nombre— y esto volvería a
   * pedir las mismas imágenes cada vez.
   */
  const slugs = useMemo(
    () => routines.flatMap(r => r.exercises.map(e => e.slug).filter((x): x is string => !!x)),
    [routines],
  )
  const clave = slugs.join(',')

  useEffect(() => {
    if (!clave) { setPosters({}); return }
    let vivo = true
    getPosters(clave.split(','))
      .then(p => { if (vivo) setPosters(p) })
      .catch(() => {})
    return () => { vivo = false }
  }, [clave])

  const guardar = useCallback(async (r: Routine) => {
    await saveRoutine(r)
    setEditor(false)
    setEditando(null)
  }, [saveRoutine])

  const borrar = (r: Routine) => {
    Alert.alert('¿Borrar la rutina?', `«${r.name}» se borra del teléfono. Los entrenamientos que hiciste con ella se quedan en tu historial.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => void deleteRoutine(r.id) },
    ])
  }

  const empezar = (r: Routine) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    router.push(`/workout/active?routineId=${r.id}&mode=${modoDe(r.trainingType)}`)
  }

  /**
   * La más reciente va de portada.
   *
   * La última que se creó es casi siempre la que se está usando: quien acaba de
   * montar «Empuje B» va a entrenarla, no a mirar la de hace tres meses.
   */
  const ordenadas = useMemo(
    () => [...routines].sort((a, b) => b.createdAt - a.createdAt),
    [routines],
  )
  const [destacada, ...resto] = ordenadas

  const postersDe = (r: Routine) =>
    r.exercises.map(e => (e.slug ? posters[e.slug] ?? null : null))

  return (
    <Screen>
      <CabeceraSeccion
        titulo="Mis rutinas"
        subtitulo={routines.length > 0
          ? `${routines.length} ${routines.length === 1 ? 'guardada' : 'guardadas'}`
          : 'Sesiones que repites'}
        derecha={
          <TouchableOpacity
            style={s.nueva}
            onPress={() => { setEditando(null); setEditor(true) }}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing[4], paddingBottom: 110, gap: Spacing[3] }}
      >
        {!destacada ? (
          <Vacio texto="Sin rutinas todavía. Una rutina es una sesión que repites: la guardas una vez y la empiezas de un toque. No hace falta para entrenar — también puedes ir sobre la marcha." />
        ) : (
          <>
            <Portada
              rutina={destacada}
              posters={postersDe(destacada)}
              onEmpezar={() => empezar(destacada)}
              onEditar={() => { setEditando(destacada); setEditor(true) }}
              onBorrar={() => borrar(destacada)}
            />

            {resto.length > 0 && <Text style={s.seccion}>LAS DEMÁS</Text>}

            {resto.map((r, i) => (
              <Animated.View key={r.id} entering={FadeInDown.delay(Math.min(80 + i * 50, 380)).duration(340)}>
                <Tarjeta
                  rutina={r}
                  posters={postersDe(r)}
                  onEmpezar={() => empezar(r)}
                  onEditar={() => { setEditando(r); setEditor(true) }}
                  onBorrar={() => borrar(r)}
                />
              </Animated.View>
            ))}
          </>
        )}
      </ScrollView>

      <Editor
        visible={editor}
        inicial={editando}
        posters={posters}
        onGuardar={guardar}
        onCerrar={() => { setEditor(false); setEditando(null) }}
      />
    </Screen>
  )
}

/**
 * La rutina destacada, sobre su fotografía.
 *
 * Lleva los tres primeros ejercicios con su imagen y su prescripción, que es lo
 * que de verdad se quiere saber antes de pulsar «Empezar»: si hoy toca lo que
 * uno tenía pensado. Un título y un número de ejercicios no lo contestan.
 */
function Portada({ rutina, posters, onEmpezar, onEditar, onBorrar }: {
  rutina: Routine
  posters: (string | null)[]
  onEmpezar: () => void
  onEditar: () => void
  onBorrar: () => void
}) {
  const series = rutina.exercises.reduce((a, e) => a + e.sets, 0)

  return (
    <Animated.View entering={FadeIn.duration(420)} style={s.portada}>
      <Image
        source={fotoDeTipo(rutina.trainingType)}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={300}
      />
      <LinearGradient
        colors={['rgba(5,5,6,0.30)', 'rgba(5,5,6,0.80)', 'rgba(5,5,6,0.98)']}
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={s.portadaDentro}>
        <View style={s.portadaArriba}>
          <View style={s.etiqueta}>
            <Text style={s.etiquetaTxt}>LA MÁS RECIENTE</Text>
          </View>
          {/* Editar Y BORRAR. Con solo editar, quien tuviera una única rutina
              no tenía forma de quitarla: la papelera vive en las tarjetas de
              abajo y con una sola rutina no hay tarjetas de abajo. */}
          <View style={s.accionesPortada}>
            <TouchableOpacity onPress={onEditar} hitSlop={10} style={s.accionPortada}>
              <Ionicons name="create-outline" size={17} color={Colors.neon.white} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onBorrar} hitSlop={10} style={s.accionPortada}>
              <Ionicons name="trash-outline" size={16} color={Colors.neon.white} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ gap: Spacing[3] }}>
          <View>
            <Text style={s.portadaTitulo} numberOfLines={2}>{rutina.name}</Text>
            <Text style={s.portadaSub}>
              {NOMBRE_TIPO[rutina.trainingType] ?? rutina.trainingType}
              {' · '}{rutina.exercises.length} {rutina.exercises.length === 1 ? 'ejercicio' : 'ejercicios'}
              {' · '}{series} series
              {' · ~'}{Math.round(rutina.estimatedMinutes)} min
            </Text>
          </View>

          <View style={s.portadaLista}>
            {rutina.exercises.slice(0, 3).map((e, i) => (
              <View key={e.id} style={s.portadaFila}>
                <Miniatura poster={posters[i]} tam={38} />
                <View style={{ flex: 1 }}>
                  <Text style={s.portadaFilaNombre} numberOfLines={1}>{e.name}</Text>
                  <Text style={s.portadaFilaSub}>{e.sets} × {e.reps}</Text>
                </View>
              </View>
            ))}
            {rutina.exercises.length > 3 && (
              <Text style={s.portadaMas}>y {rutina.exercises.length - 3} más</Text>
            )}
          </View>

          <TouchableOpacity style={s.cta} onPress={onEmpezar} activeOpacity={0.88}>
            <Text style={s.ctaTxt}>Empezar</Text>
            <View style={s.ctaFlecha}>
              <Ionicons name="play" size={15} color={Colors.neon.void} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  )
}

function Tarjeta({ rutina, posters, onEmpezar, onEditar, onBorrar }: {
  rutina: Routine
  posters: (string | null)[]
  onEmpezar: () => void
  onEditar: () => void
  onBorrar: () => void
}) {
  return (
    <View style={s.tarjeta}>
      <View style={s.tarjetaCabecera}>
        <MaterialIcon
          id={TIPOS.find(t => t.id === rutina.trainingType)?.icono ?? 'barbell'}
          size={20} color={Colors.neon.w2}
        />
        <View style={{ flex: 1 }}>
          <Text style={s.nombre} numberOfLines={1}>{rutina.name}</Text>
          <Text style={s.sub}>
            {rutina.exercises.length} ejercicios · ~{Math.round(rutina.estimatedMinutes)} min
          </Text>
        </View>
        <TouchableOpacity onPress={onEditar} hitSlop={8} style={{ padding: 4 }}>
          <Ionicons name="create-outline" size={18} color={Colors.neon.w3} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onBorrar} hitSlop={8} style={{ padding: 4 }}>
          <Ionicons name="trash-outline" size={17} color={Colors.neon.w4} />
        </TouchableOpacity>
      </View>

      {/* Las imágenes en mazo y los nombres al lado: la lista de texto de antes
          ocupaba cuatro líneas y aun así no decía de qué iba la rutina. */}
      <View style={s.resumen}>
        <MazoMiniaturas posters={posters} tam={40} max={3} />
        <View style={{ flex: 1 }}>
          <Text style={s.resumenTxt} numberOfLines={2}>
            {rutina.exercises.slice(0, 3).map(e => e.name).join(' · ')}
            {rutina.exercises.length > 3 ? ` y ${rutina.exercises.length - 3} más` : ''}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={s.empezar} onPress={onEmpezar} activeOpacity={0.88}>
        <Ionicons name="play" size={15} color="#fff" />
        <Text style={s.empezarTxt}>Empezar</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  nueva: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.neon.red,
  },
  seccion: { fontSize: 10, fontWeight: '800', color: Colors.neon.w3, letterSpacing: 1.6, marginTop: Spacing[2] },

  // ── Portada ────────────────────────────────────────────────────────────────
  portada: {
    borderRadius: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: Colors.neon.void,
  },
  /**
   * Sin altura fija, al revés que la portada del historial.
   *
   * Aquí dentro va una lista de hasta tres ejercicios con nombres de largo
   * imprevisible; con un alto fijo, «Elevación lateral con mancuernas sentado»
   * en dos líneas empujaría el botón de empezar fuera de la tarjeta.
   */
  portadaDentro: { padding: Spacing[4], gap: Spacing[5], minHeight: 300, justifyContent: 'space-between' },
  portadaArriba: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  etiqueta: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing[3], paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  etiquetaTxt: { fontSize: 9, fontWeight: '800', color: Colors.neon.void, letterSpacing: 1.1 },
  accionesPortada: { flexDirection: 'row', gap: Spacing[2] },
  accionPortada: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  portadaTitulo: {
    fontSize: 28, fontWeight: '800', color: Colors.neon.white,
    letterSpacing: -0.8, lineHeight: 32,
  },
  portadaSub: { fontSize: 12, color: Colors.neon.w2, marginTop: 4 },

  portadaLista: { gap: Spacing[2] },
  portadaFila: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  portadaFilaNombre: { fontSize: 13, fontWeight: '700', color: Colors.neon.white },
  portadaFilaSub: { fontSize: 11, color: Colors.neon.w2, marginTop: 1 },
  portadaMas: { fontSize: 11, color: Colors.neon.w3, fontStyle: 'italic', marginLeft: 50 },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.neon.white,
    borderRadius: BorderRadius.full,
    paddingLeft: Spacing[5], paddingRight: 5, paddingVertical: 5,
  },
  ctaTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.void },
  ctaFlecha: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.neon.redCore,
  },

  // ── Tarjetas ───────────────────────────────────────────────────────────────
  tarjeta: {
    gap: Spacing[3], padding: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: 20,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  tarjetaCabecera: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  nombre: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white },
  sub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },
  resumen: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  resumenTxt: { fontSize: 12, color: Colors.neon.w2, lineHeight: 17 },
  empezar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: Spacing[3],
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.neon.red,
  },
  empezarTxt: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: '#fff' },
})

const ed = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.neon.void },
  cabecera: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing[4], borderBottomWidth: 1, borderBottomColor: Colors.neon.edge,
  },
  cancelar: { fontSize: Typography.fontSize.sm, color: Colors.neon.w3 },
  titulo: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white },
  guardar: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: Colors.neon.red },

  etiqueta: { fontSize: 10, fontWeight: '700', color: Colors.neon.w3, letterSpacing: 1.3 },
  input: {
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
    padding: Spacing[3],
    fontSize: Typography.fontSize.base, color: Colors.neon.white,
  },
  tipos: { flexDirection: 'row', gap: Spacing[2] },
  tipo: {
    flex: 1, alignItems: 'center', gap: 5, paddingVertical: Spacing[3],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  tipoOn: { borderColor: 'rgba(255,31,61,0.45)', backgroundColor: Colors.neon.redDim },
  tipoTxt: { fontSize: 10, fontWeight: '700', color: Colors.neon.w3 },

  filaTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  anadir: { fontSize: 12, fontWeight: '800', color: Colors.neon.red },

  ejercicio: {
    gap: Spacing[3], padding: Spacing[3],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  ejercicioCabecera: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  ejercicioNum: {
    width: 22, height: 22, borderRadius: 11, textAlign: 'center', lineHeight: 22,
    fontSize: 11, fontWeight: '800', color: Colors.neon.w2,
    backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  ejercicioNombre: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  ejercicioSub: { fontSize: 10, color: Colors.neon.w3, marginTop: 1 },
  campos: { flexDirection: 'row', gap: Spacing[2] },
  campoLabel: { fontSize: 9, fontWeight: '700', color: Colors.neon.w3, letterSpacing: 1 },
  campoCaja: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[2],
  },
  campoInput: {
    flex: 1, paddingVertical: 8, textAlign: 'center',
    fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.neon.white,
  },
  campoSufijo: { fontSize: 11, color: Colors.neon.w3, fontWeight: '700' },
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
    paddingVertical: Spacing[3],
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  filaNombre: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  filaSub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },
  vacio: { fontSize: Typography.fontSize.sm, color: Colors.neon.w3, textAlign: 'center', marginTop: Spacing[6] },
})
