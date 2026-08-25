/**
 * PROGRAMAS
 * ─────────
 * Planes de varias semanas. Lo que convierte «voy al gimnasio» en «estoy
 * siguiendo algo».
 *
 * ── Si ya sigues uno, manda ─────────────────────────────────────────────────
 * El programa activo ocupa la portada con por dónde vas y un botón que lleva a
 * su línea de tiempo. El catálogo baja a segunda posición: alguien que ya está
 * en la semana cinco no entra aquí a elegir programa, entra a ver el suyo.
 *
 * ── Y solo hay cuatro ───────────────────────────────────────────────────────
 * Un catálogo de veinte parece generoso y es lo contrario: obliga a elegir
 * entre cosas que quien empieza no sabe distinguir. Estos cuatro cubren los
 * cuatro casos que existen hoy.
 */

import { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
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
import {
  listarProgramas, miInscripcion,
  ProgramaCabecera, Inscripcion,
  NOMBRE_OBJETIVO, NOMBRE_NIVEL, NOMBRE_MODO,
} from '@/services/programService'
import { fotoDePrograma } from '@/constants/imagenes'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

export default function Programas() {
  const [programas, setProgramas] = useState<ProgramaCabecera[]>([])
  const [mio, setMio] = useState<Inscripcion | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      // Las dos a la vez: son independientes y en serie tardarían el doble en
      // una conexión de gimnasio.
      const [lista, inscripcion] = await Promise.all([
        listarProgramas().catch(() => []),
        miInscripcion().catch(() => null),
      ])
      setProgramas(lista)
      setMio(inscripcion)
    } finally {
      setCargando(false)
      setRefrescando(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { void cargar() }, [cargar]))

  /* Los planes traen su lugar (`mode`). En la portada de casa, ofrecer uno que
     pide jaula y prensa es ofrecer lo que no se puede hacer; y al revés, en el
     gimnasio sobra el de suelo. */
  const { mode } = useLocalSearchParams<{ mode?: string }>()

  /**
   * EL QUE SIGUES TAMPOCO CRUZA DE SECCIÓN
   * ──────────────────────────────────────
   * Antes la cabecera enseñaba SIEMPRE el plan que sigues, viniera de donde
   * viniera, con este razonamiento: si lo escondes, «Cambiar de plan» deja de
   * enseñar el que quieres cambiar. Era cierto cuando esta pantalla era común.
   *
   * Ya no lo es: desde casa, «Cambiar de plan» ni siquiera aparece —dice
   * «Planes de varias semanas»— porque no tienes plan de casa. Así que enseñar
   * aquí «cesar», que es de gimnasio, era la última puerta por la que se colaba
   * una sección en la otra.
   */
  const mioDeAqui = mio && (!mode || mio.program?.mode === mode) ? mio : null

  const otros = programas
    .filter(p => p.id !== mio?.program_id)
    .filter(p => !mode || p.mode === mode)

  return (
    <Screen>
      <CabeceraSeccion
        titulo="Programas"
        subtitulo={mioDeAqui ? 'Estás siguiendo uno' : 'Planes de varias semanas'}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing[4], paddingBottom: 120, gap: Spacing[3] }}
        refreshControl={
          <RefreshControl refreshing={refrescando}
            onRefresh={() => { setRefrescando(true); void cargar() }}
            tintColor={Colors.neon.w3} />
        }
      >
        {cargando ? (
          <View style={s.cargando}><ActivityIndicator color={Colors.neon.red} /></View>
        ) : (
          <>
            {mioDeAqui && <EnCurso inscripcion={mioDeAqui} />}

            {/* Montar el tuyo, ANTES del catálogo.
                Quien llega aquí sin plan tiene dos caminos igual de válidos, y
                esconder el de «me lo monto yo» detrás de cuatro plantillas hace
                creer que solo se puede elegir de una lista. */}
            <TouchableOpacity
              style={s.montar}
              onPress={() => { void Haptics.selectionAsync()
                // El lugar sigue el camino: si llegaste filtrando por casa,
                // el plan que montes es de casa y no se vuelve a preguntar.
                router.push(mode ? `/workout/program/nuevo?modo=${mode}` : '/workout/program/nuevo') }}
              activeOpacity={0.85}
            >
              <View style={s.montarIcono}>
                <Ionicons name="add" size={21} color={Colors.neon.redCore} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.montarTitulo}>Monta tu propio plan</Text>
                <Text style={s.montarSub}>
                  Tus días, tus ejercicios. Los pesos los calcula la app igual que
                  en los de aquí abajo.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.neon.w3} />
            </TouchableOpacity>

            {otros.length > 0 && (
              <Text style={s.seccion}>
                {mioDeAqui ? 'OTROS PROGRAMAS' : 'O ELIGE UNO HECHO'}
              </Text>
            )}

            {otros.map((p, i) => (
              <Animated.View key={p.id} entering={FadeInDown.delay(Math.min(60 + i * 55, 400)).duration(340)}>
                <Tarjeta programa={p} />
              </Animated.View>
            ))}

            {programas.length === 0 && (
              <Vacio texto="No se pudo cargar el catálogo de programas. Tira hacia abajo para reintentar." />
            )}

            <Text style={s.pie}>
              Un programa dice qué hacer cada día y cuánto subir cada semana. Puedes
              saltarte un día sin perderlo: el plan avanza cuando entrenas, no cuando
              pasa el tiempo.
            </Text>
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

