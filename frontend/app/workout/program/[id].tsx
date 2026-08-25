/**
 * FICHA DE UN PROGRAMA
 * ────────────────────
 * Lo que hay dentro, ANTES de comprometerse. Un programa son ocho o doce
 * semanas: si hay que inscribirse para ver qué ejercicios lleva, la mitad de la
 * gente no se inscribe.
 *
 * ── Los días se despliegan ──────────────────────────────────────────────────
 * Cuatro días × cinco ejercicios son veinte filas, y de golpe convierten la
 * ficha en un listado que nadie lee. Van plegados con su resumen —«Empuje ·
 * 5 ejercicios»— y se abre el que interese. El primero viene abierto, que es lo
 * que enseña de qué va sin obligar a tocar nada.
 */

import { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import { Image } from '@/components/ui/Imagen'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { CabeceraSeccion } from '@/components/workout/MenuSeccion'
import { Vacio } from '@/components/workout/Charts'
import { Miniatura } from '@/components/workout/Miniatura'
import { NOMBRE_GRUPO } from '@/components/workout/anatomy'
import { fotoDePrograma } from '@/constants/imagenes'
import {
  getPrograma, inscribirse, ProgramaDetalle, DiaPlan,
  NOMBRE_OBJETIVO, NOMBRE_NIVEL, NOMBRE_MODO, prescripcion,
} from '@/services/programService'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

export default function FichaPrograma() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [p, setP] = useState<ProgramaDetalle | null>(null)
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState<number | null>(1)
  const [empezando, setEmpezando] = useState(false)

  useFocusEffect(useCallback(() => {
    if (!id) return
    let vivo = true
    getPrograma(id)
      .then(r => { if (vivo) setP(r) })
      .catch(() => { if (vivo) setP(null) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [id]))

  const empezar = () => {
    if (!p || empezando) return

    Alert.alert(
      `¿Empezar «${p.name}»?`,
      `Son ${p.weeks} semanas a ${p.days_per_week} ${p.days_per_week === 1 ? 'día' : 'días'} por semana. Si ya sigues otro programa, se dejará a medias — lo que hayas entrenado se queda en tu historial.`,
      [
        { text: 'Ahora no', style: 'cancel' },
        {
          text: 'Empezar',
          onPress: async () => {
            setEmpezando(true)
            try {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
              await inscribirse(p.id)
              router.replace('/workout/program/plan')
            } catch {
              Alert.alert('No se pudo empezar', 'Inténtalo otra vez en un momento.')
            } finally {
              setEmpezando(false)
            }
          },
        },
      ],
    )
  }

  if (cargando) {
    return (
      <Screen>
        <CabeceraSeccion titulo="Programa" />
        <View style={s.cargando}><ActivityIndicator color={Colors.neon.red} /></View>
      </Screen>
    )
  }

  if (!p) {
    return (
      <Screen>
        <CabeceraSeccion titulo="Programa" />
        <View style={{ padding: Spacing[4] }}>
          <Vacio texto="No se pudo cargar este programa." />
        </View>
      </Screen>
    )
  }

  /**
   * Ejercicios DISTINTOS, no entradas del plan.
   *
   * En «Fuerza desde cero» el día 3 repite el día A entero, así que sumar las
   * entradas da 9 cuando los movimientos que hay que aprender son 5. La cifra
   * que ayuda a decidir si un programa te viene grande es cuántas cosas
   * distintas trae, no cuántas veces salen.
   */
  const totalEjercicios = new Set(
    p.plan.dias.flatMap(d => d.ejercicios.map(e => e.slug ?? e.nombre)),
  ).size

  return (
    <Screen>
      <CabeceraSeccion titulo={p.name} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
      >
        {/* ── Héroe ─────────────────────────────────────────────────────── */}
        <Animated.View entering={FadeIn.duration(420)} style={s.zonaHero}>
          <View style={s.hero}>
            <Image source={fotoDePrograma(p)} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
            <LinearGradient
              colors={['rgba(5,5,6,0.25)', 'rgba(5,5,6,0.78)', 'rgba(5,5,6,0.98)']}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            <View style={s.heroDentro}>
              <View style={s.pastillas}>
                <Pastilla texto={NOMBRE_NIVEL[p.level]} />
                <Pastilla texto={NOMBRE_OBJETIVO[p.goal]} />
                <Pastilla texto={NOMBRE_MODO[p.mode] ?? p.mode} />
              </View>

              <View style={{ gap: Spacing[3] }}>
                <Text style={s.heroTitulo}>{p.name}</Text>
                <View style={s.datos}>
                  <Dato valor={String(p.weeks)} etiqueta={p.weeks === 1 ? 'semana' : 'semanas'} />
                  <View style={s.datoSep} />
                  <Dato valor={String(p.days_per_week)} etiqueta="días/semana" />
                  <View style={s.datoSep} />
                  <Dato valor={String(totalEjercicios)} etiqueta="ejercicios" />
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        <View style={s.bloque}>
          {p.description ? <Text style={s.descripcion}>{p.description}</Text> : null}

          {/* La descarga se explica, no se da por sabida: «deload» no significa
              nada para quien lleva tres meses entrenando. */}
          {p.deload_every ? (
            <View style={s.aviso}>
              <Ionicons name="battery-half-outline" size={17} color={Colors.neon.redCore} />
              <Text style={s.avisoTxt}>
                Cada {p.deload_every} semanas toca una más suave: menos series y algo
                menos de peso. No es perder el ritmo, es cuando el cuerpo termina de
                construir lo de las semanas anteriores.
              </Text>
            </View>
          ) : null}

          <Text style={s.seccion}>LOS DÍAS</Text>

          {p.plan.dias.map((d, i) => (
            <Animated.View key={d.dia} entering={FadeInDown.delay(Math.min(60 + i * 50, 340)).duration(340)}>
              <DiaPlegable
                dia={d}
                posters={p.posters}
                abierto={abierto === d.dia}
                onTocar={() => {
                  void Haptics.selectionAsync()
                  setAbierto(x => x === d.dia ? null : d.dia)
                }}
              />
            </Animated.View>
          ))}

          <Text style={s.pie}>
            Los pesos no están escritos en el plan: se calculan con lo que tú has
            levantado. La primera semana los eliges tú y a partir de ahí el programa
            los propone — y siempre puedes cambiarlos.
          </Text>
        </View>
      </ScrollView>

      {/* ── Empezar ────────────────────────────────────────────────────── */}
      <View style={s.pieFijo}>
        <TouchableOpacity style={s.boton} onPress={empezar} activeOpacity={0.88} disabled={empezando}>
          {empezando
            ? <ActivityIndicator color="#fff" />
            : <>
                <Text style={s.botonTxt}>Empezar este programa</Text>
                <Ionicons name="arrow-forward" size={17} color="#fff" />
              </>}
        </TouchableOpacity>
      </View>
    </Screen>
  )
}

function DiaPlegable({ dia, posters, abierto, onTocar }: {
  dia: DiaPlan
  posters: Record<string, string>
  abierto: boolean
  onTocar: () => void
}) {
  const series = dia.ejercicios.reduce((a, e) => a + e.series, 0)

  return (
    <View style={s.dia}>
      <TouchableOpacity style={s.diaCabecera} onPress={onTocar} activeOpacity={0.85}>
        <View style={s.diaNum}><Text style={s.diaNumTxt}>{dia.dia}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.diaNombre}>{dia.nombre}</Text>
          <Text style={s.diaSub}>
            {dia.ejercicios.length} ejercicios · {series} series
            {dia.foco ? ` · ${NOMBRE_GRUPO[dia.foco] ?? dia.foco}` : ''}
          </Text>
        </View>
        <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={17} color={Colors.neon.w3} />
      </TouchableOpacity>

      {abierto && (
        <View style={s.diaLista}>
          {dia.ejercicios.map((e, i) => (
            <View key={`${e.slug ?? e.nombre}-${i}`} style={s.fila}>
              <Miniatura poster={e.slug ? posters[e.slug] : null} tam={42} />
              <View style={{ flex: 1 }}>
                <Text style={s.filaNombre} numberOfLines={1}>{e.nombre}</Text>
                <Text style={s.filaSub}>
                  {prescripcion(e)} · {e.descanso}s descanso
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const Pastilla = ({ texto }: { texto: string }) => (
  <View style={s.pastilla}><Text style={s.pastillaTxt}>{texto}</Text></View>
)

const Dato = ({ valor, etiqueta }: { valor: string; etiqueta: string }) => (
  <View style={{ alignItems: 'center', flex: 1 }}>
    <Text style={s.datoValor}>{valor}</Text>
    <Text style={s.datoEtiqueta}>{etiqueta}</Text>
  </View>
)

const s = StyleSheet.create({
  cargando: { paddingVertical: Spacing[8], alignItems: 'center' },

  zonaHero: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[4] },
  hero: {
    height: 300, borderRadius: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: Colors.neon.void,
  },
  heroDentro: { flex: 1, justifyContent: 'space-between', padding: Spacing[4] },
  pastillas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pastilla: {
    paddingHorizontal: Spacing[2] + 2, paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  pastillaTxt: { fontSize: 10, fontWeight: '700', color: Colors.neon.w2 },
  heroTitulo: { fontSize: 30, fontWeight: '800', color: Colors.neon.white, letterSpacing: -0.9, lineHeight: 34 },

  datos: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing[3],
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  datoSep: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.14)' },
  datoValor: { fontSize: 20, fontWeight: '800', color: Colors.neon.white, letterSpacing: -0.5 },
  datoEtiqueta: { fontSize: 10, color: Colors.neon.w2, marginTop: 1 },

  bloque: { paddingHorizontal: Spacing[4], gap: Spacing[3] },
  descripcion: { fontSize: Typography.fontSize.sm, color: Colors.neon.w2, lineHeight: 21 },

  aviso: {
    flexDirection: 'row', gap: Spacing[3], alignItems: 'flex-start',
    padding: Spacing[3] + 2,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.neon.redDim,
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.28)',
  },
  avisoTxt: { flex: 1, fontSize: 12, color: Colors.neon.w2, lineHeight: 17 },

  seccion: { fontSize: 10, fontWeight: '800', color: Colors.neon.w3, letterSpacing: 1.6, marginTop: Spacing[2] },

  dia: {
    backgroundColor: Colors.neon.pane,
    borderRadius: 18,
    borderWidth: 1, borderColor: Colors.neon.edge,
    overflow: 'hidden',
  },
  diaCabecera: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], padding: Spacing[3] + 2 },
  diaNum: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  diaNumTxt: { fontSize: 13, fontWeight: '800', color: Colors.neon.w2 },
  diaNombre: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white },
  diaSub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },

  diaLista: { paddingHorizontal: Spacing[3] + 2, paddingBottom: Spacing[3] },
  fila: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingVertical: Spacing[2] + 2,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.055)',
  },
  filaNombre: { fontSize: 13, fontWeight: '700', color: Colors.neon.white },
  filaSub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },

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
  botonTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
})
