/**
 * HISTORIAL
 * ─────────
 * Todo lo entrenado, del servidor. No del teléfono: el historial sobrevive a
 * cambiar de móvil, que es justo lo que no hacía la versión anterior.
 *
 * ── Rehecho con el sistema de la sección ────────────────────────────────────
 * Antes era una lista plana de filas donde TODAS llevaban el mismo icono de
 * mancuerna. Un historial así obliga a leer el título de cada fila para
 * distinguir el día de pierna del de espalda, y a los dos meses son cuarenta
 * filas idénticas que nadie repasa.
 *
 * Ahora hay jerarquía: el último entrenamiento ocupa una pieza grande sobre
 * fotografía —es el que se mira, el que se acaba de hacer— y los demás llevan
 * las MINIATURAS REALES de sus ejercicios. Se reconoce lo que se hizo sin leer.
 *
 * ── La portada respeta el filtro ────────────────────────────────────────────
 * Al filtrar por «en casa», la pieza grande pasa a ser el último entrenamiento
 * en casa. Si se quedara fija enseñando el último de todos, el filtro parecería
 * roto: se pide una cosa y arriba sigue mandando otra.
 *
 * ── Se pagina ───────────────────────────────────────────────────────────────
 * Veinte de golpe y más al llegar abajo. Un año de entrenamiento son
 * doscientas sesiones y traerlas todas para enseñar las cinco primeras es
 * gastar la conexión de alguien en datos que no va a mirar.
 */

