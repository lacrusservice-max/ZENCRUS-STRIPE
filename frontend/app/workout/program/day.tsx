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
 * ── El calentamiento es de CADA EJERCICIO ───────────────────────────────────
 * A veces se llega caliente de la calle y a veces no, y sobre todo: se calienta
 * en lo que pesa. Un interruptor único para el día entero obligaba a elegir
 * entre calentar hasta en las elevaciones laterales o no calentar ni en la
 * sentadilla. Ahora vive dentro de la ficha del ejercicio, justo debajo del
 * peso al que se aproxima, que es la única forma de decidirlo con criterio.
 * Las series de aproximación no se registran en el historial: no son trabajo,
 * son preparación.
 *
 * ── Lo que se trabaja y lo que hace falta, AL FINAL ──────────────────────────
 * Es información para antes de salir de casa —«¿necesito polea?»—, no lo
 * primero que se mira. Arriba empujaba hacia abajo lo único que se viene a
 * buscar, que es la lista de ejercicios.
 */

import { useState, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { Image } from '@/components/ui/Imagen'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { useSessionStore } from '@/store/sessionStore'
import { CabeceraSeccion } from '@/components/workout/MenuSeccion'
import { Vacio } from '@/components/workout/Charts'
import { Miniatura } from '@/components/workout/Miniatura'
import { MaterialIcon } from '@/components/workout/Kit'
import { NOMBRE_GRUPO } from '@/components/workout/anatomy'
import {
  getDia, alternativasDe, cambiarEjercicio,
  DiaPropuesto, Propuesta, Alternativa, prescripcion,
} from '@/services/programService'
import { fotoDePrograma } from '@/constants/imagenes'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

export default function DiaDelPrograma() {
  const { week, day } = useLocalSearchParams<{ week?: string; day?: string }>()
  const [d, setD] = useState<DiaPropuesto | null>(null)
  const [cargando, setCargando] = useState(true)
  const [cambiando, setCambiando] = useState<Propuesta | null>(null)
  const [abriendo, setAbriendo] = useState(false)
  const { sesion, empezar: empezarSesion } = useSessionStore()

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

  /**
   * Empezar abre la sesión y SE QUEDA AQUÍ.
   *
   * Antes saltaba a `workout/active`, la pantalla de sesión antigua, y ahí es
   * donde acababa todo el mundo: una lista vacía que decía «sin ejercicios
   * todavía» aunque el día tuviera seis, porque los ejercicios viven en el plan
   * y no en la sesión. El diseño nuevo es ESTE —la ficha del día con sus
   * ejercicios, y cada uno lleva a su pantalla— así que empezar no puede
   * llevarte a otro sitio.
   *
   * Se abre la sesión y la ficha se queda delante: tocas el primer ejercicio y
   * a anotar.
   */
  /** ¿La sesión abierta es justo la de este día? */
  const enMarcha = !!d && !!sesion
    && sesion.programId === d.programa.id
    && sesion.programWeek === d.semana
    && sesion.programDay === d.dia

  const empezar = async () => {
    if (!d || abriendo) return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    setAbriendo(true)
    try {
      await empezarSesion({
        mode: 'gym', source: 'program', title: d.nombre,
        programId: d.programa.id, programWeek: d.semana, programDay: d.dia,
      })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      Alert.alert('No se pudo empezar', 'Revisa la conexión y vuelve a intentarlo.')
    } finally {
      setAbriendo(false)
    }
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
                    contexto={{ programId: d.programa.id, semana: d.semana, dia: d.dia, titulo: d.nombre }}
                    onCambiar={() => setCambiando(e)}
                  />
                </Animated.View>
              ))}
            </View>
          ))}

          {/**
            * Qué trabajas y qué necesitas, AL FINAL.
            *
            * Estaba arriba, entre la portada y los ejercicios, y ahí empujaba
            * hacia abajo lo único que se viene a buscar: la lista. Es
            * información de contexto —para saber si te hace falta la polea antes
            * de salir de casa—, no lo primero que se mira, así que se lee cuando
            * ya has visto el día.
            */}
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

          <Text style={s.pie}>
            Los pesos son una propuesta a partir de lo que ya has levantado. Toca el
            lápiz para poner el tuyo: se recuerda para las próximas semanas.
          </Text>
        </View>
      </ScrollView>

      {/* ── Empezar ────────────────────────────────────────────────────── */}
      <View style={s.pieFijo}>
        {/* Con la sesión de ESTE día ya abierta, el botón deja de invitar a
            empezar —ya empezaste— y recuerda lo único que queda por hacer:
            tocar un ejercicio. */}
        {enMarcha ? (
          <View style={[s.boton, s.botonHecho]}>
            <Ionicons name="checkmark-circle" size={17} color="#fff" />
            <Text style={s.botonTxt}>En marcha · toca un ejercicio para anotar</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[s.boton, d.hecho && s.botonHecho]}
            onPress={() => void empezar()}
            disabled={abriendo}
            activeOpacity={0.88}
          >
            {abriendo
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Ionicons name="play" size={17} color="#fff" />
                  <Text style={s.botonTxt}>
                    {d.hecho ? 'Repetir este día' : d.esElDeHoy ? 'Empezar' : 'Entrenar este día'}
                  </Text>
                </>}
          </TouchableOpacity>
        )}
      </View>

      <CambiarEjercicio
        ejercicio={cambiando}
        onCerrar={() => setCambiando(null)}
        onCambiado={() => { setCambiando(null); void cargar() }}
      />
    </Screen>
  )
}

// ── Ficha de un ejercicio ────────────────────────────────────────────────────

function FichaEjercicio({ e, n, poster, contexto, onCambiar }: {
  e: Propuesta
  n: number
  poster?: string | null
  /** De qué día del plan es esto. Viaja a la pantalla de hacerlo. */
  contexto: { programId: string; semana: number; dia: number; titulo: string }
  onCambiar: () => void
}) {

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
            titulo: contexto.titulo,
            clavePlan: e.clavePlan,
            motivo: e.motivo ?? '',
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
            {/* El peso SE VE aquí aunque ya no se edite aquí: recorrer el día y
                saber con cuánto vas es media razón para abrir esta pantalla. */}
            {e.pesoKg != null ? ` · ${e.pesoKg} kg` : ''}
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

      {e.notas ? <Text style={f.notas}>{e.notas}</Text> : null}
    </View>
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

  /* El interruptor vive DENTRO de la ficha, así que va más discreto que la
     tarjeta global que sustituye: no compite con el peso, que es lo que manda. */
  calentar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingVertical: Spacing[2],
  },
  calentarTitulo: { fontSize: 12.5, fontWeight: '700', color: Colors.neon.w2 },
  calentarSub: { fontSize: 11, color: Colors.neon.w3, marginTop: 2, lineHeight: 15 },

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
