/**
 * EL DÍA DEL PROGRAMA
 * ───────────────────
 * Qué toca hoy, con cuánto peso y por qué ese peso.
 *
 * ── El «por qué» va delante, no escondido ───────────────────────────────────
 * Cada ejercicio dice de dónde sale su número: «completaste 8 en todas las
 * series, toca subir», «85 % de tu máximo», «lo fijaste tú». Un peso sin
 * explicación es una orden, y a una orden se le desobedece o se le hace caso a
 * ciegas; las dos cosas son peores que entender lo que se está haciendo.
 *
 * ── Todo se puede cambiar ───────────────────────────────────────────────────
 * El peso, con el lápiz. El ejercicio entero, con el botón de cambiar. Es la
 * filosofía de la app llevada a los programas: la máquina propone y la persona
 * ajusta cualquier valor. Y lo que se cambia se RECUERDA, que es la diferencia
 * entre resolverlo y volver a resolverlo cada semana.
 *
 * ── El calentamiento es un interruptor y no una lista fija ──────────────────
 * A veces se llega caliente de la calle y a veces no. Cuando se enciende, salen
 * las series de aproximación calculadas sobre el peso de hoy; no se registran
 * en el historial porque no son trabajo, son preparación.
 */

import { useState, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform, Switch,
} from 'react-native'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { CabeceraSeccion } from '@/components/workout/MenuSeccion'
import { Vacio } from '@/components/workout/Charts'
import { Miniatura } from '@/components/workout/Miniatura'
import { MaterialIcon } from '@/components/workout/Kit'
import { NOMBRE_GRUPO } from '@/components/workout/anatomy'
import {
  getDia, fijarPeso, alternativasDe, cambiarEjercicio, calentamiento,
  DiaPropuesto, Propuesta, Alternativa, prescripcion,
} from '@/services/programService'
import { fotoDePrograma } from '@/constants/imagenes'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