/**
 * El programa que se está siguiendo, en grande.
 *
 * El dato que preside no es el nombre: es POR DÓNDE VAS. Alguien que ya se
 * inscribió no necesita que le recuerden cómo se llama su programa, necesita
 * saber si le toca hoy y cuánto le queda.
 */
function EnCurso({ inscripcion }: { inscripcion: Inscripcion }) {
  const p = inscripcion.program
  const totalDias = p.weeks * p.days_per_week
  const hechos = inscripcion.completados.length
  const avance = totalDias > 0 ? hechos / totalDias : 0
  const esDescargaHoy = inscripcion.semanasDescarga.includes(inscripcion.current_week)

  return (
    <Animated.View entering={FadeIn.duration(420)} style={s.portada}>
      <Image
        source={fotoDePrograma(p)}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={300}
      />
      <LinearGradient
        colors={['rgba(5,5,6,0.28)', 'rgba(5,5,6,0.80)', 'rgba(5,5,6,0.98)']}
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={s.portadaDentro}>
        <View style={s.etiqueta}>
          <View style={s.punto} />
          <Text style={s.etiquetaTxt}>LO ESTÁS SIGUIENDO</Text>
        </View>

        <View style={{ gap: Spacing[3] }}>
          <View>
            <Text style={s.portadaTitulo} numberOfLines={2}>{p.name}</Text>
            <Text style={s.portadaSub}>
              Semana {inscripcion.current_week} de {p.weeks} · día {inscripcion.current_day} de {p.days_per_week}
              {esDescargaHoy ? ' · semana de descarga' : ''}
            </Text>
          </View>

          <View>
            <View style={s.barra}>
              <View style={[s.barraLlena, { width: `${Math.round(avance * 100)}%` }]} />
            </View>
            <Text style={s.barraTxt}>
              {hechos} de {totalDias} {totalDias === 1 ? 'día hecho' : 'días hechos'}
            </Text>
          </View>

          <View style={{ gap: Spacing[2] }}>
            <TouchableOpacity
              style={s.cta}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                router.push('/workout/program/day')
              }}
              activeOpacity={0.88}
            >
              <Text style={s.ctaTxt}>Ver el día de hoy</Text>
              <View style={s.ctaFlecha}>
                <Ionicons name="arrow-forward" size={16} color={Colors.neon.void} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.ctaSec}
              onPress={() => router.push('/workout/program/plan')}
              activeOpacity={0.85}
            >
              <Ionicons name="list-outline" size={15} color={Colors.neon.w2} />
              <Text style={s.ctaSecTxt}>El plan entero</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  )
}

