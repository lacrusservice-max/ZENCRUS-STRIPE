/**
 * DESCUBRE
 * ────────
 * «No sé qué hacer hoy». Esta pantalla lo resuelve en tres toques: dónde estás,
 * cuánto tiempo tienes y qué zona quieres.
 *
 * ── El orden de las preguntas no es casual ──────────────────────────────────
 * DÓNDE primero, porque es lo que ya sabes sin pensar y lo que más recorta el
 * catálogo. TIEMPO después, porque es la restricción real: la gente no decide
 * «hoy pecho», decide «tengo veinte minutos». La ZONA va la última porque es la
 * única de las tres que se puede negociar.
 *
 * ── El entrenamiento se genera, no se elige de una lista ────────────────────
 * Al tocar una región no se abre un catálogo: sale una sesión montada con tus
 * ejercicios, sus series y sus descansos, lista para empezar. Cambia cada día y
 * se adapta al material, cosa que un vídeo pregrabado no hace.
 *
 * ── Y el catálogo sigue estando ─────────────────────────────────────────────
 * Quien quiera elegir a mano tiene los 206 a un toque. Generar es el camino
 * corto, no el único.
 */

import { useState, useCallback, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { Image } from '@/components/ui/Imagen'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { CabeceraSeccion } from '@/components/workout/MenuSeccion'
import { RegionCards, Zona } from '@/components/workout/RegionCards'
import { HeroCard } from '@/components/workout/HeroCard'
import { Vacio } from '@/components/workout/Charts'
import { MaterialIcon } from '@/components/workout/Kit'
import {
  getOpciones, getEntrenamiento, recetaDe, resumenDe,
  Opciones, Generado, Lugar,
} from '@/services/quickService'
import { FOTOS, FOTO_REGION } from '@/constants/imagenes'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

const LUGARES: { id: Lugar; label: string; icono: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'todo', label: 'Donde sea', icono: 'earth' },
  { id: 'home', label: 'En casa', icono: 'home' },
  { id: 'gym', label: 'Gimnasio', icono: 'barbell' },
]

const NOMBRE_REGION: Record<string, string> = {
  fullbody: 'Cuerpo entero', upper: 'Tren superior', arms: 'Brazos',
  chest: 'Pecho', legs: 'Glúteos y piernas', back: 'Espalda',
  shoulders: 'Hombros', core: 'Core',
}

