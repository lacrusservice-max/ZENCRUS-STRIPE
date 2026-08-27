/**
 * PROGRESO
 * ────────
 * Si se está mejorando o solo yendo al gimnasio. Son cosas distintas y esta es
 * la pantalla que las separa.
 *
 * ── Rehecha con el sistema de la sección ────────────────────────────────────
 * La versión anterior eran cuatro tarjetas grises apiladas. Ahora abre con una
 * cifra grande sobre fotografía —el dato que resume el mes— y debajo van las
 * tres preguntas, cada una con su gráfica y su lista con imágenes.
 *
 * ── Tres preguntas, tres bloques ────────────────────────────────────────────
 * · ¿Estoy haciendo MÁS que antes?  → volumen y series por semana
 * · ¿Estoy más FUERTE?              → la curva de 1RM de cada ejercicio
 * · ¿En qué me estoy apoyando?      → los ejercicios por trabajo hecho
 *
 * Volumen y fuerza no comparten gráfica a propósito: se puede subir el volumen
 * sin ganar un kilo de fuerza —haciendo más series flojas— y ganar fuerza
 * bajando el volumen. Juntarlas escondería justo eso.
 */

import { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native'
import { Image } from '@/components/ui/Imagen'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { CabeceraSeccion } from '@/components/workout/MenuSeccion'
import { Barras, Curva, Vacio } from '@/components/workout/Charts'
import { MaterialIcon } from '@/components/workout/Kit'
import {
  getVolumen, getEjercicios, getCurva, getResumen,
  Semana, EjercicioHecho, Curva as CurvaDatos, Resumen,
  kilosCorto, minutosCorto, desdeCuando,
} from '@/services/statsService'
import { FOTOS } from '@/constants/imagenes'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

const diaCorto = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

const METRICAS = [
  { id: 'volumen' as const, label: 'Kilos', unidad: '' },
  { id: 'series' as const, label: 'Series', unidad: '' },
  { id: 'minutos' as const, label: 'Tiempo', unidad: '' },
]

export default function Progreso() {
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [semanas, setSemanas] = useState<Semana[]>([])
  const [ejercicios, setEjercicios] = useState<EjercicioHecho[]>([])
  const [curva, setCurva] = useState<CurvaDatos | null>(null)
  const [elegido, setElegido] = useState<string | null>(null)
  const [metrica, setMetrica] = useState<'volumen' | 'series' | 'minutos'>('volumen')
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const [r, v, e] = await Promise.all([
        getResumen(90).catch(() => null),
        getVolumen(84).catch(() => null),
        getEjercicios(90).catch(() => null),
      ])
      setResumen(r)
      setSemanas(v?.semanas ?? [])
      const lista = e?.ejercicios ?? []
      setEjercicios(lista)

      /**
       * La curva se pide DESPUÉS de soltar la pantalla, no dentro del bloque
       * que la bloquea.
       *
       * Estaba con `await` antes del `finally`, así que una respuesta lenta
       * —o un backend a medio arrancar— dejaba la pantalla entera en el giro de
       * carga indefinidamente, con todo lo demás ya descargado y listo para
       * pintar. Ahora el resto aparece de inmediato y solo la gráfica muestra
       * su propio giro mientras llega.
       */
      const primero = lista.find(x => x.mejor1RM > 0) ?? lista[0]
      if (primero) {
        setElegido(primero.exerciseKey)
        void getCurva(primero.exerciseKey)
          .then(c => setCurva(c))
          .catch(() => setCurva({
            exerciseKey: primero.exerciseKey, exerciseName: primero.exerciseName,
            totalSeries: 0, volumenTotal: 0, puntos: [],
          }))
      }
    } finally {
      setCargando(false)
      setRefrescando(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { void cargar() }, [cargar]))

  const verCurva = async (key: string) => {
    void Haptics.selectionAsync()
    setElegido(key)
    setCurva(null)
    setCurva(await getCurva(key).catch(() => null))
  }

  const valorSemana = (s: Semana) =>
    metrica === 'volumen' ? s.volumen : metrica === 'series' ? s.series : s.minutos

  const barras = semanas.map((s, i) => ({
    etiqueta: diaCorto(s.lunes),
    valor: valorSemana(s),
    enCurso: i === semanas.length - 1,
  }))

  const conDatos = semanas.some(s => s.sesiones > 0)
  const volumenTotal = semanas.reduce((a, x) => a + x.volumen, 0)
  const elegidoDatos = ejercicios.find(e => e.exerciseKey === elegido)

  return (
    <Screen>
      <CabeceraSeccion titulo="Progreso" subtitulo="Últimas 12 semanas" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refrescando}
            onRefresh={() => { setRefrescando(true); void cargar() }}
            tintColor={Colors.neon.w3} />
        }
      >
        {cargando ? (
          <View style={s.cargando}><ActivityIndicator color={Colors.neon.red} /></View>
        ) : !conDatos ? (
          <View style={{ padding: Spacing[4] }}>
            <Vacio texto="Todavía no hay entrenamientos que comparar. Con dos semanas registradas esta pantalla empieza a tener sentido." />
          </View>
        ) : (
          <>
            {/* ── El resumen, sobre fotografía ─────────────────────────── */}
            <Animated.View entering={FadeIn.duration(420)} style={s.zonaHero}>
              <View style={s.hero}>
                <Image source={FOTOS.fuerza.fuente} style={StyleSheet.absoluteFill} contentFit="cover" transition={280} />
                <LinearGradient
                  colors={['rgba(5,5,5,0.12)', 'rgba(5,5,5,0.70)', 'rgba(5,5,5,0.96)']}
                  locations={[0, 0.5, 1]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <View style={s.heroDentro}>
                  <Text style={s.heroEtiqueta}>KILOS MOVIDOS EN 12 SEMANAS</Text>
                  <Text style={s.heroCifra}>{kilosCorto(volumenTotal)}</Text>
                  <View style={s.heroFila}>
                    <HeroDato
                      valor={String(resumen?.sesiones ?? 0)}
                      etiqueta={(resumen?.sesiones ?? 0) === 1 ? 'sesión' : 'sesiones'}
                    />
                    <View style={s.heroSep} />
                    <HeroDato valor={minutosCorto(semanas.reduce((a, x) => a + x.minutos, 0))} etiqueta="entrenando" />
                    <View style={s.heroSep} />
                    {(() => {
                      const total = semanas.reduce((a, x) => a + x.series, 0)
                      return <HeroDato valor={String(total)} etiqueta={total === 1 ? 'serie' : 'series'} />
                    })()}
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* ── Por semana ───────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(70).duration(380)} style={s.bloque}>
              <View style={s.bloqueCabecera}>
                <View style={{ flex: 1 }}>
                  <Text style={s.pregunta}>¿Estoy haciendo más que antes?</Text>
                  <Text style={s.subpregunta}>Volumen semana a semana</Text>
                </View>
              </View>

              <View style={s.selector}>
                {METRICAS.map(m => (
                  <TouchableOpacity
                    key={m.id}
                    style={[s.selectorChip, metrica === m.id && s.selectorChipOn]}
                    onPress={() => { void Haptics.selectionAsync(); setMetrica(m.id) }}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.selectorTxt, metrica === m.id && s.selectorTxtOn]}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.tarjeta}>
                <Barras datos={barras} />
                <Text style={s.nota}>
                  La última barra es la semana en curso y va a medias a propósito:
                  todavía le quedan días.
                </Text>
              </View>
            </Animated.View>

            {/* ── Fuerza ───────────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(130).duration(380)} style={s.bloque}>
              <Text style={s.pregunta}>¿Estoy más fuerte?</Text>
              <Text style={s.subpregunta}>Elige un ejercicio y mira su curva</Text>

              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                style={s.tiraScroll} contentContainerStyle={s.tira}
              >
                {ejercicios.slice(0, 12).map(e => {
                  const on = elegido === e.exerciseKey
                  return (
                    <TouchableOpacity
                      key={e.exerciseKey}
                      style={[s.miniatura, on && s.miniaturaOn]}
                      onPress={() => void verCurva(e.exerciseKey)}
                      activeOpacity={0.85}
                    >
                      {e.poster ? (
                        <Image source={{ uri: e.poster }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} />
                      ) : (
                        <View style={s.miniaturaVacia}>
                          <Ionicons name="barbell-outline" size={18} color={Colors.neon.w4} />
                        </View>
                      )}
                      <LinearGradient
                        colors={['transparent', on ? 'rgba(255,92,0,0.85)' : 'rgba(5,5,5,0.92)']}
                        style={StyleSheet.absoluteFill}
                        pointerEvents="none"
                      />
                      <Text style={s.miniaturaTxt} numberOfLines={2}>{e.exerciseName}</Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>

              <View style={s.tarjeta}>
                {curva === null ? (
                  <View style={s.cargandoCurva}><ActivityIndicator size="small" color={Colors.neon.w3} /></View>
                ) : curva.puntos.length === 0 ? (
                  <Vacio
                    texto={`De ${curva.exerciseName} hay ${curva.totalSeries} series y ${kilosCorto(curva.volumenTotal)} movidos, pero sin 1RM estimable: se hace sin kilos o a repeticiones altas. Su progreso se mide en volumen, no en fuerza máxima.`}
                  />
                ) : (
                  <>
                    <View style={s.curvaCabecera}>
                      {elegidoDatos?.poster && (
                        <Image source={{ uri: elegidoDatos.poster }} style={s.curvaFoto} contentFit="cover" />
                      )}
                      <Text style={s.curvaNombre} numberOfLines={2}>{curva.exerciseName}</Text>
                    </View>
                    <Curva
                      puntos={curva.puntos.map(p => ({ x: diaCorto(p.dia), y: p.est1RM }))}
                      unidad="kg"
                    />
                    <Text style={s.nota}>
                      1RM estimado con la fórmula de Epley sobre la mejor serie de cada día.
                      No hace falta fallar un máximo para saber que has subido.
                    </Text>
                  </>
                )}
              </View>
            </Animated.View>

            {/* ── En qué te apoyas ─────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(190).duration(380)} style={s.bloque}>
              <Text style={s.pregunta}>¿En qué te estás apoyando?</Text>
              <Text style={s.subpregunta}>Lo que más haces, en 90 días</Text>

              <View style={{ gap: Spacing[2] }}>
                {ejercicios.slice(0, 10).map((e, i) => (
                  <Animated.View key={e.exerciseKey} entering={FadeInDown.delay(210 + i * 40).duration(320)}>
                    <TouchableOpacity
                      style={s.fila}
                      onPress={() => void verCurva(e.exerciseKey)}
                      activeOpacity={0.85}
                    >
                      <View style={s.filaFoto}>
                        {e.poster ? (
                          <Image source={{ uri: e.poster }} style={s.filaImg} contentFit="cover" transition={180} />
                        ) : (
                          <View style={s.filaImgVacia}>
                            <Ionicons name="barbell-outline" size={16} color={Colors.neon.w4} />
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.filaNombre} numberOfLines={1}>{e.exerciseName}</Text>
                        <Text style={s.filaSub}>
                          {e.series} {e.series === 1 ? 'serie' : 'series'} · {desdeCuando(e.ultimaVez)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        {e.mejor1RM > 0 ? (
                          <Text style={s.filaRM}>{e.mejor1RM} kg</Text>
                        ) : (
                          <Text style={s.filaVol}>{kilosCorto(e.volumen)}</Text>
                        )}
                        <Text style={s.filaRMPie}>{e.mejor1RM > 0 ? '1RM' : 'movidos'}</Text>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>

            <View style={s.bloque}>
              <TouchableOpacity
                style={s.acceso}
                onPress={() => router.push('/workout/history')}
                activeOpacity={0.85}
              >
                <Ionicons name="time-outline" size={18} color={Colors.neon.w2} />
                <Text style={s.accesoTxt}>Ver el historial completo</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.neon.w3} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

function HeroDato({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={s.heroDatoValor}>{valor}</Text>
      <Text style={s.heroDatoEtiqueta}>{etiqueta}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  cargando: { paddingVertical: Spacing[8], alignItems: 'center' },
  cargandoCurva: { paddingVertical: Spacing[6], alignItems: 'center' },

  zonaHero: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[5] },
  hero: {
    height: 220, borderRadius: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'flex-end',
    backgroundColor: Colors.neon.void,
  },
  heroDentro: { padding: Spacing[4], gap: Spacing[2] },
  heroEtiqueta: { fontSize: 9.5, fontWeight: '800', color: Colors.neon.redCore, letterSpacing: 1.4 },
  heroCifra: { fontSize: 46, fontWeight: '800', color: Colors.neon.white, letterSpacing: -1.6, lineHeight: 50 },
  heroFila: { flexDirection: 'row', alignItems: 'center', gap: Spacing[4], marginTop: 2 },
  heroSep: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.16)' },
  heroDatoValor: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white },
  heroDatoEtiqueta: { fontSize: 9.5, color: Colors.neon.w3, marginTop: -1 },

  bloque: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[5], gap: Spacing[3] },
  bloqueCabecera: { flexDirection: 'row', alignItems: 'center' },
  pregunta: { fontSize: 19, fontWeight: '800', color: Colors.neon.white, letterSpacing: -0.3 },
  subpregunta: { fontSize: 12, color: Colors.neon.w3, marginTop: 1 },

  tarjeta: {
    gap: Spacing[3], padding: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: 20,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  nota: { fontSize: 11, color: Colors.neon.w3, lineHeight: 16 },

  selector: { flexDirection: 'row', gap: 4, padding: 3, alignSelf: 'flex-start', backgroundColor: 'rgba(5,5,5,0.3)', borderRadius: BorderRadius.full },
  selectorChip: { paddingHorizontal: Spacing[4], paddingVertical: 6, borderRadius: BorderRadius.full },
  selectorChipOn: { backgroundColor: Colors.neon.paneHi },
  selectorTxt: { fontSize: 12, fontWeight: '700', color: Colors.neon.w3 },
  selectorTxtOn: { color: Colors.neon.white },

  tiraScroll: { flexGrow: 0, flexShrink: 0 },
  tira: { flexDirection: 'row', gap: Spacing[2] },
  // Miniatura del ejercicio con su nombre encima: se elige por la imagen y se
  // confirma con el texto, que es el orden en que funciona el ojo.
  miniatura: {
    width: 92, height: 92, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.neon.edge,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  miniaturaOn: { borderColor: Colors.neon.white, borderWidth: 1.5 },
  miniaturaVacia: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  miniaturaTxt: { fontSize: 9.5, fontWeight: '700', color: Colors.neon.white, padding: 6, lineHeight: 12 },

  curvaCabecera: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  curvaFoto: { width: 40, height: 40, borderRadius: 11 },
  curvaNombre: { flex: 1, fontSize: Typography.fontSize.sm, fontWeight: '800', color: Colors.neon.white },

  fila: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[3],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  filaFoto: {
    width: 48, height: 48, borderRadius: 13, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  filaImg: { width: '100%', height: '100%' },
  filaImgVacia: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filaNombre: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  filaSub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },
  filaRM: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white },
  filaVol: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: Colors.neon.w2 },
  filaRMPie: { fontSize: 9, color: Colors.neon.w3, letterSpacing: 0.5 },

  acceso: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  accesoTxt: { flex: 1, fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
})