export default function DiaDelPrograma() {
  const { week, day } = useLocalSearchParams<{ week?: string; day?: string }>()
  const [d, setD] = useState<DiaPropuesto | null>(null)
  const [cargando, setCargando] = useState(true)
  const [calentar, setCalentar] = useState(false)
  const [editando, setEditando] = useState<Propuesta | null>(null)
  const [cambiando, setCambiando] = useState<Propuesta | null>(null)

  const cargar = useCallback(async () => {
    try {
      const semana = week ? Number(week) : undefined
      const dia = day ? Number(day) : undefined
      setD(await getDia(semana, dia))
    } catch {
      setD(null)
    } finally {
      setCargando(false)
    }
  }, [week, day])

  useFocusEffect(useCallback(() => { void cargar() }, [cargar]))

  /**
   * Los músculos y el material del día, sin repetir.
   *
   * Son las dos preguntas que se hacen ANTES de salir de casa: qué voy a
   * trabajar y si necesito algo que no tengo. Contestarlas obliga a recorrer
   * los ejercicios, así que se hace una vez y no en cada pintada.
   */
  const resumen = useMemo(() => {
    const musculos = new Map<string, string>()
    const material = new Map<string, string>()
    for (const e of d?.ejercicios ?? []) {
      if (e.muscle) musculos.set(e.muscle, e.muscleEs ?? e.muscle)
      if (e.equipment) material.set(e.equipment, e.equipmentEs ?? e.equipment)
    }
    return { musculos: [...musculos.entries()], material: [...material.entries()] }
  }, [d?.ejercicios])

  /**
   * Los ejercicios repartidos por músculo: los de pecho juntos, los de tríceps
   * juntos.
   *
   * ── El grupo aparece donde aparece su PRIMER ejercicio ──────────────────
   * No se ordenan los grupos por nombre ni por tamaño: el primero es el del
   * ejercicio con el que se empieza. Un día de empuje abre con press de banca,
   * así que «Pecho» va arriba y «Tríceps» abajo, que es el orden en que se
   * entrena de verdad.
   *
   * ── Y el NÚMERO no se reparte, se conserva ──────────────────────────────
   * Cada ejercicio guarda su posición en el día completo (1, 2, 3…), no su
   * posición dentro del grupo. Si se renumerara por grupo habría dos «1» en la
   * misma pantalla y se perdería el orden en que hay que hacerlos, que es
   * justo lo que el número está ahí para decir.
   */
  const grupos = useMemo(() => {
    const out: { id: string; nombre: string; ejercicios: { e: Propuesta; n: number }[] }[] = []
    ;(d?.ejercicios ?? []).forEach((e, i) => {
      const id = e.muscle ?? 'otros'
      const nombre = e.muscle ? (NOMBRE_GRUPO[e.muscle] ?? e.muscleEs ?? e.muscle) : 'Otros'
      const g = out.find(x => x.id === id) ?? (out.push({ id, nombre, ejercicios: [] }), out[out.length - 1])
      g.ejercicios.push({ e, n: i + 1 })
    })
    return out
  }, [d?.ejercicios])

  const empezar = () => {
    if (!d) return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    // En UNA plantilla y sin concatenar: al unir dos trozos con `+`, el tipo
    // pasa a ser `string` a secas y el router tipado de expo-router lo rechaza
    // porque ya no puede comprobar que la ruta existe.
    router.push(`/workout/active?programId=${d.programa.id}&week=${d.semana}&day=${d.dia}&mode=gym&title=${encodeURIComponent(d.nombre)}`)
  }

  if (cargando) {
    return (
      <Screen>
        <CabeceraSeccion titulo="Hoy" />
        <View style={s.cargando}><ActivityIndicator color={Colors.neon.red} /></View>
      </Screen>
    )
  }

  if (!d) {
    return (
      <Screen>
        <CabeceraSeccion titulo="Hoy" />
        <View style={{ padding: Spacing[4] }}>
          <Vacio texto="No se pudo cargar el día. Puede que ya no estés siguiendo este programa." />
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <CabeceraSeccion
        titulo={d.nombre}
        subtitulo={`Semana ${d.semana} · día ${d.dia} de ${d.programa.diasPorSemana}`}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        {/* ── Héroe ─────────────────────────────────────────────────────── */}
        <Animated.View entering={FadeIn.duration(400)} style={s.zonaHero}>
          <View style={s.hero}>
            <Image
              source={fotoDePrograma(d.programa)}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={280}
            />
            <LinearGradient
              colors={['rgba(5,5,6,0.30)', 'rgba(5,5,6,0.80)', 'rgba(5,5,6,0.98)']}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            <View style={s.heroDentro}>
              <View style={s.pastillas}>
                {d.hecho ? (
                  <View style={[s.pastilla, s.pastillaHecho]}>
                    <Ionicons name="checkmark" size={11} color={Colors.neon.void} />
                    <Text style={[s.pastillaTxt, { color: Colors.neon.void }]}>YA LO HICISTE</Text>
                  </View>
                ) : d.esElDeHoy ? (
                  <View style={[s.pastilla, s.pastillaHoy]}>
                    <Text style={[s.pastillaTxt, { color: '#fff' }]}>TE TOCA HOY</Text>
                  </View>
                ) : (
                  <View style={s.pastilla}>
                    <Text style={s.pastillaTxt}>MÁS ADELANTE</Text>
                  </View>
                )}

                {d.esDescarga && (
                  <View style={[s.pastilla, s.pastillaDescarga]}>
                    <Ionicons name="battery-half-outline" size={11} color={Colors.neon.redCore} />
                    <Text style={[s.pastillaTxt, { color: Colors.neon.redCore }]}>DESCARGA</Text>
                  </View>
                )}
              </View>

              <View>
                <Text style={s.heroTitulo} numberOfLines={2}>{d.nombre}</Text>
                <Text style={s.heroSub}>
                  {d.programa.nombre} · semana {d.semana} de {d.programa.semanas}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        <View style={s.bloque}>
          {/* ── Qué trabajas y qué necesitas ───────────────────────────── */}
          <View style={s.resumen}>
            <View style={s.resumenFila}>
              <Ionicons name="body-outline" size={15} color={Colors.neon.w3} />
              <Text style={s.resumenEtiqueta}>TRABAJAS</Text>
            </View>
            <View style={s.chips}>
              {resumen.musculos.map(([id, nombre]) => (
                <View key={id} style={s.chip}>
                  <Text style={s.chipTxt}>{NOMBRE_GRUPO[id] ?? nombre}</Text>
                </View>
              ))}
              {resumen.musculos.length === 0 && <Text style={s.nada}>—</Text>}
            </View>

            <View style={[s.resumenFila, { marginTop: Spacing[3] }]}>
              <Ionicons name="barbell-outline" size={15} color={Colors.neon.w3} />
              <Text style={s.resumenEtiqueta}>NECESITAS</Text>
            </View>
            <View style={s.chips}>
              {resumen.material.map(([id, nombre]) => (
                <View key={id} style={s.chip}>
                  <MaterialIcon id={id} size={13} color={Colors.neon.w2} />
                  <Text style={s.chipTxt}>{nombre}</Text>
                </View>
              ))}
              {resumen.material.length === 0 && <Text style={s.nada}>Nada</Text>}
            </View>
          </View>

          {/* ── Calentamiento ──────────────────────────────────────────── */}
          <View style={s.calentar}>
            <View style={{ flex: 1 }}>
              <Text style={s.calentarTitulo}>Series de aproximación</Text>
              <Text style={s.calentarSub}>
                Subir hasta el peso de hoy poco a poco. No cuentan en tu volumen ni
                en tus récords.
              </Text>
            </View>
            <Switch
              value={calentar}
              onValueChange={v => { void Haptics.selectionAsync(); setCalentar(v) }}
              trackColor={{ false: 'rgba(255,255,255,0.14)', true: Colors.neon.red }}
              thumbColor="#fff"
            />
          </View>

          {/* ── Los ejercicios, agrupados por músculo ───────────────────── */}
          <Text style={s.seccion}>LOS {d.ejercicios.length} EJERCICIOS</Text>

          {grupos.map((g, gi) => (
            <View key={g.id} style={{ gap: Spacing[3] }}>
              {/* La cabecera del grupo solo cuando hay MÁS DE UNO. Con un solo
                  músculo, «PECHO» encima de cinco ejercicios de pecho no añade
                  nada y mete un escalón de más en la lectura. */}
              {grupos.length > 1 && (
                <View style={s.grupo}>
                  <Text style={s.grupoTxt}>{g.nombre.toUpperCase()}</Text>
                  <View style={s.grupoLinea} />
                  <Text style={s.grupoCuenta}>
                    {g.ejercicios.length} {g.ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}
                  </Text>
                </View>
              )}

              {g.ejercicios.map(({ e, n }, i) => (
                <Animated.View
                  key={e.clavePlan}
                  entering={FadeInDown.delay(Math.min((gi * 2 + i) * 45, 320)).duration(320)}
                >
                  <FichaEjercicio
                    e={e}
                    n={n}
                    poster={e.slug ? d.posters[e.slug] : null}
                    calentar={calentar}
                    contexto={{ programId: d.programa.id, semana: d.semana, dia: d.dia }}
                    onEditarPeso={() => setEditando(e)}
                    onCambiar={() => setCambiando(e)}
                  />
                </Animated.View>
              ))}
            </View>
          ))}

          <Text style={s.pie}>
            Los pesos son una propuesta a partir de lo que ya has levantado. Toca el
            lápiz para poner el tuyo: se recuerda para las próximas semanas.
          </Text>
        </View>
      </ScrollView>

      {/* ── Empezar ────────────────────────────────────────────────────── */}
      <View style={s.pieFijo}>
        <TouchableOpacity style={[s.boton, d.hecho && s.botonHecho]} onPress={empezar} activeOpacity={0.88}>
          <Ionicons name="play" size={17} color="#fff" />
          <Text style={s.botonTxt}>
            {d.hecho ? 'Repetir este día' : d.esElDeHoy ? 'Empezar' : 'Entrenar este día'}
          </Text>
        </TouchableOpacity>
      </View>

      <EditorPeso
        ejercicio={editando}
        onCerrar={() => setEditando(null)}
        onGuardado={() => { setEditando(null); void cargar() }}
      />
      <CambiarEjercicio
        ejercicio={cambiando}
        onCerrar={() => setCambiando(null)}
        onCambiado={() => { setCambiando(null); void cargar() }}
      />
    </Screen>
  )
}

// ── Ficha de un ejercicio ────────────────────────────────────────────────────

function FichaEjercicio({ e, n, poster, calentar, contexto, onEditarPeso, onCambiar }: {
  e: Propuesta
  n: number
  poster?: string | null
  calentar: boolean
  /** De qué día del plan es esto. Viaja a la pantalla de hacerlo. */
  contexto: { programId: string; semana: number; dia: number }
  onEditarPeso: () => void
  onCambiar: () => void
}) {
  const aprox = calentar ? calentamiento(e.pesoKg) : []

  return (
    <View style={f.wrap}>
      {/**
        * Tocar el ejercicio lleva a HACERLO: su vídeo, su contador de series,
        * su descanso y el botón de anotar.
        *
        * Antes esta fila no llevaba a ningún sitio y para entrenar había que
        * volver arriba y darle a «Empezar». Que el ejercicio no se pudiera
        * tocar es de las cosas que uno prueba y no entiende: si está en la
        * pantalla y tiene foto, se toca.
        */}
      <TouchableOpacity
        style={f.cabecera}
        onPress={() => {
          void Haptics.selectionAsync()
          const q = new URLSearchParams({
            slug: e.slug ?? '',
            nombre: e.nombre,
            orden: String(n - 1),
            series: String(e.series),
            reps: e.reps ?? '',
            descanso: String(e.descanso),
            carga: e.carga,
            // El contexto viaja para que la pantalla pueda comprobar que la
            // sesión abierta es la de ESTE día y no una huérfana de otro.
            programId: contexto.programId,
            semana: String(contexto.semana),
            dia: String(contexto.dia),
            ...(e.duracion ? { duracion: String(e.duracion) } : {}),
            ...(e.pesoKg != null ? { peso: String(e.pesoKg) } : {}),
          })
          router.push(`/workout/exercise/hacer?${q.toString()}`)
        }}
        activeOpacity={0.85}
      >
        <Text style={f.num}>{n}</Text>
        <Miniatura poster={poster} tam={48} />
        <View style={{ flex: 1 }}>
          <Text style={f.nombre} numberOfLines={2}>{e.nombre}</Text>
          <Text style={f.sub}>
            {prescripcion(e)} · {e.descanso}s
            {e.muscleEs ? ` · ${e.muscleEs}` : ''}
          </Text>
          {e.cambiado && e.original ? (
            <Text style={f.cambiado}>Cambiado — en el plan era «{e.original}»</Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={15} color={Colors.neon.w4} />
        <TouchableOpacity onPress={onCambiar} hitSlop={8} style={f.iconoBoton}>
          <Ionicons name="swap-horizontal" size={17} color={Colors.neon.w3} />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* ── El peso y su porqué ────────────────────────────────────────── */}
      <TouchableOpacity style={f.peso} onPress={onEditarPeso} activeOpacity={0.85}>
        <View style={{ flex: 1 }}>
          {e.pesoKg != null ? (
            <Text style={f.pesoValor}>
              {e.pesoKg}<Text style={f.pesoUnidad}> kg</Text>
              {e.fijadoAMano && <Text style={f.fijado}>  · fijado por ti</Text>}
            </Text>
          ) : (
            <Text style={f.pesoLibre}>
              {e.carga === 'bodyweight' ? 'Tu peso' : 'Elige el peso'}
            </Text>
          )}
          <Text style={f.motivo}>{e.motivo}</Text>
        </View>
        <View style={f.lapiz}>
          <Ionicons name="create-outline" size={15} color={Colors.neon.w2} />
        </View>
      </TouchableOpacity>

      {aprox.length > 0 && (
        <View style={f.aprox}>
          <Text style={f.aproxTitulo}>ANTES, CALIENTA</Text>
          <View style={f.aproxFilas}>
            {aprox.map((a, i) => (
              <View key={i} style={f.aproxPastilla}>
                <Text style={f.aproxTxt}>{a.pesoKg} × {a.reps}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {e.notas ? <Text style={f.notas}>{e.notas}</Text> : null}
    </View>
  )
}

// ── Poner el peso a mano ─────────────────────────────────────────────────────

function EditorPeso({ ejercicio, onCerrar, onGuardado }: {
  ejercicio: Propuesta | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [valor, setValor] = useState('')
  const [guardando, setGuardando] = useState(false)

  const visible = !!ejercicio
  const inicial = ejercicio?.pesoKg != null ? String(ejercicio.pesoKg) : ''

  const guardar = async (kg: number | null) => {
    if (!ejercicio || guardando) return
    setGuardando(true)
    try {
      await fijarPeso(ejercicio.clavePlan, kg)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onGuardado()
    } catch {
      Alert.alert('No se pudo guardar', 'Inténtalo otra vez en un momento.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}
      onShow={() => setValor(inicial)}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={e.fondo} activeOpacity={1} onPress={onCerrar} />
        <View style={e.hoja}>
          <Text style={e.titulo}>{ejercicio?.nombre}</Text>
          <Text style={e.sub}>
            Pon el peso que vas a usar. Se recuerda para las próximas semanas y deja
            de calcularse solo.
          </Text>

          <View style={e.campo}>
            <TextInput
              style={e.input}
              value={valor}
              onChangeText={setValor}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={Colors.neon.w4}
              autoFocus
              selectTextOnFocus
            />
            <Text style={e.unidad}>kg</Text>
          </View>

          <TouchableOpacity
            style={e.guardar}
            onPress={() => {
              const n = parseFloat(valor.replace(',', '.'))
              if (!Number.isFinite(n) || n < 0) {
                Alert.alert('Ese peso no vale', 'Escribe un número.')
                return
              }
              void guardar(n)
            }}
            activeOpacity={0.88}
            disabled={guardando}
          >
            {guardando ? <ActivityIndicator color="#fff" /> : <Text style={e.guardarTxt}>Guardar</Text>}
          </TouchableOpacity>

          {/* Soltar el peso devuelve el ejercicio al cálculo automático. Sin
              esta salida, un peso puesto por error mandaría para siempre. */}
          {ejercicio?.fijadoAMano && (
            <TouchableOpacity style={e.soltar} onPress={() => void guardar(null)} activeOpacity={0.8}>
              <Text style={e.soltarTxt}>Que lo calcule el programa otra vez</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={e.cancelar} onPress={onCerrar} activeOpacity={0.8}>
            <Text style={e.cancelarTxt}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── Cambiar el ejercicio ─────────────────────────────────────────────────────

function CambiarEjercicio({ ejercicio, onCerrar, onCambiado }: {
  ejercicio: Propuesta | null
  onCerrar: () => void
  onCambiado: () => void
}) {
  const [lista, setLista] = useState<Alternativa[]>([])
  const [original, setOriginal] = useState<{ slug: string; nombre: string } | null>(null)
  const [cargando, setCargando] = useState(false)

  const visible = !!ejercicio

  const cargar = useCallback(async () => {
    if (!ejercicio) return
    setCargando(true)
    try {
      const r = await alternativasDe(ejercicio.clavePlan)
      setLista(r.alternativas)
      setOriginal(r.original)
    } catch {
      setLista([])
    } finally {
      setCargando(false)
    }
  }, [ejercicio])

  const elegir = async (slug: string | null) => {
    if (!ejercicio) return
    try {
      void Haptics.selectionAsync()
      await cambiarEjercicio(ejercicio.clavePlan, slug)
      onCambiado()
    } catch {
      Alert.alert('No se pudo cambiar', 'Ese ejercicio no encaja o no hay conexión.')
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet"
      onRequestClose={onCerrar} onShow={() => void cargar()}>
      <SafeAreaProvider>
        <SafeAreaView style={c.wrap}>
          <View style={c.cabecera}>
            <View style={{ flex: 1 }}>
              <Text style={c.titulo}>Cambiar ejercicio</Text>
              <Text style={c.sub} numberOfLines={1}>{ejercicio?.nombre}</Text>
            </View>
            <TouchableOpacity onPress={onCerrar} hitSlop={10}>
              <Ionicons name="close" size={22} color={Colors.neon.w2} />
            </TouchableOpacity>
          </View>

          <Text style={c.aviso}>
            Solo salen ejercicios del mismo patrón de movimiento. Si la máquina está
            ocupada hace falta otro empuje, no cualquier ejercicio del mismo músculo.
          </Text>

          <ScrollView contentContainerStyle={{ padding: Spacing[4], paddingBottom: 40, gap: Spacing[2] }}>
            {cargando ? (
              <ActivityIndicator style={{ marginTop: Spacing[6] }} color={Colors.neon.w3} />
            ) : (
              <>
                {ejercicio?.cambiado && original && (
                  <TouchableOpacity style={c.volver} onPress={() => void elegir(null)} activeOpacity={0.85}>
                    <Ionicons name="arrow-undo-outline" size={16} color={Colors.neon.redCore} />
                    <Text style={c.volverTxt}>Volver a «{original.nombre}», el del plan</Text>
                  </TouchableOpacity>
                )}

                {lista.map(a => (
                  <TouchableOpacity
                    key={a.slug}
                    style={c.fila}
                    onPress={() => void elegir(a.slug)}
                    activeOpacity={0.85}
                  >
                    <Miniatura poster={a.poster} tam={46} />
                    <View style={{ flex: 1 }}>
                      <Text style={c.filaNombre} numberOfLines={2}>{a.nombre}</Text>
                      <Text style={c.filaSub}>
                        {a.muscleEs ?? '—'} · {a.equipmentEs}
                        {a.home ? ' · se puede en casa' : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.neon.w4} />
                  </TouchableOpacity>
                ))}

                {!cargando && lista.length === 0 && (
                  <Vacio texto="No hay otro ejercicio del mismo patrón en el catálogo." />
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  cargando: { paddingVertical: Spacing[8], alignItems: 'center' },

  zonaHero: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[4] },
  hero: {
    height: 220, borderRadius: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: Colors.neon.void,
  },
  heroDentro: { flex: 1, justifyContent: 'space-between', padding: Spacing[4] },
  pastillas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pastilla: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing[2] + 2, paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  pastillaHoy: { backgroundColor: Colors.neon.red, borderColor: Colors.neon.red },
  pastillaHecho: { backgroundColor: 'rgba(255,255,255,0.94)', borderColor: 'transparent' },
  pastillaDescarga: { backgroundColor: Colors.neon.redDim, borderColor: 'rgba(255,31,61,0.35)' },
  pastillaTxt: { fontSize: 9, fontWeight: '800', color: Colors.neon.w2, letterSpacing: 1 },
  heroTitulo: { fontSize: 27, fontWeight: '800', color: Colors.neon.white, letterSpacing: -0.7, lineHeight: 31 },
  heroSub: { fontSize: 12, color: Colors.neon.w2, marginTop: 3 },

  bloque: { paddingHorizontal: Spacing[4], gap: Spacing[3] },

  resumen: {
    padding: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: 18,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  resumenFila: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing[2] },
  resumenEtiqueta: { fontSize: 9.5, fontWeight: '800', color: Colors.neon.w3, letterSpacing: 1.3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing[2] + 2, paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipTxt: { fontSize: 11, fontWeight: '700', color: Colors.neon.w2 },
  nada: { fontSize: 11, color: Colors.neon.w3 },

  calentar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: 18,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  calentarTitulo: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: Colors.neon.white },
  calentarSub: { fontSize: 11, color: Colors.neon.w3, marginTop: 2, lineHeight: 15 },

  seccion: { fontSize: 10, fontWeight: '800', color: Colors.neon.w3, letterSpacing: 1.6, marginTop: Spacing[2] },

  grupo: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], marginTop: Spacing[1] },
  grupoTxt: { fontSize: 11, fontWeight: '800', color: Colors.neon.white, letterSpacing: 1.2 },
  grupoLinea: { flex: 1, height: 1, backgroundColor: Colors.neon.edge },
  grupoCuenta: { fontSize: 10, color: Colors.neon.w3 },
  pie: { fontSize: 11, color: Colors.neon.w3, lineHeight: 16, paddingTop: Spacing[2] },

  pieFijo: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: Spacing[4], paddingBottom: Spacing[6],
    backgroundColor: 'rgba(5,5,6,0.96)',
    borderTopWidth: 1, borderTopColor: Colors.neon.edge,
  },
  boton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[2],
    backgroundColor: Colors.neon.red,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing[4],
  },
  botonHecho: { backgroundColor: 'rgba(255,255,255,0.12)' },
  botonTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
})

const f = StyleSheet.create({
  wrap: {
    gap: Spacing[3], padding: Spacing[3] + 2,
    backgroundColor: Colors.neon.pane,
    borderRadius: 18,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  num: { width: 12, fontSize: 11, fontWeight: '800', color: Colors.neon.w4 },
  nombre: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: Colors.neon.white, lineHeight: 19 },
  sub: { fontSize: 11, color: Colors.neon.w3, marginTop: 2 },
  cambiado: { fontSize: 10, color: Colors.neon.redCore, marginTop: 3, fontStyle: 'italic' },
  iconoBoton: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  peso: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[3],
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  pesoValor: { fontSize: 22, fontWeight: '800', color: Colors.neon.white, letterSpacing: -0.6 },
  pesoUnidad: { fontSize: 13, fontWeight: '700', color: Colors.neon.w2 },
  fijado: { fontSize: 10, fontWeight: '700', color: Colors.neon.redCore, letterSpacing: 0 },
  pesoLibre: { fontSize: 15, fontWeight: '800', color: Colors.neon.w2 },
  motivo: { fontSize: 11, color: Colors.neon.w3, marginTop: 3, lineHeight: 15 },
  lapiz: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  aprox: { gap: 6 },
  aproxTitulo: { fontSize: 9, fontWeight: '800', color: Colors.neon.w3, letterSpacing: 1.2 },
  aproxFilas: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  aproxPastilla: {
    paddingHorizontal: Spacing[2] + 2, paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  aproxTxt: { fontSize: 11, fontWeight: '700', color: Colors.neon.w2 },

  notas: { fontSize: 11, color: Colors.neon.w3, lineHeight: 16, fontStyle: 'italic' },
})

const e = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  hoja: {
    backgroundColor: '#141416',
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    padding: Spacing[5], paddingBottom: Spacing[6],
    gap: Spacing[3],
    borderTopWidth: 1, borderColor: Colors.neon.edge,
  },
  titulo: { fontSize: Typography.fontSize.lg, fontWeight: '800', color: Colors.neon.white },
  sub: { fontSize: 12, color: Colors.neon.w3, lineHeight: 17 },
  campo: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
    paddingHorizontal: Spacing[4],
  },
  input: {
    flex: 1, paddingVertical: Spacing[3],
    fontSize: 30, fontWeight: '800', color: Colors.neon.white, textAlign: 'center',
  },
  unidad: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.neon.w3 },
  guardar: {
    alignItems: 'center', paddingVertical: Spacing[4],
    borderRadius: BorderRadius.lg, backgroundColor: Colors.neon.red,
  },
  guardarTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
  soltar: { alignItems: 'center', paddingVertical: Spacing[2] },
  soltarTxt: { fontSize: 12, fontWeight: '700', color: Colors.neon.redCore },
  cancelar: { alignItems: 'center', paddingVertical: Spacing[2] },
  cancelarTxt: { fontSize: Typography.fontSize.sm, color: Colors.neon.w3 },
})

const c = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.neon.void },
  cabecera: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[4],
    borderBottomWidth: 1, borderBottomColor: Colors.neon.edge,
  },
  titulo: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white },
  sub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },
  aviso: {
    fontSize: 11, color: Colors.neon.w3, lineHeight: 16,
    paddingHorizontal: Spacing[4], paddingTop: Spacing[3],
  },
  volver: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    padding: Spacing[3],
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.neon.redDim,
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.3)',
    marginBottom: Spacing[2],
  },
  volverTxt: { flex: 1, fontSize: 12, fontWeight: '700', color: Colors.neon.redCore },
  fila: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[3],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  filaNombre: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  filaSub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },
})
