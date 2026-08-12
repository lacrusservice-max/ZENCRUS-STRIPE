/**
 * ENTRENA · HOY
 * ─────────────
 * La portada de la sección. Rehecha entera: la versión anterior era una pila de
 * tarjetas grises con texto, correcta y olvidable.
 *
 * ── La jerarquía es la de una portada, no la de un panel ────────────────────
 * Lo primero que se ve ocupa media pantalla y es UNA sola cosa: o el
 * entrenamiento a medias, o el de hoy. Debajo, y solo debajo, las cifras. Un
 * panel que enseña seis bloques del mismo tamaño obliga a decidir dónde mirar;
 * una portada ya ha decidido por ti.
 *
 * ── Con fotografía de verdad ────────────────────────────────────────────────
 * Las imágenes van tratadas con el duotono de marca y empaquetadas con la app,
 * así que la portada aparece entera en el primer fotograma. Ver
 * `constants/imagenes.ts` para el porqué de cada decisión.
 *
 * ── Se quitó el mapa del cuerpo ─────────────────────────────────────────────
 * La figura anatómica y su pantalla se retiraron por decisión de producto. Lo
 * que contestaban —qué llevo entrenado y qué tengo abandonado— se contesta
 * ahora con datos en la tira de la semana y en Progreso, que es donde la gente
 * los busca.
 */

import { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native'
import { ImageSourcePropType } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { HeroCard } from '@/components/workout/HeroCard'
import { MenuSeccion } from '@/components/workout/MenuSeccion'
import { TiraSemana } from '@/components/workout/TiraSemana'
import { Cifra } from '@/components/workout/Charts'
import { useSessionStore } from '@/store/sessionStore'
import {
  getResumen, getDias, Resumen, Dia,
  kilosCorto, minutosCorto, desdeCuando,
} from '@/services/statsService'
import { listarSesiones, Sesion } from '@/services/sessionService'
import { getEntrenamiento, recetaDe, Generado } from '@/services/quickService'
import { FOTOS, FOTO_MODO } from '@/constants/imagenes'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

/**
 * Objetivo de sesiones por semana: cuatro.
 *
 * Por debajo de tres la frecuencia por grupo muscular no da para progresar, y
 * por encima de cinco la mayoría no sostiene el ritmo más de un mes.
 */
const OBJETIVO_SEMANA = 4

/**
 * Qué entrenamiento se propone en la portada.
 *
 * Veinte minutos de cuerpo entero. Es la propuesta que menos supone: no exige
 * saber qué toca hoy ni tener material, y veinte minutos caben en casi
 * cualquier día. Quien quiera elegir tiene Descubre a un toque.
 */
const PROPUESTA = { region: 'fullbody', minutos: 20, lugar: 'todo' as const }

export default function EntrenaHoy() {
  const { sesion, series, restaurar } = useSessionStore()

  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [dias, setDias] = useState<Dia[]>([])
  const [recientes, setRecientes] = useState<Sesion[]>([])
  const [propuesta, setPropuesta] = useState<Generado | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const [r, v, h, g] = await Promise.all([
        getResumen(28).catch(() => null),
        getDias(7).catch(() => null),
        listarSesiones({ limit: 3 }).catch(() => null),
        getEntrenamiento(PROPUESTA.region, PROPUESTA.minutos, PROPUESTA.lugar).catch(() => null),
      ])
      setResumen(r)
      setDias(v?.dias ?? [])
      setRecientes(h?.sessions ?? [])
      setPropuesta(g)
    } finally {
      setCargando(false)
      setRefrescando(false)
    }
  }, [])

  useFocusEffect(useCallback(() => {
    void restaurar()
    void cargar()
  }, [restaurar, cargar]))

  const sesionesSemana = resumen?.sesionesSemana ?? 0
  const hora = new Date().getHours()
  const saludo = hora < 6 ? 'De madrugada' : hora < 13 ? 'Buenos días' : hora < 21 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <Screen>
      {/* Cabecera propia: más corta que la genérica, para que la portada
          empiece cuanto antes. */}
      <View style={s.cabecera}>
        <View style={{ flex: 1 }}>
          <Text style={s.saludo}>{saludo.toUpperCase()}</Text>
          <Text style={s.titulo}>Entrena</Text>
        </View>
        <TouchableOpacity
          style={s.historialBtn}
          onPress={() => router.push('/workout/history')}
          activeOpacity={0.8}
        >
          <Ionicons name="time-outline" size={19} color={Colors.neon.w2} />
        </TouchableOpacity>
      </View>

      <MenuSeccion activo="hoy" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => { setRefrescando(true); void cargar() }}
            tintColor={Colors.neon.w3}
          />
        }
      >
        {cargando ? (
          <View style={s.cargando}><ActivityIndicator color={Colors.neon.red} /></View>
        ) : (
          <>
            {/* ── LO PRIMERO: una sola cosa ────────────────────────────── */}
            <Animated.View entering={FadeIn.duration(420)} style={s.zonaHero}>
              {sesion ? (
                <HeroCard
                  badge="Lo dejaste a medias"
                  titulo={sesion.title}
                  subtitulo={`${series.length} ${series.length === 1 ? 'serie registrada' : 'series registradas'} · sigue abierto`}
                  datos={[
                    { icono: 'barbell-outline', valor: String(series.length), etiqueta: 'Series' },
                    { icono: 'time-outline', valor: desdeCuando(new Date(sesion.empezadaEn).toISOString()), etiqueta: 'Empezado' },
                    { icono: 'location-outline', valor: sesion.mode === 'home' ? 'En casa' : 'Gimnasio', etiqueta: 'Dónde' },
                    { icono: 'flame-outline', valor: 'Abierto', etiqueta: 'Estado' },
                  ]}
                  cta="Seguir entrenando"
                  onPress={() => router.push('/workout/active')}
                  foto={FOTOS[FOTO_MODO[sesion.mode] ?? 'gimnasio']?.fuente}
                  alto={330}
                />
              ) : propuesta ? (
                <HeroCard
                  badge="Tu entrenamiento de hoy"
                  titulo={propuesta.titulo}
                  subtitulo={`${propuesta.ejercicios.length} ejercicios · ${propuesta.series} series · cambia cada día`}
                  datos={[
                    { icono: 'time-outline', valor: `${propuesta.minutosReales} min`, etiqueta: 'Duración' },
                    { icono: 'flash-outline', valor: propuesta.estilo === 'circuito' ? 'Circuito' : 'Fuerza', etiqueta: 'Formato' },
                    { icono: 'body-outline', valor: 'Cuerpo entero', etiqueta: 'Zona' },
                    { icono: 'layers-outline', valor: String(propuesta.series), etiqueta: 'Series' },
                  ]}
                  cta="Empezar ahora"
                  onPress={() => router.push(
                    `/workout/active?quick=${recetaDe(PROPUESTA.region, PROPUESTA.minutos, PROPUESTA.lugar)}&mode=gym`,
                  )}
                  foto={FOTOS.gimnasio.fuente}
                  alto={340}
                />
              ) : (
                <HeroCard
                  badge="Empieza"
                  titulo="Tu primer entrenamiento"
                  subtitulo="Registra una serie y todo lo demás empieza a existir"
                  datos={[
                    { icono: 'barbell-outline', valor: '206', etiqueta: 'Ejercicios' },
                    { icono: 'videocam-outline', valor: 'Con vídeo', etiqueta: 'Cada uno' },
                    { icono: 'home-outline', valor: '125', etiqueta: 'Sin gimnasio' },
                    { icono: 'timer-outline', valor: '10-30', etiqueta: 'Minutos' },
                  ]}
                  cta="Empezar a entrenar"
                  onPress={() => router.push('/workout/active')}
                  foto={FOTOS.gimnasio.fuente}
                  alto={340}
                />
              )}
            </Animated.View>

            {/* ── La semana, en una tira ───────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(80).duration(380)} style={s.bloque}>
              <TiraSemana
                dias={dias}
                sesionesSemana={sesionesSemana}
                objetivo={OBJETIVO_SEMANA}
                racha={resumen?.racha ?? 0}
              />

              <View style={s.cifras}>
                <Cifra valor={String(resumen?.seriesSemana ?? 0)} etiqueta="SERIES" />
                <Cifra valor={kilosCorto(resumen?.volumenSemana ?? 0)} etiqueta="MOVIDOS" />
                <Cifra valor={minutosCorto(resumen?.minutosSemana ?? 0)} etiqueta="TIEMPO" />
              </View>
            </Animated.View>

            {/* ── Atajos ───────────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(140).duration(380)} style={s.bloque}>
              <Text style={s.seccion}>EMPIEZA POR AQUÍ</Text>
              <View style={s.atajos}>
                <Atajo
                  foto={FOTOS.casa.fuente}
                  titulo="En casa"
                  pie="Sin material"
                  onPress={() => router.push(`/workout/active?quick=${recetaDe('fullbody', 20, 'home')}&mode=home`)}
                />
                <Atajo
                  foto={FOTOS.fuerza.fuente}
                  titulo="Fuerza"
                  pie="30 min de gimnasio"
                  onPress={() => router.push(`/workout/active?quick=${recetaDe('fullbody', 30, 'gym')}&mode=gym`)}
                />
              </View>
              <View style={s.atajos}>
                <Atajo
                  foto={FOTOS.brazos.fuente}
                  titulo="Tren superior"
                  pie="20 min"
                  onPress={() => router.push(`/workout/active?quick=${recetaDe('upper', 20, 'todo')}&mode=gym`)}
                />
                <Atajo
                  foto={FOTOS.movilidad.fuente}
                  titulo="Core"
                  pie="10 min · circuito"
                  onPress={() => router.push(`/workout/active?quick=${recetaDe('core', 10, 'home')}&mode=home`)}
                />
              </View>
            </Animated.View>

            {/* ── Lo último ────────────────────────────────────────────── */}
            {recientes.length > 0 && (
              <Animated.View entering={FadeInDown.delay(200).duration(380)} style={s.bloque}>
                <View style={s.seccionFila}>
                  <Text style={s.seccion}>LO ÚLTIMO</Text>
                  <TouchableOpacity onPress={() => router.push('/workout/history')} hitSlop={8}>
                    <Text style={s.enlace}>Ver todo</Text>
                  </TouchableOpacity>
                </View>
                {recientes.map((x, i) => (
                  <Animated.View key={x.id} entering={FadeInDown.delay(240 + i * 50).duration(340)}>
                    <FilaSesion sesion={x} />
                  </Animated.View>
                ))}
              </Animated.View>
            )}

            {/* ── Rutinas ──────────────────────────────────────────────── */}
            <View style={s.bloque}>
              <TouchableOpacity
                style={s.acceso}
                onPress={() => router.push('/workout/routines')}
                activeOpacity={0.85}
              >
                <View style={s.accesoIcono}>
                  <Ionicons name="bookmark-outline" size={18} color={Colors.neon.w2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.accesoTitulo}>Mis rutinas</Text>
                  <Text style={s.accesoSub}>Guarda una sesión que repitas y empiézala de un toque</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.neon.w3} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

// ── Piezas ───────────────────────────────────────────────────────────────────

/**
 * Atajo con foto.
 *
 * La imagen ocupa la tarjeta entera y el texto va encima sobre un degradado.
 * Un icono en un círculo gris —lo que había antes— es un botón; una foto es un
 * sitio al que se quiere ir.
 */
function Atajo({ foto, titulo, pie, onPress }: {
  foto: ImageSourcePropType
  titulo: string
  pie: string
  onPress: () => void
}) {
  return (
    <TouchableOpacity style={a.marco} onPress={onPress} activeOpacity={0.85}>
      <Image source={foto} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} />
      <LinearGradient
        colors={['rgba(5,5,6,0.15)', 'rgba(5,5,6,0.90)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={a.texto}>
        <Text style={a.titulo}>{titulo}</Text>
        <Text style={a.pie}>{pie}</Text>
      </View>
      <View style={a.flecha}>
        <Ionicons name="arrow-forward" size={13} color={Colors.neon.void} />
      </View>
    </TouchableOpacity>
  )
}

const a = StyleSheet.create({
  marco: {
    flex: 1, height: 132, borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    justifyContent: 'flex-end',
  },
  texto: { padding: Spacing[3] },
  titulo: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white },
  pie: { fontSize: 10.5, color: Colors.neon.w2, marginTop: 1 },
  flecha: {
    position: 'absolute', top: 10, right: 10,
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
})

const ICONO_MODO: Record<string, keyof typeof Ionicons.glyphMap> = {
  gym: 'barbell-outline', home: 'home-outline',
  outdoor: 'trail-sign-outline', class: 'play-circle-outline',
}

function FilaSesion({ sesion }: { sesion: Sesion }) {
  const min = Math.round((sesion.duration_seconds ?? 0) / 60)
  return (
    <TouchableOpacity
      style={s.fila}
      onPress={() => router.push(`/workout/session/${sesion.id}`)}
      activeOpacity={0.8}
    >
      <View style={s.filaIcono}>
        <Ionicons name={ICONO_MODO[sesion.mode] ?? 'barbell-outline'} size={16} color={Colors.neon.w2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.filaTitulo} numberOfLines={1}>{sesion.title}</Text>
        <Text style={s.filaSub}>
          {desdeCuando(sesion.started_at)}
          {sesion.total_sets > 0 ? ` · ${sesion.total_sets} ${sesion.total_sets === 1 ? 'serie' : 'series'}` : ''}
          {min > 0 ? ` · ${min} min` : ''}
        </Text>
      </View>
      {Number(sesion.total_volume_kg) > 0 && (
        <Text style={s.filaVolumen}>{kilosCorto(Number(sesion.total_volume_kg))}</Text>
      )}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  cabecera: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingHorizontal: Spacing[4], paddingTop: Spacing[2], paddingBottom: Spacing[3],
  },
  saludo: { fontSize: 10, fontWeight: '800', color: Colors.neon.red, letterSpacing: 1.6 },
  titulo: { fontSize: 30, fontWeight: '800', color: Colors.neon.white, letterSpacing: -0.8, marginTop: 1 },
  historialBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.neon.pane,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },

  cargando: { paddingVertical: Spacing[8], alignItems: 'center' },
  zonaHero: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[4] },
  bloque: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[5], gap: Spacing[3] },

  seccion: { fontSize: 10, fontWeight: '800', color: Colors.neon.w3, letterSpacing: 1.6 },
  seccionFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  enlace: { fontSize: 12, fontWeight: '700', color: Colors.neon.red },

  cifras: { flexDirection: 'row', gap: Spacing[2] },
  atajos: { flexDirection: 'row', gap: Spacing[3] },

  fila: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[3],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  filaIcono: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  filaTitulo: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  filaSub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },
  filaVolumen: { fontSize: 12, fontWeight: '800', color: Colors.neon.w2 },

  acceso: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  accesoIcono: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  accesoTitulo: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  accesoSub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },
})