function Tarjeta({ programa: p }: { programa: ProgramaCabecera }) {
  return (
    <TouchableOpacity
      style={s.tarjeta}
      onPress={() => router.push(`/workout/program/${p.id}`)}
      activeOpacity={0.88}
    >
      <Image source={fotoDePrograma(p)} style={StyleSheet.absoluteFill} contentFit="cover" transition={260} />
      <LinearGradient
        colors={['rgba(5,5,6,0.35)', 'rgba(5,5,6,0.88)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={s.tarjetaDentro}>
        <View style={s.pastillas}>
          <Pastilla texto={NOMBRE_NIVEL[p.level]} />
          <Pastilla texto={NOMBRE_MODO[p.mode] ?? p.mode} />
          {p.esMio && <Pastilla texto="Tuyo" destacada />}
        </View>

        <View>
          <Text style={s.tarjetaTitulo} numberOfLines={2}>{p.name}</Text>
          <Text style={s.tarjetaSub} numberOfLines={2}>{p.description}</Text>
          <Text style={s.tarjetaDatos}>
            {p.weeks} semanas · {p.days_per_week} {p.days_per_week === 1 ? 'día' : 'días'} por semana
            {' · '}{NOMBRE_OBJETIVO[p.goal]}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const Pastilla = ({ texto, destacada }: { texto: string; destacada?: boolean }) => (
  <View style={[s.pastilla, destacada && s.pastillaOn]}>
    <Text style={[s.pastillaTxt, destacada && { color: Colors.neon.white }]}>{texto}</Text>
  </View>
)

const s = StyleSheet.create({
  cargando: { paddingVertical: Spacing[8], alignItems: 'center' },
  seccion: { fontSize: 10, fontWeight: '800', color: Colors.neon.w3, letterSpacing: 1.6, marginTop: Spacing[2] },

  // ── Portada del programa en curso ──────────────────────────────────────────
  portada: {
    borderRadius: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: Colors.neon.void,
  },
  portadaDentro: { padding: Spacing[4], gap: Spacing[5], minHeight: 330, justifyContent: 'space-between' },
  etiqueta: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: Spacing[3], paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  punto: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.neon.red },
  etiquetaTxt: { fontSize: 9, fontWeight: '800', color: Colors.neon.void, letterSpacing: 1.1 },
  portadaTitulo: {
    fontSize: 28, fontWeight: '800', color: Colors.neon.white,
    letterSpacing: -0.8, lineHeight: 32,
  },
  portadaSub: { fontSize: 12, color: Colors.neon.w2, marginTop: 4 },

  barra: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
  barraLlena: { height: 4, borderRadius: 2, backgroundColor: Colors.neon.red },
  barraTxt: { fontSize: 11, color: Colors.neon.w2, marginTop: 6 },

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
  ctaSec: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: Spacing[3],
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  ctaSecTxt: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.w2 },

  montar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[4],
    borderRadius: 18,
    backgroundColor: Colors.neon.redDim,
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.3)',
  },
  montarIcono: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,31,61,0.16)',
  },
  montarTitulo: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: Colors.neon.white },
  montarSub: { fontSize: 11, color: Colors.neon.w2, marginTop: 2, lineHeight: 16 },

  // ── Tarjetas del catálogo ──────────────────────────────────────────────────
  tarjeta: {
    height: 210, borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.neon.edge,
    backgroundColor: Colors.neon.void,
  },
  tarjetaDentro: { flex: 1, justifyContent: 'space-between', padding: Spacing[4] },
  pastillas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pastilla: {
    paddingHorizontal: Spacing[2] + 2, paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  pastillaOn: { backgroundColor: Colors.neon.redDim, borderColor: 'rgba(255,31,61,0.45)' },
  pastillaTxt: { fontSize: 10, fontWeight: '700', color: Colors.neon.w2 },
  tarjetaTitulo: { fontSize: 21, fontWeight: '800', color: Colors.neon.white, letterSpacing: -0.5 },
  tarjetaSub: { fontSize: 12, color: Colors.neon.w2, marginTop: 3, lineHeight: 17 },
  tarjetaDatos: { fontSize: 11, color: Colors.neon.w3, marginTop: 6 },

  pie: {
    fontSize: 11, color: Colors.neon.w3, lineHeight: 16,
    paddingTop: Spacing[3],
  },
})
