/**
 * SALUD · HÁBITOS · NUEVO
 * ═══════════════════════════════════════════════════════════════════════════
 * Crear un hábito, con el sitio que merece.
 *
 * ── Por qué dejó de ser un formulario dentro de la lista ───────────────────
 * Estaba metido en una caja de borde punteado al final de la pantalla, con
 * tres filas de pastillas idénticas y un campo de texto suelto. Parecía un
 * boceto: filetes punteados y controles todos del mismo tamaño no dicen qué
 * importa más. Crear un hábito es una decisión, no un apéndice de una lista.
 *
 * ── El nombre manda ────────────────────────────────────────────────────────
 * Se escribe a 28 px y sin caja, como un título. Lo demás son elecciones entre
 * pocas opciones, y esas se TOCAN: bloques con icono, no texto en una píldora.
 *
 * ── La hora, en dos campos numéricos ───────────────────────────────────────
 * Y no un «07:00» a mano. Los dos puntos obligan a cambiar de teclado en el
 * móvil, y en el simulador ni siquiera llegan —salen como «Ñ»—. Sin ese
 * carácter no hay nada que teclear mal.
 *
 * ── El cronómetro se elige, no se teclea ───────────────────────────────────
 * Cinco, diez, quince… son los que la gente pone. Escribir «5» a mano para
 * acabar en la misma cifra es trabajo sin premio.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView,
  Platform, FlatList, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useHabitsStore, type Momento, type TipoHabito } from '@/store/habitsStore'
import {
  AnilloSueno, duracionMin, comoHora, comoHora12, comoDuracion,
} from '@/components/salud/AnilloSueno'
import { elegir, confirmar } from '@/utils/haptica'
import {
  pedirPermisoRecordatorios, pareceHorarioDeSueno,
  diaActivo, alternarDia, TODOS as TODOS_LOS_DIAS,
} from '@/features/salud/recordatorios'
import { SONIDOS, nombreDeSonido, HAY_DONDE_ELEGIR } from '@/constants/sonidosAlarma'
import { RuedaHora } from '@/components/salud/RuedaHora'
import { CATEGORIAS, categoriaDe, iconosVisibles } from '@/features/salud/iconos'
import { PLANTILLAS, type Plantilla } from '@/features/salud/plantillas'

type IconName = React.ComponentProps<typeof Ionicons>['name']

const ROJO = '#FF1F3D'
const ROJO_HONDO = '#C4102A'

const MOMENTOS: { id: Momento; titulo: string; icono: IconName }[] = [
  { id: 'manana', titulo: 'MAÑANA', icono: 'sunny-outline' },
  { id: 'tarde',  titulo: 'TARDE',  icono: 'partly-sunny-outline' },
  { id: 'noche',  titulo: 'NOCHE',  icono: 'moon-outline' },
]

/**
 * Atajos, no la lista de lo posible.
 *
 * El minutero se escribe libre —cualquier cifra de 1 a 1440—; estos solo
 * rellenan el campo de un toque porque son los que más se ponen. Antes eran la
 * ÚNICA vía y eso dejaba fuera a quien quiere siete minutos, o noventa.
 */
const ATAJOS = [5, 10, 15, 20, 30, 45, 60, 90]

/** Un día. Es el tope que aguanta la columna `meta_segundos` (86 400 s). */
const MINUTOS_MAX = 1440

/** Todos los de Ionicons, no una docena elegida a dedo. */
const TODOS_LOS_ICONOS = Object.keys(Ionicons.glyphMap).sort() as IconName[]

