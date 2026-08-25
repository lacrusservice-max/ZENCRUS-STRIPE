/**
 * EL PLAN, SEMANA A SEMANA
 * ────────────────────────
 * La línea de tiempo del programa que se está siguiendo: cada semana una etapa,
 * cada día una parada.
 *
 * ── Por qué una línea y no un calendario ────────────────────────────────────
 * Un calendario ata los días a fechas, y en cuanto alguien se salta un martes
 * el plan se llena de huecos rojos que no significan nada: el programa avanza
 * cuando entrenas, no cuando pasa el tiempo. Una línea solo dice el ORDEN, que
 * es lo único que el programa promete.
 *
 * ── Tres estados y se distinguen sin color ──────────────────────────────────
 * Hecho (tic), hoy (aro relleno) y por hacer (aro vacío). Se usa la FORMA
 * además del color porque un rojo y un gris a 12 px son el mismo punto para
 * mucha gente, y aquí saber por dónde vas es todo el contenido de la pantalla.
 *
 * ── Se puede abrir cualquier día ────────────────────────────────────────────
 * También los futuros. Mirar el jueves el lunes no rompe nada: la ficha del día
 * se pide con su semana y su día, y el programa solo avanza al TERMINAR el que
 * tocaba. Esconder lo que viene solo sirve para que nadie pueda prepararse.
 */

