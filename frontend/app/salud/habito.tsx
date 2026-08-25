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

import { useEffect, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView,
  Platform, FlatList,
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
  const [hh, setHh] = useState(existente?.hora?.slice(0, 2) ?? '')
  const [mm, setMm] = useState(existente?.hora?.slice(3, 5) ?? '')
  const [min, setMin] = useState(
    existente?.metaSegundos && !existente.horaFin ? String(Math.round(existente.metaSegundos / 60)) : '')
  const [buscaIcono, setBuscaIcono] = useState('')
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

  const h = Number(hh), m = Number(mm)
  const horaValida = hh !== '' && mm !== '' && h >= 0 && h <= 23 && m >= 0 && m <= 59
  const hora = horaValida ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` : null
  const minutos = Math.min(MINUTOS_MAX, Number(min) || 0)
  const puedeCrear = nombre.trim().length > 0

  const iconos = useMemo(() => {
    const q = buscaIcono.trim().toLowerCase()
    return q ? TODOS_LOS_ICONOS.filter(n => n.includes(q)) : TODOS_LOS_ICONOS
  }, [buscaIcono])

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
            <Text style={s.cabTxt}>{editando ? 'EDITAR' : 'NUEVO HÁBITO'}</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* La pantalla ES la rejilla de iconos, y todo lo demás va como su
              cabecera. Antes la rejilla era una `FlatList` dentro de un
              `ScrollView` y React Native avisaba con razón: anidar dos listas
              con la misma orientación rompe la virtualización, así que 1 357
              iconos se montaban de golpe. Como cabecera se pasa un ELEMENTO y
              no una función: una función cambia de identidad en cada pintada y
              los campos de texto perderían el foco al escribir. */}
          <FlatList
            style={s.flex}
            data={iconos}
            keyExtractor={n => n}
            numColumns={6}
            initialNumToRender={42}
            windowSize={5}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!moviendoAnillo}
            keyboardShouldPersistTaps="handled"
            columnWrapperStyle={s.rejillaFila}
            contentContainerStyle={s.scroll}
            ListEmptyComponent={<Text style={s.sinIconos}>Ninguno se llama así</Text>}
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

            {/* ── El nombre, como un título ─────────────────────────────── */}
            <TextInput
              value={nombre}
              onChangeText={setNombre}
              placeholder="¿Qué quieres hacer?"
              placeholderTextColor="rgba(255,255,255,0.22)"
              style={s.nombre}
              maxLength={60}
              autoFocus
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
            <View style={s.reloj}>
              <View style={s.relojCifras}>
                <TextInput value={hh} onChangeText={t => setHh(t.replace(/\D/g, ''))}
                           placeholder="--" placeholderTextColor="rgba(255,255,255,0.18)"
                           style={s.relojTxt} keyboardType="number-pad" maxLength={2}
                           accessibilityLabel="Hora" />
                <Text style={s.relojDosPuntos}>:</Text>
                <TextInput value={mm} onChangeText={t => setMm(t.replace(/\D/g, ''))}
                           placeholder="--" placeholderTextColor="rgba(255,255,255,0.18)"
                           style={s.relojTxt} keyboardType="number-pad" maxLength={2}
                           accessibilityLabel="Minutos" />
              </View>
              {hora
                ? (
                  <Pressable onPress={() => { elegir(); setHh(''); setMm('') }} hitSlop={10}
                             style={s.quitar}>
                    <Ionicons name="close" size={13} color="rgba(255,255,255,0.6)" />
                    <Text style={s.quitarTxt}>QUITAR</Text>
                  </Pressable>
                )
                : <Text style={s.relojPie}>Sin hora no hay recordatorio</Text>}
            </View>

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

            {/* ── El icono: los 1 300 de Ionicons, con buscador ─────────── */}
            <Text style={s.rot}>ICONO</Text>
            <View style={s.buscador}>
              <Ionicons name="search" size={17} color="rgba(255,255,255,0.35)" />
              <TextInput value={buscaIcono} onChangeText={setBuscaIcono}
                         placeholder={`Buscar entre ${TODOS_LOS_ICONOS.length} iconos`}
                         placeholderTextColor="rgba(255,255,255,0.3)"
                         style={s.buscadorTxt} autoCapitalize="none" autoCorrect={false} />
              {!!buscaIcono && (
                <Pressable onPress={() => setBuscaIcono('')} hitSlop={10}>
                  <Ionicons name="close-circle" size={17} color="rgba(255,255,255,0.35)" />
                </Pressable>
              )}
            </View>
              </View>
            }
          />

          <View style={s.pie}>
            {editando && (
              <Pressable onPress={borrar}
                         style={({ pressed }) => [s.borrar, pressed && s.pulsado]}>
                <Ionicons name="trash-outline" size={17} color={ROJO} />
                <Text style={s.borrarTxt}>ELIMINAR HÁBITO</Text>
              </Pressable>
            )}
            <Pressable onPress={guardar} disabled={!puedeCrear}
                       style={({ pressed }) => [s.crear, !puedeCrear && s.crearOff, pressed && s.pulsado]}>
              <Ionicons name={editando ? "checkmark" : "add"} size={21} color="#fff" />
              <Text style={s.crearTxt}>{editando ? 'GUARDAR' : 'CREAR HÁBITO'}</Text>
            </Pressable>
          </View>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

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

  pie: { paddingHorizontal: 20, paddingBottom: 14, paddingTop: 8, gap: 10 },
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