export default function Descubre() {
  const [opciones, setOpciones] = useState<Opciones | null>(null)
  /**
   * EL LUGAR VIENE DECIDIDO, NO SE PREGUNTA.
   *
   * Se llega desde la portada de un lugar, así que preguntarlo otra vez es
   * peor que redundante: dejaba elegir «en casa» desde dentro del gimnasio y
   * generaba una sesión que no pertenece a la página en la que estás. Con el
   * parámetro puesto, el paso 1 desaparece y no hay nada que cruzar.
   */
  const { mode } = useLocalSearchParams<{ mode?: string }>()
  const fijado: Lugar | null = mode === 'home' || mode === 'gym' ? mode : null
  const [lugar, setLugar] = useState<Lugar>(fijado ?? 'todo')
  const [minutos, setMinutos] = useState(20)
  const [region, setRegion] = useState<string | null>(null)
  const [plan, setPlan] = useState<Generado | null>(null)
  const [cargando, setCargando] = useState(true)
  const [generando, setGenerando] = useState(false)

  useFocusEffect(useCallback(() => {
    let vivo = true
    getOpciones()
      .then(o => { if (vivo) setOpciones(o) })
      .catch(() => {})
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, []))

  // Al cambiar cualquiera de los tres mandos, se rehace el entrenamiento.
  useEffect(() => {
    if (!region) { setPlan(null); return }
    let vivo = true
    setGenerando(true)
    getEntrenamiento(region, minutos, lugar)
      .then(g => { if (vivo) setPlan(g) })
      .catch(() => { if (vivo) setPlan(null) })
      .finally(() => { if (vivo) setGenerando(false) })
    return () => { vivo = false }
  }, [region, minutos, lugar])

  const elegirRegion = (z: Zona) => {
    setRegion(prev => prev === z.id ? null : z.id)
  }

  const empezar = () => {
    if (!region) return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    router.push(`/workout/active?quick=${recetaDe(region, minutos, lugar)}&mode=${lugar === 'home' ? 'home' : 'gym'}`)
  }

  return (
    <Screen>
      <CabeceraSeccion
        titulo="Descubre"
        subtitulo={fijado ? 'Dime cuánto tiempo tienes' : 'Dime dónde estás y cuánto tienes'}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing[4], paddingBottom: 130, gap: Spacing[5] }}
      >
        {cargando ? (
          <View style={s.cargando}><ActivityIndicator color={Colors.neon.w3} /></View>
        ) : !opciones ? (
          <Vacio texto="No se pudo cargar el catálogo. Tira hacia abajo para reintentar." />
        ) : (
          <>
            {/* ── 1 · Dónde — solo si NO se llegó desde un lugar ────────── */}
            {!fijado && (
            <Animated.View entering={FadeInDown.duration(340)} style={{ gap: Spacing[3] }}>
              <Paso n={1} titulo="Dónde entrenas" />
              <View style={s.lugares}>
                {LUGARES.map(l => {
                  const on = lugar === l.id
                  return (
                    <TouchableOpacity
                      key={l.id}
                      style={[s.lugar, on && s.lugarOn]}
                      onPress={() => { void Haptics.selectionAsync(); setLugar(l.id) }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name={l.icono} size={17} color={on ? Colors.neon.white : Colors.neon.w3} />
                      <Text style={[s.lugarTxt, on && { color: Colors.neon.white }]}>{l.label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </Animated.View>
            )}

            {/* ── 2 · Cuánto ───────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(60).duration(340)} style={{ gap: Spacing[3] }}>
              <Paso n={fijado ? 1 : 2} titulo="Cuánto tiempo tienes" />
              <View style={s.minutos}>
                {opciones.duraciones.map(m => {
                  const on = minutos === m
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[s.minuto, on && s.minutoOn]}
                      onPress={() => { void Haptics.selectionAsync(); setMinutos(m) }}
                      activeOpacity={0.85}
                    >
                      <Text style={[s.minutoNum, on && { color: Colors.neon.white }]}>{m}</Text>
                      <Text style={[s.minutoTxt, on && { color: Colors.neon.redCore }]}>min</Text>
                      {/* Por debajo de 18 min el generador monta circuito, y
                          conviene decirlo: cambia lo que te vas a encontrar. */}
                      <Text style={s.minutoEstilo}>{m <= 18 ? 'circuito' : 'fuerza'}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </Animated.View>

            {/* ── 3 · Qué ──────────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(120).duration(340)} style={{ gap: Spacing[2] }}>
              <Paso n={fijado ? 2 : 3} titulo="Qué quieres trabajar" />
              <RegionCards elegida={region} onElegir={elegirRegion} />
            </Animated.View>

            {/* ── El resultado ─────────────────────────────────────────── */}
            {region && (
              <Animated.View entering={FadeIn.duration(320)} style={{ gap: Spacing[3] }}>
                {generando ? (
                  <View style={s.cargandoPlan}><ActivityIndicator color={Colors.neon.red} /></View>
                ) : !plan ? (
                  <Vacio texto="No hay ejercicios suficientes para esa combinación. Prueba con otro sitio o con otra zona." />
                ) : (
                  <>
                    <HeroCard
                      badge="Hecho para ti ahora"
                      titulo={plan.titulo}
                      subtitulo={resumenDe(plan)}
                      datos={[
                        { icono: 'time-outline', valor: `${plan.minutosReales} min`, etiqueta: 'Duración real' },
                        { icono: 'flash-outline', valor: plan.estilo === 'circuito' ? 'Circuito' : 'Fuerza', etiqueta: 'Formato' },
                        { icono: 'body-outline', valor: NOMBRE_REGION[plan.region] ?? plan.region, etiqueta: 'Zona' },
                        { icono: 'layers-outline', valor: `${plan.series}`, etiqueta: 'Series en total' },
                      ]}
                      cta="Empezar ahora"
                      onPress={empezar}
                      foto={FOTOS[FOTO_REGION[plan.region] ?? 'gimnasio']?.fuente}
                      posters={plan.ejercicios.map(e => e.poster)}
                      alto={330}
                    />

                    <View style={s.lista}>
                      <View style={s.listaCabecera}>
                        <Text style={s.listaTitulo}>Los {plan.ejercicios.length} ejercicios</Text>
                        <TouchableOpacity
                          onPress={() => { void Haptics.selectionAsync(); setRegion(r => r) ; setMinutos(m => m) }}
                          hitSlop={8}
                        >
                          <Text style={s.listaNota}>Cambia cada día</Text>
                        </TouchableOpacity>
                      </View>

                      {plan.ejercicios.map((e, i) => (
                        <Animated.View key={e.slug} entering={FadeInDown.delay(i * 45).duration(300)}>
                          <TouchableOpacity
                            style={s.fila}
                            onPress={() => router.push(`/workout/exercise/${e.slug}${fijado === 'home' ? '?place=home' : ''}`)}
                            activeOpacity={0.8}
                          >
                            <Text style={s.filaNum}>{i + 1}</Text>
                            {/* La MINIATURA del ejercicio, no un punto de
                                color. Un punto obliga a leer el nombre para
                                saber qué es; la imagen se reconoce antes. */}
                            <View style={s.filaFoto}>
                              {e.poster ? (
                                <Image source={{ uri: e.poster }} style={s.filaImg} contentFit="cover" transition={180} />
                              ) : (
                                <View style={s.filaImgVacia}>
                                  <Ionicons name="barbell-outline" size={15} color={Colors.neon.w4} />
                                </View>
                              )}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={s.filaNombre} numberOfLines={1}>{e.nombre}</Text>
                              <Text style={s.filaSub}>
                                {e.series} × {e.reps} · {e.descanso}s descanso
                              </Text>
                            </View>
                            <MaterialIcon id={e.equipment} size={17} color={Colors.neon.w3} />
                          </TouchableOpacity>
                        </Animated.View>
                      ))}
                    </View>
                  </>
                )}
              </Animated.View>
            )}

            {/* ── El catálogo entero ───────────────────────────────────── */}
            <TouchableOpacity
              style={s.catalogo}
              onPress={() => router.push(fijado ? `/workout/library?place=${fijado}` : '/workout/library')}
              activeOpacity={0.85}
            >
              <Ionicons name="library-outline" size={19} color={Colors.neon.w2} />
              <View style={{ flex: 1 }}>
                <Text style={s.catalogoTitulo}>Los 206 ejercicios</Text>
                <Text style={s.catalogoSub}>Con su vídeo, su músculo y sus alternativas</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.neon.w3} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

function Paso({ n, titulo }: { n: number; titulo: string }) {
  return (
    <View style={s.paso}>
      <View style={s.pasoNum}><Text style={s.pasoNumTxt}>{n}</Text></View>
      <Text style={s.pasoTitulo}>{titulo}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  cargando: { paddingVertical: Spacing[8], alignItems: 'center' },
  cargandoPlan: { paddingVertical: Spacing[7], alignItems: 'center' },

  paso: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  pasoNum: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.neon.redDim,
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.35)',
  },
  pasoNumTxt: { fontSize: 10, fontWeight: '800', color: Colors.neon.redCore },
  pasoTitulo: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white },
  pista: { fontSize: 11, color: Colors.neon.w3, lineHeight: 16 },

  lugares: { flexDirection: 'row', gap: Spacing[2] },
  lugar: {
    flex: 1, alignItems: 'center', gap: 5, paddingVertical: Spacing[3],
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
    backgroundColor: Colors.neon.pane,
  },
  lugarOn: { borderColor: 'rgba(255,31,61,0.5)', backgroundColor: Colors.neon.redDim },
  lugarTxt: { fontSize: 11, fontWeight: '700', color: Colors.neon.w3 },

  minutos: { flexDirection: 'row', gap: Spacing[2] },
  minuto: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing[3],
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
    backgroundColor: Colors.neon.pane,
  },
  minutoOn: { borderColor: 'rgba(255,31,61,0.5)', backgroundColor: Colors.neon.redDim },
  minutoNum: { fontSize: 26, fontWeight: '800', color: Colors.neon.w2, letterSpacing: -1 },
  minutoTxt: { fontSize: 10, fontWeight: '700', color: Colors.neon.w3, marginTop: -3 },
  minutoEstilo: { fontSize: 9, color: Colors.neon.w4, marginTop: 3, letterSpacing: 0.5 },

  lista: {
    gap: Spacing[2], padding: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: 20,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  listaCabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listaTitulo: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: Colors.neon.white },
  listaNota: { fontSize: 10, color: Colors.neon.w3, fontStyle: 'italic' },

  fila: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingVertical: Spacing[3],
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.055)',
  },
  filaNum: { width: 14, fontSize: 11, fontWeight: '800', color: Colors.neon.w4 },
  filaFoto: {
    width: 46, height: 46, borderRadius: 12, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  filaImg: { width: '100%', height: '100%' },
  filaImgVacia: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filaNombre: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  filaSub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },

  catalogo: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  catalogoTitulo: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  catalogoSub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },
})