/** «23:00» → minutos desde medianoche. */
function aMinutos(hora: string | null, porDefecto: number): number {
  if (!hora) return porDefecto
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

export default function Habito() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const { habits, addHabit, editarHabito, removeHabit } = useHabitsStore()
  const existente = id ? habits.find(x => x.id === id) : undefined
  const editando = !!existente

  const [nombre, setNombre] = useState(existente?.label ?? '')
  const [icono, setIcono] = useState<IconName>((existente?.icon as IconName) ?? 'leaf')
  const [tipo, setTipo] = useState<TipoHabito>(existente?.tipo ?? 'hacer')
  const [momento, setMomento] = useState<Momento>(existente?.momento ?? 'manana')
  /* En minutos desde medianoche, no en dos cadenas: la rueda trabaja con
     índices y el anillo ya usaba minutos. Una sola forma evita convertir en
     cada sitio. */
  const [horaMin, setHoraMin] = useState<number | null>(
    existente?.hora ? aMinutos(existente.hora, 0) : null)
  const [min, setMin] = useState(
    existente?.metaSegundos && !existente.horaFin ? String(Math.round(existente.metaSegundos / 60)) : '')
  const [buscaIcono, setBuscaIcono] = useState('')
  const [categoria, setCategoria] = useState(() => categoriaDe(existente?.icon ?? 'leaf'))
  const [verTodos, setVerTodos] = useState(false)

  /* Crear es un asistente que empieza por plantillas; editar es una página
     única. Al editar vas directo a lo que cambias, y hacerte recorrer cuatro
     pasos para mover una hora sería peor que la lista de antes. */
  const [enPlantillas, setEnPlantillas] = useState(!existente)
  const [desdeCero, setDesdeCero] = useState(false)
  const [paso, setPaso] = useState(0)
  /* Mientras un dedo mueve el anillo, la lista NO se desplaza. */
  const [moviendoAnillo, setMoviendoAnillo] = useState(false)

  /* ── El horario de sueño ────────────────────────────────────────────────
     `hora` es acostarse y `horaFin` despertar. Cuando el hábito es un horario
     de sueño, `metaSegundos` deja de significar «cronómetro» y pasa a ser el
     objetivo de horas: son dos cosas que nunca conviven en el mismo hábito, y
     así no hace falta otra columna. */
  const [esSueno, setEsSueno] = useState(!!existente?.horaFin)
  const [acostar, setAcostar] = useState(aMinutos(existente?.hora ?? null, 23 * 60))
  const [despertar, setDespertar] = useState(aMinutos(existente?.horaFin ?? null, 7 * 60))
  const [objetivoH, setObjetivoH] = useState(
    existente?.horaFin && existente.metaSegundos ? existente.metaSegundos / 3600 : 8)

  const [alarma, setAlarma] = useState(existente?.alarma ?? false)
  const [posponer, setPosponer] = useState(existente?.alarmaPosponer ?? true)
  const [dias, setDias] = useState(existente?.alarmaDias ?? TODOS_LOS_DIAS)
  const [alarmaFin, setAlarmaFin] = useState(existente?.alarmaFin ?? false)
  const [diasFin, setDiasFin] = useState(existente?.alarmaFinDias ?? TODOS_LOS_DIAS)

  /* Al escribir «dormir» el horario de sueño se enciende SOLO, y con él las dos
     alarmas: quien pone un horario de sueño quiere despertador. Solo pasa
     mientras no lo hayas tocado tú —`tocadoSueno`—, para no volver a encenderlo
     cada vez que escribes una letra después de haberlo apagado a mano. */
  const [tocadoSueno, setTocadoSueno] = useState(!!existente)
  useEffect(() => {
    if (tocadoSueno || esSueno) return
    if (pareceHorarioDeSueno(nombre)) { setEsSueno(true); setAlarma(true); setAlarmaFin(true) }
  }, [nombre, tocadoSueno, esSueno])
  const [sonido, setSonido] = useState<string | null>(existente?.alarmaSonido ?? null)

  // El hábito llega de la caché y un instante después del servidor: si cambia
  // bajo los pies hay que recoger lo que falta, pero solo mientras no se haya
  // tocado nada, para no pisar lo que la persona está escribiendo.
  useEffect(() => {
    if (!existente || nombre !== '') return
    setNombre(existente.label)
  }, [existente, nombre])

  const hora = horaMin === null ? null : comoHora(horaMin)
  const minutos = Math.min(MINUTOS_MAX, Number(min) || 0)
  /* Con plantilla el nombre ya viene dado, así que sobra preguntarlo: son tres
     pasos en vez de cuatro. */
  const pasos: readonly ('nombre' | 'cuando' | 'hora' | 'icono')[] =
    desdeCero ? ['nombre', 'cuando', 'hora', 'icono'] : ['cuando', 'hora', 'icono']
  const claveActual = pasos[Math.min(paso, pasos.length - 1)]
  const ultimoPaso = paso >= pasos.length - 1

  /** Editando se ve todo a la vez; creando, solo el paso en curso. */
  const ver = (clave: typeof pasos[number]) => editando || claveActual === clave

  const puedeCrear = nombre.trim().length > 0
  const puedeSeguir = claveActual !== 'nombre' || puedeCrear

  /* Mil trescientos iconos de golpe no son libertad, son un muro. Se enseña
     una categoría cada vez; el buscador los atraviesa todos y «ver todos»
     despliega la rejilla entera, así que nada queda fuera. */
  const iconos = useMemo(
    () => iconosVisibles(buscaIcono, categoria, verTodos),
    [buscaIcono, categoria, verTodos])

  const lista = useRef<FlatList<IconName>>(null)
  useEffect(() => {
    lista.current?.scrollToOffset({ offset: 0, animated: false })
  }, [paso, enPlantillas])

  /* Un horario de sueño manda sobre la hora suelta: la de acostarse ES la hora
     del hábito, y el objetivo ocupa el sitio del cronómetro. */
  const datos = esSueno
    ? {
      momento, tipo,
      hora: comoHora(acostar),
      horaFin: comoHora(despertar),
      metaSegundos: Math.round(objetivoH * 3600),
      alarma, alarmaDias: dias, alarmaFin, alarmaFinDias: diasFin,
      alarmaPosponer: posponer, alarmaSonido: sonido,
    }
    : {
      momento, tipo, hora, horaFin: null,
      metaSegundos: minutos > 0 ? minutos * 60 : null,
      alarma, alarmaDias: dias, alarmaFin: false, alarmaFinDias: diasFin,
      alarmaPosponer: posponer, alarmaSonido: sonido,
    }

  const guardar = () => {
    if (!puedeCrear) return
    confirmar()
    // El permiso se pide justo aquí: al poner una hora, la pregunta se explica
    // sola. Preguntar al abrir una pantalla es la forma más rápida de que te
    // digan que no para siempre.
    if (datos.hora) void pedirPermisoRecordatorios()
    if (existente) void editarHabito(existente.id, { label: nombre.trim(), icon: icono, ...datos })
    else void addHabit(nombre.trim(), icono, datos)
    router.back()
  }

  /**
   * Dejar el formulario como recién abierto.
   *
   * Lo usan las dos entradas del asistente. Antes cada una tocaba solo los
   * campos que le interesaban y el resto se arrastraba: elegir DORMIR, volver
   * atrás y elegir LEER dejaba LEER con las dos alarmas del horario de sueño
   * encendidas. Se limpia todo y luego se pone encima lo que toque.
   */
  const restablecer = () => {
    setNombre('')
    setIcono('leaf')
    setCategoria(categoriaDe('leaf'))
    setTipo('hacer')
    setMomento('manana')
    setHoraMin(null)
    setMin('')
    setBuscaIcono('')
    setVerTodos(false)
    setEsSueno(false)
    setTocadoSueno(false)
    setAcostar(23 * 60)
    setDespertar(7 * 60)
    setObjetivoH(8)
    setAlarma(false)
    setAlarmaFin(false)
    setDias(TODOS_LOS_DIAS)
    setDiasFin(TODOS_LOS_DIAS)
    setPosponer(true)
    setSonido(null)
  }

  /**
   * Arrancar desde una plantilla.
   *
   * Se rellena todo —nombre, icono, momento, hora y cronómetro— y el asistente
   * se salta el paso del nombre: ya lo tiene. `tocadoSueno` se marca a mano
   * para que el detector automático no vuelva a encender el horario de sueño
   * en una plantilla que no lo es.
   */
  const aplicarPlantilla = (pl: Plantilla) => {
    confirmar()
    restablecer()
    setNombre(pl.nombre)
    setIcono(pl.icono as IconName)
    setCategoria(categoriaDe(pl.icono))
    setMomento(pl.momento)
    setTipo(pl.tipo)
    setTocadoSueno(true)
    if (pl.despertar !== undefined) {
      // Quien pone un horario de sueño quiere despertador: las dos alarmas
      // nacen encendidas y se apagan si sobran, no al revés.
      setEsSueno(true)
      setAcostar(pl.hora ?? 23 * 60)
      setDespertar(pl.despertar)
      setAlarma(true)
      setAlarmaFin(true)
    } else {
      setHoraMin(pl.hora)
      setMin(pl.minutos > 0 ? String(pl.minutos) : '')
    }
    setDesdeCero(false)
    setPaso(0)
    setEnPlantillas(false)
  }

  const empezarDeCero = () => {
    confirmar()
    restablecer()
    setDesdeCero(true)
    setPaso(0)
    setEnPlantillas(false)
  }

  /* Desde el primer paso, «atrás» devuelve a las plantillas en vez de cerrar:
     equivocarse de plantilla no debería costar salir y volver a entrar. */
  const atras = () => {
    elegir()
    if (paso === 0) setEnPlantillas(true)
    else setPaso(n => n - 1)
  }

  const siguiente = () => {
    if (!puedeSeguir) return
    if (ultimoPaso) { guardar(); return }
    elegir()
    setPaso(n => n + 1)
  }

  const borrar = () => {
    if (!existente) return
    confirmar()
    void removeHabit(existente.id)
    router.back()
  }

  const duracion = duracionMin(acostar, despertar)
  const cumple = duracion >= objetivoH * 60

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe} edges={['top']}>
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.cab}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={s.x}
                       accessibilityLabel="Cerrar sin crear">
              <Ionicons name="close" size={19} color="rgba(255,255,255,0.55)" />
            </Pressable>
            <Text style={s.cabTxt}>
              {editando || enPlantillas
                ? (editando ? 'EDITAR' : 'NUEVO HÁBITO')
                : `PASO ${paso + 1} DE ${pasos.length}`}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* La barra de progreso: cuántos pasos hay y por cuál vas. Sin ella
              el asistente parece un formulario que no se acaba nunca. */}
          {!editando && !enPlantillas && (
            <View style={s.pasos}>
              {pasos.map((clave, i) => (
                <View key={clave} style={[s.pasoBarra, i <= paso && s.pasoBarraOn]} />
              ))}
            </View>
          )}

          {/* ── PRIMERA PANTALLA: las plantillas ───────────────────────────
              Nadie llega sabiendo a qué hora quiere leer. Pedir el nombre en
              blanco obliga a decidirlo todo de cero; una plantilla trae su
              hora, su momento y su cronómetro puestos, y solo se corrige lo
              que no encaje. «Créalo desde cero» sigue ahí para quien lo
              quiera, pero deja de ser el único camino. */}
          {enPlantillas ? (
            <ScrollView style={s.flex} contentContainerStyle={s.scrollPlant}
                        showsVerticalScrollIndicator={false}>
              <Text style={s.pasoTitulo}>¿Cuál de estos?</Text>
              <Text style={s.pasoPie}>
                Vienen con su hora y su cronómetro puestos. Podrás cambiarlo todo.
              </Text>

              <View style={s.rejPlant}>
                {PLANTILLAS.map(pl => (
                  <Pressable key={pl.id} onPress={() => aplicarPlantilla(pl)}
                             style={({ pressed }) => [s.plant, pressed && s.pulsado]}
                             accessibilityLabel={`Empezar desde ${pl.nombre}`}>
                    <View style={s.plantIc}>
                      <Ionicons name={pl.icono as IconName} size={23} color="#fff" />
                    </View>
                    <Text style={s.plantNm} numberOfLines={1}>{pl.etiqueta}</Text>
                    <Text style={s.plantPie} numberOfLines={1}>{pl.resumen}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable onPress={empezarDeCero}
                         style={({ pressed }) => [s.cero, pressed && s.pulsado]}>
                <Ionicons name="add" size={19} color="#fff" />
                <Text style={s.ceroTxt}>CRÉALO DESDE CERO</Text>
              </Pressable>
            </ScrollView>
          ) : (
          <>

          {/* La pantalla ES la rejilla de iconos, y todo lo demás va como su
              cabecera. Antes la rejilla era una `FlatList` dentro de un
              `ScrollView` y React Native avisaba con razón: anidar dos listas
              con la misma orientación rompe la virtualización, así que 1 357
              iconos se montaban de golpe. Como cabecera se pasa un ELEMENTO y
              no una función: una función cambia de identidad en cada pintada y
              los campos de texto perderían el foco al escribir. */}
          <FlatList
            ref={lista}
            style={s.flex}
            data={ver('icono') ? iconos : []}
            keyExtractor={n => n}
            numColumns={6}
            initialNumToRender={42}
            windowSize={5}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!moviendoAnillo}
            keyboardShouldPersistTaps="handled"
            columnWrapperStyle={s.rejillaFila}
            contentContainerStyle={s.scroll}
            ListEmptyComponent={ver('icono')
              ? <Text style={s.sinIconos}>Ninguno se llama así</Text>
              : null}
            renderItem={({ item }) => {
              const on = icono === item
              return (
                <Pressable onPress={() => { elegir(); setIcono(item) }}
                           style={({ pressed }) => [s.iconoCaja, on && s.iconoOn, pressed && s.pulsado]}
                           accessibilityLabel={item}>
                  <Ionicons name={item} size={21} color={on ? '#fff' : 'rgba(255,255,255,0.55)'} />
                </Pressable>
              )
            }}
            ListHeaderComponent={
              <View style={s.cabecera}>

            {!editando && (
              <>
                <Text style={s.pasoTitulo}>
                  {claveActual === 'hora' && esSueno
                    ? '¿Cuándo duermes?'
                    : TITULOS[claveActual][0]}
                </Text>
                <Text style={s.pasoPie}>
                  {claveActual === 'hora' && esSueno
                    ? 'A qué hora te acuestas y a qué hora te levantas.'
                    : TITULOS[claveActual][1]}
                </Text>
              </>
            )}

            {ver('nombre') && <>
            {/* ── El nombre, como un título ─────────────────────────────── */}
            <TextInput
              value={nombre}
              onChangeText={setNombre}
              placeholder="Leer, correr, meditar…"
              placeholderTextColor="rgba(255,255,255,0.22)"
              style={s.nombre}
              maxLength={60}
              autoFocus={!editando}
              returnKeyType="done"
            />
            <View style={[s.subrayado, puedeCrear && s.subrayadoOn]} />

            {/* ── Hacer o evitar ────────────────────────────────────────── */}
            <Text style={s.rot}>QUÉ ES</Text>
            <View style={s.par}>
              {([
                ['hacer', 'HACER', 'Algo que quieres cumplir', 'checkmark-circle-outline'],
                ['evitar', 'EVITAR', 'Se cumple NO haciéndolo', 'shield-outline'],
              ] as const).map(([id, et, pie, ic]) => {
                const on = tipo === id
                return (
                  <Pressable key={id} onPress={() => { elegir(); setTipo(id) }}
                             style={({ pressed }) => [s.bloque, on && s.bloqueOn, pressed && s.pulsado]}>
                    {on && <LinearGradient colors={[ROJO_HONDO, ROJO]}
                                           start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                           style={StyleSheet.absoluteFill} />}
                    <Ionicons name={ic as IconName} size={24}
                              color={on ? '#fff' : 'rgba(255,255,255,0.6)'} />
                    <Text style={[s.bloqueNm, on && s.blancoFuerte]}>{et}</Text>
                    <Text style={[s.bloquePie, on && s.blancoSuave]} numberOfLines={2}>{pie}</Text>
                  </Pressable>
                )
              })}
            </View>

            </>}

            {ver('cuando') && <>
            {/* ── Momento del día ───────────────────────────────────────── */}
            <Text style={s.rot}>CUÁNDO</Text>
            <View style={s.trio}>
              {MOMENTOS.map(mo => {
                const on = momento === mo.id
                return (
                  <Pressable key={mo.id} onPress={() => { elegir(); setMomento(mo.id) }}
                             style={({ pressed }) => [s.bloque, s.bloqueTercio, on && s.bloqueOn, pressed && s.pulsado]}>
                    {on && <LinearGradient colors={[ROJO_HONDO, ROJO]}
                                           start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                           style={StyleSheet.absoluteFill} />}
                    <Ionicons name={mo.icono} size={24} color={on ? '#fff' : 'rgba(255,255,255,0.6)'} />
                    <Text style={[s.bloqueNm, on && s.blancoFuerte]}>{mo.titulo}</Text>
                  </Pressable>
                )
              })}
            </View>

            </>}

            {ver('hora') && <>
            {/* ── ¿Es un horario de sueño? ──────────────────────────────── */}
            <Text style={s.rot}>HORARIO DE SUEÑO</Text>
            <Pressable onPress={() => { elegir(); setTocadoSueno(true); setEsSueno(v => !v) }}
                       style={({ pressed }) => [s.interruptor, pressed && s.pulsado]}>
              <Ionicons name="bed-outline" size={22} color={esSueno ? ROJO : 'rgba(255,255,255,0.55)'} />
              <View style={{ flex: 1 }}>
                <Text style={s.interruptorNm}>Dos horas, no una</Text>
                <Text style={s.interruptorPie}>A qué hora te acuestas y a qué hora te levantas</Text>
              </View>
              <View style={[s.palanca, esSueno && s.palancaOn]}>
                <View style={[s.bolita, esSueno && s.bolitaOn]} />
              </View>
            </Pressable>

            {esSueno && (
              <View style={s.sueno}>
                <View style={s.suenoCabecera}>
                  <View style={s.suenoLado}>
                    <View style={s.suenoEt}>
                      <Ionicons name="bed" size={13} color="#6FD6E0" />
                      <Text style={s.suenoEtTxt}>HORA DE DORMIR</Text>
                    </View>
                    <Text style={s.suenoHora}>
                      {comoHora12(acostar).hora}<Text style={s.suenoAmPm}>{comoHora12(acostar).ampm}</Text>
                    </Text>
                  </View>
                  <View style={s.suenoLado}>
                    <View style={s.suenoEt}>
                      <Ionicons name="alarm" size={13} color="rgba(255,255,255,0.45)" />
                      <Text style={s.suenoEtTxt}>DESPERTAR</Text>
                    </View>
                    <Text style={s.suenoHora}>
                      {comoHora12(despertar).hora}<Text style={s.suenoAmPm}>{comoHora12(despertar).ampm}</Text>
                    </Text>
                  </View>
                </View>

                <AnilloSueno inicio={acostar} fin={despertar}
                             onArrastre={setMoviendoAnillo}
                             onChange={(i, f) => { setAcostar(i); setDespertar(f) }} />

                <Text style={s.suenoTotal}>{comoDuracion(duracion)}</Text>
                <View style={s.suenoAviso}>
                  {!cumple && <Ionicons name="alert-circle" size={15} color={ROJO} />}
                  <Text style={[s.suenoAvisoTxt, !cumple && s.suenoAvisoMal]}>
                    {cumple
                      ? 'Este horario cumple tu objetivo de dormir.'
                      : 'Este horario no cumple tu objetivo de dormir.'}
                  </Text>
                </View>

                <Text style={[s.rot, { marginTop: 20 }]}>CUÁNTO QUIERES DORMIR</Text>
                <View style={s.fichas}>
                  {[5, 6, 7, 8, 9, 10].map(n => (
                    <Pressable key={n} onPress={() => { elegir(); setObjetivoH(n) }}
                               style={({ pressed }) => [s.ficha, objetivoH === n && s.fichaOn, pressed && s.pulsado]}>
                      <Text style={[s.fichaTxt, objetivoH === n && s.blancoFuerte]}>{n} h</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* ── La hora suelta: solo cuando NO es un horario de sueño ─── */}
            {!esSueno && <>
            <Text style={s.rot}>A QUÉ HORA</Text>
            <RuedaHora
              hora={Math.floor((horaMin ?? 7 * 60) / 60)}
              minuto={(horaMin ?? 7 * 60) % 60}
              onCambio={(hh, mm) => setHoraMin(hh * 60 + mm)}
              pie={hora ? `Te avisará a las ${hora}` : 'Gira para poner la hora'}
            />
            {!!hora && (
              <Pressable onPress={() => { elegir(); setHoraMin(null) }}
                         style={({ pressed }) => [s.quitarHora, pressed && s.pulsado]}>
                <Ionicons name="close" size={15} color="rgba(255,255,255,0.55)" />
                <Text style={s.quitarTxt}>QUITAR LA HORA</Text>
              </Pressable>
            )}

            </>}

            {/* ── El cronómetro: se escribe, y los atajos solo rellenan ── */}
            {!esSueno && <>
            <Text style={s.rot}>CRONÓMETRO</Text>
            <View style={s.reloj}>
              <View style={s.relojCifras}>
                <TextInput value={min} onChangeText={t => setMin(t.replace(/\D/g, '').slice(0, 4))}
                           placeholder="0" placeholderTextColor="rgba(255,255,255,0.18)"
                           style={s.relojTxt} keyboardType="number-pad"
                           accessibilityLabel="Minutos de cronómetro" />
                <Text style={s.unidad}>MIN</Text>
              </View>
              {minutos > 0
                ? (
                  <Pressable onPress={() => { elegir(); setMin('') }} hitSlop={10} style={s.quitar}>
                    <Ionicons name="close" size={13} color="rgba(255,255,255,0.6)" />
                    <Text style={s.quitarTxt}>SIN CRONÓMETRO</Text>
                  </Pressable>
                )
                : <Text style={s.relojPie}>Cualquier cifra. 0 es sin cronómetro.</Text>}
            </View>
            <View style={[s.fichas, { marginTop: 11 }]}>
              {ATAJOS.map(n => (
                <Pressable key={n} onPress={() => { elegir(); setMin(String(n)) }}
                           style={({ pressed }) => [s.ficha, minutos === n && s.fichaOn, pressed && s.pulsado]}>
                  <Text style={[s.fichaTxt, minutos === n && s.blancoFuerte]}>{n}′</Text>
                </Pressable>
              ))}
            </View>

            </>}

            {/* ── Las alarmas ───────────────────────────────────────────── */}
            {/* Un horario de sueño tiene DOS: la que te manda a la cama y la que
                te saca de ella. Cada una con su interruptor y sus días, porque
                nadie quiere que el despertador suene el domingo. */}
            <Text style={s.rot}>{esSueno ? 'ALARMAS' : 'ALARMA'}</Text>

            <Alarma
              icono={esSueno ? 'bed-outline' : 'notifications-outline'}
              titulo={esSueno ? 'Hora de dormir' : 'Que suene'}
              hora={datos.hora}
              encendida={alarma}
              onEncender={() => { elegir(); setAlarma(v => !v) }}
              dias={dias}
              onDia={bit => { elegir(); setDias(d => alternarDia(d, bit)) }}
              onTodos={() => { elegir(); setDias(TODOS_LOS_DIAS) }}
            />

            {esSueno && (
              <View style={{ marginTop: 9 }}>
                <Alarma
                  icono="alarm-outline"
                  titulo="Despertar"
                  hora={datos.horaFin ?? null}
                  encendida={alarmaFin}
                  onEncender={() => { elegir(); setAlarmaFin(v => !v) }}
                  dias={diasFin}
                  onDia={bit => { elegir(); setDiasFin(d => alternarDia(d, bit)) }}
                  onTodos={() => { elegir(); setDiasFin(TODOS_LOS_DIAS) }}
                />
              </View>
            )}

            {(alarma || alarmaFin) && (
              <>
                {HAY_DONDE_ELEGIR ? (
                  <>
                    <Text style={s.rot}>SONIDO</Text>
                    <View style={s.fichas}>
                      {SONIDOS.map(so => (
                        <Pressable key={so.id ?? 'defecto'}
                                   onPress={() => { elegir(); setSonido(so.id) }}
                                   style={({ pressed }) => [s.ficha, sonido === so.id && s.fichaOn, pressed && s.pulsado]}>
                          <Text style={[s.fichaTxt, sonido === so.id && s.blancoFuerte]}>
                            {so.etiqueta.toUpperCase()}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : (
                  <View style={[s.interruptor, { marginTop: 9 }]}>
                    <Ionicons name="musical-note-outline" size={22} color="rgba(255,255,255,0.55)" />
                    <View style={{ flex: 1 }}>
                      <Text style={s.interruptorNm}>Sonido</Text>
                      <Text style={s.interruptorPie}>{nombreDeSonido(sonido)}</Text>
                    </View>
                  </View>
                )}

                <Pressable onPress={() => { elegir(); setPosponer(v => !v) }}
                           style={({ pressed }) => [s.interruptor, { marginTop: 9 }, pressed && s.pulsado]}>
                  <Ionicons name="play-skip-forward-outline" size={22} color="rgba(255,255,255,0.55)" />
                  <View style={{ flex: 1 }}>
                    <Text style={s.interruptorNm}>Posponer</Text>
                    <Text style={s.interruptorPie}>Añade «Posponer 10 min» al aviso</Text>
                  </View>
                  <View style={[s.palanca, posponer && s.palancaOn]}>
                    <View style={[s.bolita, posponer && s.bolitaOn]} />
                  </View>
                </Pressable>

                {/* Se dice lo que hay. Sonar con el móvil en silencio pide un
                    permiso especial de Apple que esta app no tiene, y fingirlo
                    con un control que no hace nada sería peor. */}
                <Text style={s.letraChica}>
                  Suena como aviso de tiempo sensible. Con el teléfono en silencio
                  o en modo concentración, iOS puede callarlo.
                </Text>
              </>
            )}

            </>}

            {ver('icono') && <>
            {/* ── El icono: los 1 300 de Ionicons, con buscador ─────────── */}
            <Text style={s.rot}>ICONO</Text>
            <View style={s.buscador}>
              <Ionicons name="search" size={17} color="rgba(255,255,255,0.35)" />
              <TextInput value={buscaIcono} onChangeText={setBuscaIcono}
                         placeholder="Buscar"
                         placeholderTextColor="rgba(255,255,255,0.3)"
                         style={s.buscadorTxt} autoCapitalize="none" autoCorrect={false} />
              {!!buscaIcono && (
                <Pressable onPress={() => setBuscaIcono('')} hitSlop={10}>
                  <Ionicons name="close-circle" size={17} color="rgba(255,255,255,0.35)" />
                </Pressable>
              )}
            </View>
            {!buscaIcono && (
              <>
                <View style={[s.fichas, { marginTop: 12 }]}>
                  {CATEGORIAS.map(c => {
                    const on = !verTodos && categoria === c.id
                    return (
                      <Pressable key={c.id}
                                 onPress={() => { elegir(); setCategoria(c.id); setVerTodos(false) }}
                                 style={({ pressed }) => [s.cat, on && s.catOn, pressed && s.pulsado]}>
                        <Text style={[s.catTxt, on && s.blancoFuerte]}>{c.etiqueta}</Text>
                      </Pressable>
                    )
                  })}
                </View>
                <Pressable onPress={() => { elegir(); setVerTodos(v => !v) }}
                           style={({ pressed }) => [s.verTodos, pressed && s.pulsado]}>
                  <Ionicons name={verTodos ? 'chevron-up' : 'chevron-down'} size={15}
                            color="rgba(255,255,255,0.55)" />
                  <Text style={s.verTodosTxt}>
                    {verTodos ? 'VER SOLO LA CATEGORÍA' : `VER LOS ${TODOS_LOS_ICONOS.length}`}
                  </Text>
                </Pressable>
              </>
            )}
            </>}
              </View>
            }
          />

          <View style={s.pie}>
            {editando ? (
              <>
                <Pressable onPress={borrar}
                           style={({ pressed }) => [s.borrar, pressed && s.pulsado]}>
                  <Ionicons name="trash-outline" size={17} color={ROJO} />
                  <Text style={s.borrarTxt}>ELIMINAR HÁBITO</Text>
                </Pressable>
                <Pressable onPress={guardar} disabled={!puedeCrear}
                           style={({ pressed }) => [s.crear, !puedeCrear && s.crearOff, pressed && s.pulsado]}>
                  <Ionicons name="checkmark" size={21} color="#fff" />
                  <Text style={s.crearTxt}>GUARDAR</Text>
                </Pressable>
              </>
            ) : (
              /* Dos botones en fila. «Atrás» no ocupa lo mismo que «siguiente»:
                 el que hace avanzar manda, y el de volver no debería competir
                 por el pulgar con él. */
              <View style={s.fila}>
                <Pressable onPress={atras}
                           style={({ pressed }) => [s.atras, pressed && s.pulsado]}
                           accessibilityLabel={paso === 0 ? 'Volver a las plantillas' : 'Paso anterior'}>
                  <Ionicons name="chevron-back" size={19} color="rgba(255,255,255,0.6)" />
                  <Text style={s.atrasTxt}>ATRÁS</Text>
                </Pressable>
                <Pressable onPress={siguiente} disabled={!puedeSeguir}
                           style={({ pressed }) => [s.crear, s.flex, !puedeSeguir && s.crearOff, pressed && s.pulsado]}>
                  <Ionicons name={ultimoPaso ? 'add' : 'chevron-forward'} size={21} color="#fff" />
                  <Text style={s.crearTxt}>{ultimoPaso ? 'CREAR HÁBITO' : 'SIGUIENTE'}</Text>
                </Pressable>
              </View>
            )}
          </View>

          </>
          )}

        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

/** El encabezado de cada paso del asistente. */
const TITULOS = {
  nombre: ['¿Qué quieres hacer?', 'Ponle el nombre con el que lo reconocerás.'],
  cuando: ['¿Cuándo lo harás?', 'Sirve para agruparlo en la lista del día.'],
  hora:   ['¿A qué hora?', 'Puedes dejarlo sin hora y hacerlo cuando puedas.'],
  icono:  ['Elige un icono', 'Es lo que verás en la tarjeta.'],
} as const

const DIAS_ET = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

/**
 * Una alarma: su interruptor y sus días.
 *
 * Los días se enseñan SIEMPRE, encendida o no, para que se vea de un vistazo
 * cuándo va a sonar sin tener que encenderla para averiguarlo. Apagada se
 * atenúan, que es lo que son: la configuración de algo que ahora no suena.
 */
function Alarma({ icono, titulo, hora, encendida, onEncender, dias, onDia, onTodos }: {
  icono: IconName
  titulo: string
  hora: string | null
  encendida: boolean
  onEncender: () => void
  dias: number
  onDia: (bit: number) => void
  onTodos: () => void
}) {
  const todos = dias === TODOS_LOS_DIAS
  return (
    <View style={[s.alarma, encendida && s.alarmaOn]}>
      <Pressable onPress={onEncender} style={({ pressed }) => [s.alarmaCab, pressed && s.pulsado]}>
        <Ionicons name={icono} size={22} color={encendida ? ROJO : 'rgba(255,255,255,0.55)'} />
        <View style={{ flex: 1 }}>
          <Text style={s.interruptorNm}>{titulo}</Text>
          <Text style={s.interruptorPie}>
            {hora ? `A las ${hora}` : 'Ponle una hora para poder sonar'}
          </Text>
        </View>
        <View style={[s.palanca, encendida && s.palancaOn]}>
          <View style={[s.bolita, encendida && s.bolitaOn]} />
        </View>
      </Pressable>

      <View style={[s.dias, !encendida && s.diasOff]}>
        {DIAS_ET.map((et, bit) => {
          const on = diaActivo(dias, bit)
          return (
            <Pressable key={bit} onPress={() => onDia(bit)} disabled={!encendida}
                       style={({ pressed }) => [s.dia, on && s.diaOn, pressed && s.pulsado]}
                       accessibilityLabel={`${et}, ${on ? 'suena' : 'no suena'}`}>
              <Text style={[s.diaTxt, on && s.diaTxtOn]}>{et}</Text>
            </Pressable>
          )
        })}
        <Pressable onPress={onTodos} disabled={!encendida || todos}
                   style={({ pressed }) => [s.todos, todos && s.todosOff, pressed && s.pulsado]}>
          <Text style={[s.diaTxt, todos && s.diaTxtApagado]}>
            {todos ? 'TODA LA SEMANA' : 'TODOS'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08080A' },
  safe: { flex: 1 },
  flex: { flex: 1 },
  pulsado: { opacity: 0.8 },
  blancoFuerte: { color: '#fff' },
  blancoSuave: { color: 'rgba(255,255,255,0.82)' },

  cab: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
  },
  x: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  cabTxt: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 14, letterSpacing: 3.4,
    color: 'rgba(255,255,255,0.55)',
  },

  scroll: { paddingBottom: 34 },

  nombre: {
    fontFamily: 'Inter_800ExtraBold', fontSize: 28, color: '#fff',
    letterSpacing: -0.6, paddingTop: 22, paddingBottom: 12,
  },
  // Un filete que se enciende al escribir. Sin caja: el nombre es el título de
  // la pantalla, no un campo más de un formulario.
  subrayado: { height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.10)' },
  subrayadoOn: { backgroundColor: ROJO },

  rot: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 12, letterSpacing: 3,
    color: 'rgba(255,255,255,0.38)', marginTop: 28, marginBottom: 11,
  },

  par: { flexDirection: 'row', gap: 11 },
  trio: { flexDirection: 'row', gap: 9 },
  bloque: {
    flex: 1, borderRadius: 20, overflow: 'hidden',
    paddingVertical: 16, paddingHorizontal: 12, gap: 7, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  bloqueTercio: { paddingVertical: 18 },
  bloqueOn: { borderColor: 'transparent' },
  bloqueNm: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 16, letterSpacing: 2,
    color: 'rgba(255,255,255,0.85)',
  },
  bloquePie: {
    fontFamily: 'Inter_400Regular', fontSize: 11.5, lineHeight: 15,
    color: 'rgba(255,255,255,0.38)', textAlign: 'center',
  },

  reloj: {
    borderRadius: 22, paddingVertical: 20, alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  relojCifras: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  relojTxt: {
    fontFamily: 'Inter_800ExtraBold', fontSize: 44, color: '#fff',
    letterSpacing: -1.5, textAlign: 'center', minWidth: 62, padding: 0,
    fontVariant: ['tabular-nums'],
  },
  relojDosPuntos: {
    fontFamily: 'Inter_800ExtraBold', fontSize: 40,
    color: 'rgba(255,255,255,0.28)', marginTop: -4,
  },
  relojPie: {
    fontFamily: 'Inter_400Regular', fontSize: 12.5, color: 'rgba(255,255,255,0.32)',
  },
  quitar: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  quitarTxt: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 11, letterSpacing: 1.6,
    color: 'rgba(255,255,255,0.6)',
  },

  unidad: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 18, letterSpacing: 2.4,
    color: 'rgba(255,255,255,0.4)', marginLeft: 8, marginTop: 12,
  },
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    height: 48, borderRadius: 15, paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  buscadorTxt: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14.5, color: '#fff', padding: 0 },
  cabecera: { paddingHorizontal: 20, marginBottom: 10 },
  rejillaFila: { gap: 9, marginBottom: 9, paddingHorizontal: 20 },
  sinIconos: {
    fontFamily: 'Inter_400Regular', fontSize: 13.5,
    color: 'rgba(255,255,255,0.32)', paddingTop: 14,
  },
  fichas: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  cat: {
    height: 34, paddingHorizontal: 13, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  catOn: { backgroundColor: ROJO, borderColor: 'transparent' },
  catTxt: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 12.5, letterSpacing: 1,
    color: 'rgba(255,255,255,0.6)',
  },
  verTodos: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 46, borderRadius: 15, marginTop: 11,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  verTodosTxt: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 13.5, letterSpacing: 1.6,
    color: 'rgba(255,255,255,0.55)',
  },
  quitarHora: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 46, borderRadius: 15, marginTop: 11,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  ficha: {
    minWidth: 58, height: 46, borderRadius: 15, paddingHorizontal: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  fichaOn: { backgroundColor: ROJO, borderColor: 'transparent' },
  fichaTxt: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 15, letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.6)',
  },

  iconoCaja: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  iconoOn: { backgroundColor: ROJO, borderColor: 'transparent' },

  interruptor: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    borderRadius: 18, padding: 15,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  interruptorNm: { fontFamily: 'Inter_600SemiBold', fontSize: 15.5, color: '#fff' },
  interruptorPie: {
    fontFamily: 'Inter_400Regular', fontSize: 12.5,
    color: 'rgba(255,255,255,0.35)', marginTop: 2,
  },
  palanca: {
    width: 50, height: 30, borderRadius: 15, padding: 3,
    backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center',
  },
  palancaOn: { backgroundColor: ROJO },
  bolita: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  bolitaOn: { alignSelf: 'flex-end' },

  sueno: {
    marginTop: 12, borderRadius: 24, paddingVertical: 18, paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  suenoCabecera: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
  suenoLado: { alignItems: 'center', gap: 4 },
  suenoEt: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  suenoEtTxt: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 11, letterSpacing: 1.8,
    color: 'rgba(255,255,255,0.45)',
  },
  suenoHora: {
    fontFamily: 'Inter_800ExtraBold', fontSize: 28, color: '#fff',
    letterSpacing: -0.8, fontVariant: ['tabular-nums'],
  },
  suenoAmPm: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 14, letterSpacing: 1,
    color: 'rgba(255,255,255,0.55)',
  },
  suenoTotal: {
    fontFamily: 'Inter_800ExtraBold', fontSize: 26, color: '#fff',
    textAlign: 'center', marginTop: 6,
  },
  suenoAviso: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 5, paddingHorizontal: 10,
  },
  suenoAvisoTxt: {
    fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center',
    color: 'rgba(255,255,255,0.42)',
  },
  suenoAvisoMal: { color: 'rgba(255,255,255,0.75)' },

  letraChica: {
    fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17,
    color: 'rgba(255,255,255,0.32)', marginTop: 10, paddingHorizontal: 2,
  },

  alarma: {
    borderRadius: 18, padding: 15,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  alarmaOn: { borderColor: 'rgba(255,31,61,0.4)' },
  alarmaCab: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  dias: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  diasOff: { opacity: 0.35 },
  dia: {
    width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  diaOn: { backgroundColor: ROJO, borderColor: 'transparent' },
  diaTxt: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 14, letterSpacing: 1,
    color: 'rgba(255,255,255,0.55)',
  },
  diaTxtOn: { color: '#fff' },
  diaTxtApagado: { color: 'rgba(255,255,255,0.32)' },
  todos: {
    height: 36, paddingHorizontal: 12, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  todosOff: { opacity: 0.5 },

  /* ── El asistente ─────────────────────────────────────────────────── */
  pasos: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 16 },
  pasoBarra: {
    flex: 1, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  pasoBarraOn: { backgroundColor: ROJO },
  pasoTitulo: {
    fontFamily: 'Inter_800ExtraBold', fontSize: 27, color: '#fff',
    letterSpacing: -0.7, lineHeight: 32, marginTop: 16,
  },
  pasoPie: {
    fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20,
    color: 'rgba(255,255,255,0.42)', marginTop: 6,
  },

  /* ── Las plantillas ───────────────────────────────────────────────── */
  scrollPlant: { paddingHorizontal: 20, paddingBottom: 30 },
  rejPlant: { flexDirection: 'row', flexWrap: 'wrap', gap: 11, marginTop: 26 },
  plant: {
    width: '47.6%', flexGrow: 1, borderRadius: 20, padding: 15, gap: 3,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  plantIc: {
    width: 44, height: 44, borderRadius: 15, marginBottom: 9,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,31,61,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.28)',
  },
  plantNm: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 17, letterSpacing: 1.6, color: '#fff',
  },
  plantPie: {
    fontFamily: 'Inter_400Regular', fontSize: 12.5, color: 'rgba(255,255,255,0.4)',
  },
  cero: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    height: 56, borderRadius: 19, marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)',
  },
  ceroTxt: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 15.5, letterSpacing: 2.2, color: '#fff',
  },

  pie: { paddingHorizontal: 20, paddingBottom: 14, paddingTop: 8, gap: 10 },
  fila: { flexDirection: 'row', gap: 10 },
  atras: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    height: 62, paddingHorizontal: 21, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)',
  },
  atrasTxt: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 14.5, letterSpacing: 2,
    color: 'rgba(255,255,255,0.6)',
  },
  borrar: {
    height: 48, borderRadius: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(255,31,61,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.35)',
  },
  borrarTxt: { fontFamily: 'Rajdhani_700Bold', fontSize: 14, letterSpacing: 2, color: ROJO },
  crear: {
    height: 62, borderRadius: 20, backgroundColor: ROJO,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: ROJO, shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 10 },
  },
  crearOff: { backgroundColor: 'rgba(255,255,255,0.08)', shadowOpacity: 0 },
  crearTxt: { fontFamily: 'Rajdhani_700Bold', fontSize: 18, letterSpacing: 3, color: '#fff' },
})