import { useState, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from 'react-native'
import { Image } from '@/components/ui/Imagen'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { CabeceraSeccion } from '@/components/workout/MenuSeccion'
import { Vacio } from '@/components/workout/Charts'
import { NOMBRE_GRUPO } from '@/components/workout/anatomy'
import {
  miInscripcion, abandonarPrograma, Inscripcion,
} from '@/services/programService'
import { fotoDePrograma } from '@/constants/imagenes'
import { kilosCorto } from '@/services/statsService'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

type Estado = 'hecho' | 'hoy' | 'porHacer'

export default function PlanDelPrograma() {
  const [ins, setIns] = useState<Inscripcion | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      setIns(await miInscripcion())
    } catch {
      setIns(null)
    } finally {
      setCargando(false)
      setRefrescando(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { void cargar() }, [cargar]))

  /**
   * Los días hechos, en un conjunto con clave «semana:día».
   *
   * Un `Set` y no un `find` por cada casilla: un programa de doce semanas por
   * cuatro días son 48 casillas, y recorrer la lista de completados en cada una
   * es un bucle dentro de otro para responder algo que es una consulta.
   */
  const hechos = useMemo(() => {
    const m = new Map<string, { volumen: number; series: number; sessionId: string }>()
    for (const c of ins?.completados ?? []) {
      m.set(`${c.semana}:${c.dia}`, { volumen: c.volumen, series: c.series, sessionId: c.sessionId })
    }
    return m
  }, [ins?.completados])

  const dejar = () => {
    Alert.alert(
      '¿Dejar el programa?',
      'Los entrenamientos que ya hiciste se quedan en tu historial y en tus récords. Lo único que se pierde es por dónde ibas.',
      [
        { text: 'Seguir con él', style: 'cancel' },
        {
          text: 'Dejarlo',
          style: 'destructive',
          onPress: async () => {
            try {
              await abandonarPrograma()
              router.replace('/workout/programs')
            } catch {
              Alert.alert('No se pudo', 'Inténtalo otra vez en un momento.')
            }
          },
        },
      ],
    )
  }

  if (cargando) {
    return (
      <Screen>
        <CabeceraSeccion titulo="Tu plan" />
        <View style={s.cargando}><ActivityIndicator color={Colors.neon.red} /></View>
      </Screen>
    )
  }

  if (!ins) {
    return (
      <Screen>
        <CabeceraSeccion titulo="Tu plan" />
        <View style={{ padding: Spacing[4], gap: Spacing[3] }}>
          <Vacio texto="No estás siguiendo ningún programa ahora mismo." />
          <TouchableOpacity style={s.verCatalogo} onPress={() => router.replace('/workout/programs')} activeOpacity={0.85}>
            <Text style={s.verCatalogoTxt}>Ver los programas</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    )
  }

  const p = ins.program
  const totalDias = p.weeks * p.days_per_week
  const avance = totalDias > 0 ? ins.completados.length / totalDias : 0
  const nombreDia = (dia: number) => p.plan.dias.find(d => d.dia === dia)?.nombre ?? `Día ${dia}`
  const focoDia = (dia: number) => p.plan.dias.find(d => d.dia === dia)?.foco

  const estadoDe = (semana: number, dia: number): Estado => {
    if (hechos.has(`${semana}:${dia}`)) return 'hecho'
    if (semana === ins.current_week && dia === ins.current_day) return 'hoy'
    return 'porHacer'
  }

  return (
    <Screen>
      <CabeceraSeccion
        titulo="Tu plan"
        subtitulo={`Semana ${ins.current_week} de ${p.weeks}`}
        derecha={
          <TouchableOpacity onPress={dejar} hitSlop={10} style={{ padding: 4 }}>
            <Ionicons name="exit-outline" size={19} color={Colors.neon.w3} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing[4], paddingBottom: 120, gap: Spacing[4] }}
        refreshControl={
          <RefreshControl refreshing={refrescando}
            onRefresh={() => { setRefrescando(true); void cargar() }}
            tintColor={Colors.neon.w3} />
        }
      >
        {/* ── Cabecera del programa ───────────────────────────────────── */}
        <Animated.View entering={FadeIn.duration(400)} style={s.hero}>
          <Image source={fotoDePrograma(p)} style={StyleSheet.absoluteFill} contentFit="cover" transition={280} />
          <LinearGradient
            colors={['rgba(5,5,6,0.35)', 'rgba(5,5,6,0.92)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={s.heroDentro}>
            <Text style={s.heroTitulo} numberOfLines={2}>{p.name}</Text>
            <View style={s.barra}>
              <View style={[s.barraLlena, { width: `${Math.round(avance * 100)}%` }]} />
            </View>
            <Text style={s.heroPie}>
              {ins.completados.length} de {totalDias} días · empezado{' '}
              {new Date(ins.started_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
            </Text>
          </View>
        </Animated.View>

        {/* ── La línea ────────────────────────────────────────────────── */}
        {Array.from({ length: p.weeks }, (_, i) => i + 1).map((semana, idx) => {
          const descarga = ins.semanasDescarga.includes(semana)
          const dias = Array.from({ length: p.days_per_week }, (_, i) => i + 1)
          const completaLaSemana = dias.every(d => hechos.has(`${semana}:${d}`))

          return (
            <Animated.View
              key={semana}
              entering={FadeInDown.delay(Math.min(idx * 35, 320)).duration(320)}
              style={s.semana}
            >
              <View style={s.semanaCabecera}>
                <Text style={[s.semanaTitulo, completaLaSemana && { color: Colors.neon.w2 }]}>
                  SEMANA {semana}
                </Text>
                {descarga && (
                  <View style={s.descarga}>
                    <Ionicons name="battery-half-outline" size={11} color={Colors.neon.redCore} />
                    <Text style={s.descargaTxt}>DESCARGA</Text>
                  </View>
                )}
                {completaLaSemana && (
                  <Ionicons name="checkmark-circle" size={15} color={Colors.neon.w2} />
                )}
              </View>

              <View style={s.dias}>
                {dias.map((dia, j) => {
                  const estado = estadoDe(semana, dia)
                  const hecho = hechos.get(`${semana}:${dia}`)
                  const ultimo = j === dias.length - 1

                  return (
                    <TouchableOpacity
                      key={dia}
                      style={s.dia}
                      onPress={() => {
                        void Haptics.selectionAsync()
                        router.push(`/workout/program/day?week=${semana}&day=${dia}`)
                      }}
                      activeOpacity={0.8}
                    >
                      {/* El raíl y el nodo: la línea se corta en el último de la
                          semana para que las semanas se lean como bloques. */}
                      <View style={s.rail}>
                        <Nodo estado={estado} />
                        {!ultimo && <View style={[s.hilo, estado === 'hecho' && s.hiloHecho]} />}
                      </View>

                      <View style={s.diaCuerpo}>
                        <Text style={[s.diaNombre, estado === 'porHacer' && { color: Colors.neon.w2 }]}>
                          {nombreDia(dia)}
                        </Text>
                        <Text style={s.diaSub}>
                          {hecho
                            ? `${hecho.series} series${hecho.volumen > 0 ? ` · ${kilosCorto(hecho.volumen)}` : ''}`
                            : estado === 'hoy'
                              ? 'Te toca hoy'
                              : focoDia(dia)
                                ? (NOMBRE_GRUPO[focoDia(dia) as string] ?? focoDia(dia))
                                : 'Por hacer'}
                        </Text>
                      </View>

                      {estado === 'hoy' && (
                        <View style={s.hoyPastilla}><Text style={s.hoyTxt}>HOY</Text></View>
                      )}
                      <Ionicons name="chevron-forward" size={15} color={Colors.neon.w4} />
                    </TouchableOpacity>
                  )
                })}
              </View>
            </Animated.View>
          )
        })}

        <Text style={s.pie}>
          Saltarte un día no rompe nada: el programa avanza cuando terminas un
          entrenamiento, no cuando pasa el día en el calendario.
        </Text>
      </ScrollView>
    </Screen>
  )
}

/**
 * El nodo de la línea.
 *
 * Tres formas distintas, no tres colores: un tic para lo hecho, un aro relleno
 * para hoy y un aro vacío para lo que viene.
 */
function Nodo({ estado }: { estado: Estado }) {
  if (estado === 'hecho') {
    return (
      <View style={[n.base, n.hecho]}>
        <Ionicons name="checkmark" size={12} color={Colors.neon.void} />
      </View>
    )
  }
  if (estado === 'hoy') {
    return (
      <View style={[n.base, n.hoy]}>
        <View style={n.centro} />
      </View>
    )
  }
  return <View style={[n.base, n.porHacer]} />
}

const n = StyleSheet.create({
  base: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  hecho: { backgroundColor: Colors.neon.white },
  hoy: { borderWidth: 2, borderColor: Colors.neon.red, backgroundColor: Colors.neon.redDim },
  centro: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.neon.red },
  porHacer: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)' },
})

const s = StyleSheet.create({
  cargando: { paddingVertical: Spacing[8], alignItems: 'center' },
  verCatalogo: {
    alignItems: 'center', paddingVertical: Spacing[4],
    borderRadius: BorderRadius.lg, backgroundColor: Colors.neon.red,
  },
  verCatalogoTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },

  hero: {
    height: 150, borderRadius: 20, overflow: 'hidden',
    justifyContent: 'flex-end',
    borderWidth: 1, borderColor: Colors.neon.edge,
    backgroundColor: Colors.neon.void,
  },
  heroDentro: { padding: Spacing[4], gap: Spacing[2] },
  heroTitulo: { fontSize: 21, fontWeight: '800', color: Colors.neon.white, letterSpacing: -0.5 },
  barra: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
  barraLlena: { height: 4, borderRadius: 2, backgroundColor: Colors.neon.red },
  heroPie: { fontSize: 11, color: Colors.neon.w2 },

  semana: { gap: Spacing[2] },
  semanaCabecera: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  semanaTitulo: { fontSize: 10, fontWeight: '800', color: Colors.neon.white, letterSpacing: 1.6 },
  descarga: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.neon.redDim,
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.3)',
  },
  descargaTxt: { fontSize: 8.5, fontWeight: '800', color: Colors.neon.redCore, letterSpacing: 0.8 },

  dias: {
    backgroundColor: Colors.neon.pane,
    borderRadius: 18,
    borderWidth: 1, borderColor: Colors.neon.edge,
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[3],
  },
  dia: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },

  /**
   * El raíl con altura fija.
   *
   * 54 px: es lo que mide una fila con su nombre y su línea de debajo. Si se
   * dejara crecer con el contenido, el hilo de un día con texto largo se
   * estiraría y la línea saldría desigual.
   */
  rail: { width: 20, height: 54, alignItems: 'center' },
  hilo: { flex: 1, width: 2, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 2 },
  hiloHecho: { backgroundColor: 'rgba(255,255,255,0.30)' },

  diaCuerpo: { flex: 1, paddingBottom: 2 },
  diaNombre: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  diaSub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },

  hoyPastilla: {
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.neon.red,
  },
  hoyTxt: { fontSize: 8.5, fontWeight: '800', color: '#fff', letterSpacing: 0.8 },

  pie: { fontSize: 11, color: Colors.neon.w3, lineHeight: 16 },
})