import { useState, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native'
import { Image } from '@/components/ui/Imagen'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { CabeceraSeccion } from '@/components/workout/MenuSeccion'
import { Vacio } from '@/components/workout/Charts'
import { MazoMiniaturas } from '@/components/workout/Miniatura'
import { listarSesiones, Sesion, Modo } from '@/services/sessionService'
import { kilosCorto, minutosCorto, desdeCuando } from '@/services/statsService'
import { FOTOS, FOTO_MODO } from '@/constants/imagenes'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

const PAGINA = 20

const MODOS: { id: Modo | null; label: string; icono: keyof typeof Ionicons.glyphMap }[] = [
  { id: null, label: 'Todo', icono: 'apps-outline' },
  { id: 'gym', label: 'Gimnasio', icono: 'barbell-outline' },
  { id: 'home', label: 'En casa', icono: 'home-outline' },
  { id: 'outdoor', label: 'Aire libre', icono: 'trail-sign-outline' },
  { id: 'class', label: 'Clases', icono: 'play-circle-outline' },
]

const ICONO: Record<string, keyof typeof Ionicons.glyphMap> = {
  gym: 'barbell-outline', home: 'home-outline',
  outdoor: 'trail-sign-outline', class: 'play-circle-outline',
}

const NOMBRE_MODO: Record<string, string> = {
  gym: 'Gimnasio', home: 'En casa', outdoor: 'Aire libre', class: 'Clase',
}

/** La foto de portada de una sesión, por su modo. */
const fotoDeSesion = (modo: string) => FOTOS[FOTO_MODO[modo] ?? 'gimnasio'].fuente

/**
 * «Miércoles, 12 de agosto».
 *
 * Solo la PRIMERA letra en mayúscula, a mano. El `textTransform: 'capitalize'`
 * de CSS pone en mayúscula cada palabra y en español eso escribe «Miércoles, 12
 * De Agosto», que está mal: ni los meses ni las preposiciones se capitalizan.
 * Es una regla del inglés aplicada a otro idioma.
 */
/**
 * La duración, partida en cifra y unidad.
 *
 * Pasa a horas al llegar a sesenta minutos, como el cronómetro de la sesión.
 * «209 min» es correcto y no se entiende: nadie piensa su entrenamiento en
 * doscientos minutos, lo piensa en tres horas y media.
 */
const duracionPartida = (min: number): [string, string] =>
  min >= 60 ? [minutosCorto(min), 'entrenando'] : [String(min), 'min']

const fechaLarga = (iso: string) => {
  const t = new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export default function Historial() {
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [total, setTotal] = useState(0)
  /* Se llega desde la portada de un lugar, así que el historial abre ya
     filtrado por ese lugar. Valor de ARRANQUE y nada más: las pastillas de
     arriba siguen mandando, y quitar el filtro no lo devuelve solo. */
  const { mode } = useLocalSearchParams<{ mode?: string }>()
  const [modo, setModo] = useState<Modo | null>(
    mode === 'gym' || mode === 'home' || mode === 'outdoor' || mode === 'class' ? mode : null,
  )
  const [cargando, setCargando] = useState(true)
  const [trayendo, setTrayendo] = useState(false)
  const [refrescando, setRefrescando] = useState(false)

  const cargar = useCallback(async (m: Modo | null, offset: number) => {
    try {
      const r = await listarSesiones({ mode: m ?? undefined, limit: PAGINA, offset })
      setTotal(r.total)
      setSesiones(prev => offset === 0 ? r.sessions : [...prev, ...r.sessions])
    } catch {
      if (offset === 0) setSesiones([])
    } finally {
      setCargando(false)
      setTrayendo(false)
      setRefrescando(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { void cargar(modo, 0) }, [cargar, modo]))

  const masAbajo = () => {
    if (trayendo || sesiones.length >= total) return
    setTrayendo(true)
    void cargar(modo, sesiones.length)
  }

  /**
   * La pieza grande y el resto.
   *
   * La primera de la lista ES la más reciente —el servidor ordena por fecha
   * descendente—, así que sale de la portada y no se repite abajo. Repetirla
   * haría que el mismo entrenamiento apareciera dos veces en la misma pantalla.
   */
  const [ultima, ...resto] = sesiones

  /**
   * Las cifras de lo que se ha traído, no de toda la vida.
   *
   * Se dice explícitamente en el pie —«de los N que ves»— porque sumar solo las
   * veinte primeras y presentarlo como el total sería un número falso. Las
   * estadísticas de verdad tienen su pantalla y las calcula el servidor sobre
   * todo el historial.
   */
  const cifras = useMemo(() => {
    const minutos = Math.round(
      sesiones.reduce((a, s) => a + (s.duration_seconds ?? 0), 0) / 60,
    )
    const kilos = sesiones.reduce((a, s) => a + Number(s.total_volume_kg ?? 0), 0)
    const series = sesiones.reduce((a, s) => a + (s.total_sets ?? 0), 0)
    return { minutos, kilos, series }
  }, [sesiones])

  return (
    <Screen>
      <CabeceraSeccion
        titulo="Historial"
        subtitulo={total > 0 ? `${total} ${total === 1 ? 'entrenamiento' : 'entrenamientos'}` : undefined}
      />

      <View style={s.filtros}>
        {MODOS.map(m => (
          <TouchableOpacity
            key={m.label}
            style={[s.filtro, modo === m.id && s.filtroOn]}
            onPress={() => { void Haptics.selectionAsync(); setModo(m.id); setCargando(true) }}
            activeOpacity={0.85}
          >
            <Ionicons name={m.icono} size={13} color={modo === m.id ? Colors.neon.white : Colors.neon.w3} />
            <Text style={[s.filtroTxt, modo === m.id && s.filtroTxtOn]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {cargando ? (
        <View style={s.cargando}><ActivityIndicator color={Colors.neon.w3} /></View>
      ) : (
        <FlatList
          data={resto}
          keyExtractor={x => x.id}
          contentContainerStyle={{ padding: Spacing[4], paddingBottom: 110, gap: Spacing[2] }}
          onEndReached={masAbajo}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refrescando}
              onRefresh={() => { setRefrescando(true); void cargar(modo, 0) }}
              tintColor={Colors.neon.w3} />
          }
          ListHeaderComponent={
            ultima ? (
              <View style={{ gap: Spacing[3], marginBottom: Spacing[2] }}>
                <Portada sesion={ultima} />

                {/* La tira de totales solo cuando hay algo que TOTALIZAR.
                    Con un único entrenamiento repite cifra por cifra lo que ya
                    dice la portada justo encima, y dos filas idénticas seguidas
                    parecen un fallo aunque los dos números sean correctos. */}
                {sesiones.length > 1 && (
                  <Animated.View entering={FadeInDown.delay(80).duration(360)} style={s.cifras}>
                    <Cifra valor={String(sesiones.length)} etiqueta="sesiones" />
                    <View style={s.cifraSep} />
                    <Cifra valor={minutosCorto(cifras.minutos)} etiqueta="entrenando" />
                    <View style={s.cifraSep} />
                    <Cifra
                      valor={cifras.kilos > 0 ? kilosCorto(cifras.kilos) : `${cifras.series}`}
                      etiqueta={cifras.kilos > 0 ? 'movidos' : 'series'}
                    />
                  </Animated.View>
                )}

                {resto.length > 0 && <Text style={s.seccion}>ANTES DE ESO</Text>}
              </View>
            ) : null
          }
          ListEmptyComponent={
            // Solo cuando NO hay ni portada: con una sesión sola, la portada ya
            // la enseña y un «no hay nada» debajo sería mentira.
            ultima ? null : (
              <Vacio texto={modo
                ? 'Nada de este tipo todavía.'
                : 'Sin entrenamientos registrados. El primero empieza en la portada de Entrena.'} />
            )
          }
          ListFooterComponent={
            trayendo
              ? <ActivityIndicator style={{ marginVertical: Spacing[4] }} size="small" color={Colors.neon.w3} />
              // La nota acompaña a la tira de totales, así que aparece con las
              // mismas condiciones: hay más de uno y ya están todos traídos.
              : sesiones.length > 1 && sesiones.length >= total
                ? <Text style={s.pie}>
                    Las cifras de arriba son de los {sesiones.length} entrenamientos
                    que ves. El total de siempre está en Progreso.
                  </Text>
                : null
          }
          renderItem={({ item, index }) => <Tarjeta sesion={item} indice={index} />}
        />
      )}
    </Screen>
  )
}

/**
 * El último entrenamiento, en grande y sobre su fotografía.
 *
 * Es el que se acaba de hacer y el que se quiere mirar: merece el tamaño. La
 * foto sale del MODO y no de los ejercicios porque es lo que distingue de un
 * golpe una sesión de gimnasio de una en casa, que es la primera pregunta que
 * uno se hace al repasar su historial.
 */
function Portada({ sesion }: { sesion: Sesion }) {
  const min = Math.round((sesion.duration_seconds ?? 0) / 60)
  const kilos = Number(sesion.total_volume_kg ?? 0)

  return (
    <Animated.View entering={FadeIn.duration(420)}>
      <TouchableOpacity
        style={s.portada}
        onPress={() => router.push(`/workout/session/${sesion.id}`)}
        activeOpacity={0.9}
      >
        <Image
          source={fotoDeSesion(sesion.mode)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={300}
        />
        <LinearGradient
          colors={['rgba(5,5,6,0.25)', 'rgba(5,5,6,0.72)', 'rgba(5,5,6,0.97)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={s.portadaDentro}>
          <View style={s.etiqueta}>
            <Ionicons name={ICONO[sesion.mode] ?? 'barbell-outline'} size={12} color={Colors.neon.void} />
            <Text style={s.etiquetaTxt}>EL ÚLTIMO · {desdeCuando(sesion.started_at).toUpperCase()}</Text>
          </View>

          <View style={{ gap: Spacing[3] }}>
            <View>
              <Text style={s.portadaTitulo} numberOfLines={2}>{sesion.title}</Text>
              <Text style={s.portadaFecha}>
                {fechaLarga(sesion.started_at)} · {NOMBRE_MODO[sesion.mode] ?? sesion.mode}
              </Text>
            </View>

            {(sesion.posters?.length ?? 0) > 0 && (
              <MazoMiniaturas posters={sesion.posters ?? []} tam={44} />
            )}

            <View style={s.portadaDatos}>
              {min > 0 && <DatoGrande valor={duracionPartida(min)[0]} unidad={duracionPartida(min)[1]} />}
              {sesion.total_sets > 0 && (
                <DatoGrande valor={String(sesion.total_sets)} unidad={sesion.total_sets === 1 ? 'serie' : 'series'} />
              )}
              {kilos > 0 && <DatoGrande valor={kilosCorto(kilos)} unidad="movidos" />}
              {sesion.distance_m ? (
                <DatoGrande valor={(sesion.distance_m / 1000).toFixed(1).replace('.', ',')} unidad="km" />
              ) : null}
              {/* Las sesiones de antes del estimador no tienen cifra, y en ese
                  caso NO se pinta un cero: un cero dice «no gastaste nada» y lo
                  que pasa es «no se sabe». */}
              {sesion.calories_kcal ? (
                <DatoGrande valor={String(sesion.calories_kcal)} unidad="kcal" />
              ) : null}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

function DatoGrande({ valor, unidad }: { valor: string; unidad: string }) {
  return (
    <View style={s.datoGrande}>
      <Text style={s.datoGrandeValor}>{valor}</Text>
      <Text style={s.datoGrandeUnidad}>{unidad}</Text>
    </View>
  )
}

function Cifra({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={s.cifraValor} numberOfLines={1}>{valor}</Text>
      <Text style={s.cifraEtiqueta}>{etiqueta}</Text>
    </View>
  )
}

function Tarjeta({ sesion, indice }: { sesion: Sesion; indice: number }) {
  const min = Math.round((sesion.duration_seconds ?? 0) / 60)
  const fecha = new Date(sesion.started_at)
  const posters = sesion.posters ?? []

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(indice * 40, 320)).duration(320)}>
      <TouchableOpacity
        style={s.tarjeta}
        onPress={() => router.push(`/workout/session/${sesion.id}`)}
        activeOpacity={0.85}
      >
        {/* Las miniaturas de VERDAD donde antes iba un icono genérico. Cuando
            no hay ninguna —una sesión sin series del catálogo— vuelve el icono
            del modo, que al menos dice dónde se entrenó. */}
        {posters.length > 0 ? (
          <MazoMiniaturas posters={posters} tam={40} max={3} />
        ) : (
          <View style={s.icono}>
            <Ionicons name={ICONO[sesion.mode] ?? 'barbell-outline'} size={17} color={Colors.neon.w2} />
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={s.titulo} numberOfLines={1}>{sesion.title}</Text>
          <Text style={s.sub}>
            {fecha.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
            {' · '}{desdeCuando(sesion.started_at)}
          </Text>

          <View style={s.datos}>
            {sesion.total_sets > 0 && <Dato texto={`${sesion.total_sets} ${sesion.total_sets === 1 ? 'serie' : 'series'}`} />}
            {min > 0 && <Dato texto={minutosCorto(min)} />}
            {Number(sesion.total_volume_kg) > 0 && <Dato texto={kilosCorto(Number(sesion.total_volume_kg))} />}
            {sesion.distance_m ? <Dato texto={`${(sesion.distance_m / 1000).toFixed(1).replace('.', ',')} km`} /> : null}
            {sesion.calories_kcal ? <Dato texto={`${sesion.calories_kcal} kcal`} /> : null}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={16} color={Colors.neon.w4} />
      </TouchableOpacity>
    </Animated.View>
  )
}

const Dato = ({ texto }: { texto: string }) => (
  <View style={s.dato}><Text style={s.datoTxt}>{texto}</Text></View>
)

const s = StyleSheet.create({
  filtros: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2],
    paddingHorizontal: Spacing[4], paddingBottom: Spacing[3],
  },
  filtro: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing[3], paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.neon.edge,
    backgroundColor: Colors.neon.pane,
  },
  filtroOn: { borderColor: 'rgba(255,31,61,0.45)', backgroundColor: Colors.neon.redDim },
  filtroTxt: { fontSize: 11, fontWeight: '700', color: Colors.neon.w3 },
  filtroTxtOn: { color: Colors.neon.white },

  cargando: { paddingVertical: Spacing[8], alignItems: 'center' },

  // ── Portada ────────────────────────────────────────────────────────────────
  portada: {
    height: 320, borderRadius: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: Colors.neon.void,
  },
  portadaDentro: { flex: 1, justifyContent: 'space-between', padding: Spacing[4] },
  etiqueta: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: Spacing[3], paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  etiquetaTxt: { fontSize: 9, fontWeight: '800', color: Colors.neon.void, letterSpacing: 1 },
  portadaTitulo: {
    fontSize: 27, fontWeight: '800', color: Colors.neon.white,
    letterSpacing: -0.7, lineHeight: 31,
  },
  portadaFecha: { fontSize: 12, color: Colors.neon.w2, marginTop: 3 },

  portadaDatos: { flexDirection: 'row', gap: Spacing[4] },
  datoGrande: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  datoGrandeValor: { fontSize: 21, fontWeight: '800', color: Colors.neon.white, letterSpacing: -0.6 },
  datoGrandeUnidad: { fontSize: 11, color: Colors.neon.w2 },

  // ── Cifras ─────────────────────────────────────────────────────────────────
  cifras: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: 20,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  cifraSep: { width: 1, height: 28, backgroundColor: Colors.neon.edge },
  cifraValor: { fontSize: 19, fontWeight: '800', color: Colors.neon.white, letterSpacing: -0.5 },
  cifraEtiqueta: { fontSize: 10, color: Colors.neon.w3, marginTop: 1 },

  seccion: { fontSize: 10, fontWeight: '800', color: Colors.neon.w3, letterSpacing: 1.6, marginTop: Spacing[2] },

  // ── Tarjetas ───────────────────────────────────────────────────────────────
  tarjeta: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[3] + 2,
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  icono: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  titulo: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: Colors.neon.white },
  sub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },
  datos: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  dato: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  datoTxt: { fontSize: 10, fontWeight: '700', color: Colors.neon.w2 },

  pie: {
    fontSize: 11, color: Colors.neon.w3, lineHeight: 16,
    paddingTop: Spacing[4], paddingHorizontal: Spacing[1],
  },
})
