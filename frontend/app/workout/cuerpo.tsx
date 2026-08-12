/**
 * CUERPO
 * ──────
 * El mapa anatómico a pantalla completa. Es la pantalla que contesta «qué he
 * entrenado y qué tengo abandonado» sin leer una sola tabla.
 *
 * ── Dos lecturas, un botón ──────────────────────────────────────────────────
 * CARGA responde «¿reparto bien el trabajo?» y FRESCURA responde «¿qué puedo
 * entrenar hoy?». Son preguntas distintas sobre los mismos datos y por eso
 * comparten dibujo pero no color: mezclarlas en una sola escala daría un mapa
 * que no contesta ninguna de las dos.
 *
 * ── La ventana se elige ─────────────────────────────────────────────────────
 * Siete días para decidir el entrenamiento de hoy; treinta para ver si llevas
 * un mes sin tocar las piernas. El mismo cuerpo cuenta cosas muy distintas
 * según cuánto atrás se mire, así que la ventana no puede estar fija.
 */

import { useState, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import * as Haptics from 'expo-haptics'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { MenuSeccion, CabeceraSeccion } from '@/components/workout/MenuSeccion'
import { BodyMap, FichaMusculo, Lectura } from '@/components/workout/BodyMap'
import { Reparto, Vacio } from '@/components/workout/Charts'
import { NOMBRE_GRUPO, Vista } from '@/components/workout/anatomy'
import { getMusculos, Musculos, kilosCorto, desdeCuando } from '@/services/statsService'
import { COLOR_GRUPO } from '@/services/exerciseService'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

const VENTANAS = [
  { dias: 7, label: '7 días' },
  { dias: 30, label: '30 días' },
  { dias: 90, label: '90 días' },
]

export default function Cuerpo() {
  const [datos, setDatos] = useState<Musculos | null>(null)
  const [dias, setDias] = useState(7)
  const [vista, setVista] = useState<Vista>('frente')
  const [lectura, setLectura] = useState<Lectura>('carga')
  const [elegido, setElegido] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)

  const cargar = useCallback(async (d: number) => {
    try {
      setDatos(await getMusculos(d))
    } catch {
      setDatos(null)
    } finally {
      setCargando(false)
      setRefrescando(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { void cargar(dias) }, [cargar, dias]))

  const grupos = datos?.grupos ?? []
  const porGrupo = useMemo(() => new Map(grupos.map(g => [g.grupo, g])), [grupos])

  /**
   * El reparto del trabajo, ordenado de más a menos.
   *
   * `fullbody` se saca de la barra: un ejercicio de cuerpo entero no compite
   * con el pecho por el reparto, lo reparte. Dejarlo dentro haría que un día de
   * kettlebell pareciera que se entrenó un grupo muscular llamado «todo».
   */
  const porciones = grupos
    .filter(g => g.grupo !== 'fullbody' && g.series > 0)
    .sort((a, b) => b.series - a.series)
    .map(g => ({
      etiqueta: NOMBRE_GRUPO[g.grupo] ?? g.grupo,
      valor: g.series,
      color: COLOR_GRUPO[g.grupo] ?? Colors.neon.steel,
    }))

  /**
   * Los olvidados: entrenados una vez y hace mucho, o nunca.
   *
   * Es la información más accionable de la pantalla y por eso tiene su propio
   * bloque en vez de deducirse mirando qué está oscuro. Se ordena por lo que
   * lleva más tiempo sin tocarse.
   */
  const olvidados = grupos
    .filter(g => g.grupo !== 'fullbody' && g.series === 0)
    .sort((a, b) => {
      if (!a.ultimaVez) return -1
      if (!b.ultimaVez) return 1
      return a.ultimaVez.localeCompare(b.ultimaVez)
    })

  return (
    <Screen>
      <CabeceraSeccion
        titulo="Cuerpo"
        subtitulo={
          datos
            ? `${datos.totalSeries} ${datos.totalSeries === 1 ? 'serie' : 'series'} en ${dias} días`
            : 'Carga y recuperación por grupo'
        }
      />
      <MenuSeccion activo="cuerpo" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing[4], paddingBottom: 110, gap: Spacing[4] }}
        refreshControl={
          <RefreshControl refreshing={refrescando}
            onRefresh={() => { setRefrescando(true); void cargar(dias) }}
            tintColor={Colors.neon.w3} />
        }
      >
        {/* ── Ventana y lectura ────────────────────────────────────────── */}
        <View style={s.controles}>
          <View style={s.grupoBotones}>
            {VENTANAS.map(v => (
              <TouchableOpacity
                key={v.dias}
                style={[s.botonCorto, dias === v.dias && s.botonCortoOn]}
                onPress={() => { void Haptics.selectionAsync(); setDias(v.dias); setCargando(true) }}
                activeOpacity={0.85}
              >
                <Text style={[s.botonCortoTxt, dias === v.dias && s.botonCortoTxtOn]}>{v.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.lecturas}>
          {([
            { id: 'carga' as Lectura, label: 'Carga', pie: 'Cuánto has trabajado cada grupo' },
            { id: 'frescura' as Lectura, label: 'Frescura', pie: 'Qué tienes recuperado hoy' },
          ]).map(l => (
            <TouchableOpacity
              key={l.id}
              style={[s.lectura, lectura === l.id && s.lecturaOn]}
              onPress={() => { void Haptics.selectionAsync(); setLectura(l.id) }}
              activeOpacity={0.85}
            >
              <Text style={[s.lecturaTitulo, lectura === l.id && { color: Colors.neon.white }]}>{l.label}</Text>
              <Text style={s.lecturaPie}>{l.pie}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {cargando ? (
          <View style={s.cargando}><ActivityIndicator color={Colors.neon.w3} /></View>
        ) : (datos?.totalSeries ?? 0) === 0 ? (
          <Vacio texto={`Sin series registradas en los últimos ${dias} días. El mapa se enciende solo cuando entrenas.`} />
        ) : (
          <>
            {/* ── La figura ────────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.duration(360)} style={s.tarjeta}>
              <BodyMap
                grupos={grupos}
                vista={vista}
                lectura={lectura}
                onVista={setVista}
                seleccionado={elegido}
                onSeleccionar={setElegido}
                ancho={250}
              />
            </Animated.View>

            {elegido && (
              <Animated.View entering={FadeInDown.duration(280)}>
                <FichaMusculo
                  grupo={elegido}
                  datos={porGrupo.get(elegido)}
                  onCerrar={() => setElegido(null)}
                  onVerEjercicios={() => router.push(`/workout/library?muscle=${elegido}`)}
                />
              </Animated.View>
            )}

            {/* ── Reparto ──────────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(60).duration(360)} style={s.tarjeta}>
              <Text style={s.tarjetaTitulo}>Cómo repartes el trabajo</Text>
              <Reparto porciones={porciones} />
            </Animated.View>

            {/* ── Olvidados ────────────────────────────────────────────── */}
            {olvidados.length > 0 && (
              <Animated.View entering={FadeInDown.delay(120).duration(360)} style={s.tarjeta}>
                <Text style={s.tarjetaTitulo}>Sin tocar en {dias} días</Text>
                <Text style={s.tarjetaPie}>
                  No es una regañina: hay semanas en que toca. Pero si uno lleva meses
                  aquí, ahí está el desequilibrio que frena todo lo demás.
                </Text>
                <View style={s.olvidados}>
                  {olvidados.map(g => (
                    <TouchableOpacity
                      key={g.grupo}
                      style={s.olvidado}
                      onPress={() => router.push(`/workout/library?muscle=${g.grupo}`)}
                      activeOpacity={0.85}
                    >
                      <View style={[s.olvidadoPunto, { backgroundColor: COLOR_GRUPO[g.grupo] ?? Colors.neon.steel }]} />
                      <Text style={s.olvidadoNombre}>{NOMBRE_GRUPO[g.grupo] ?? g.grupo}</Text>
                      <Text style={s.olvidadoCuando}>{desdeCuando(g.ultimaVez)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Animated.View>
            )}

            {/* ── Detalle por grupo ────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(180).duration(360)} style={s.tarjeta}>
              <Text style={s.tarjetaTitulo}>Todos los grupos</Text>
              {grupos
                .filter(g => g.grupo !== 'fullbody')
                .sort((a, b) => b.series - a.series)
                .map(g => (
                  <TouchableOpacity
                    key={g.grupo}
                    style={s.fila}
                    onPress={() => { setElegido(g.grupo); void Haptics.selectionAsync() }}
                    activeOpacity={0.8}
                  >
                    <View style={[s.filaPunto, { backgroundColor: COLOR_GRUPO[g.grupo] ?? Colors.neon.steel }]} />
                    <Text style={s.filaNombre}>{NOMBRE_GRUPO[g.grupo] ?? g.grupo}</Text>
                    <Text style={s.filaSeries}>{g.series > 0 ? `${g.series} ${g.series === 1 ? 'serie' : 'series'}` : '—'}</Text>
                    <Text style={s.filaVolumen}>{g.volumen > 0 ? kilosCorto(g.volumen) : ''}</Text>
                  </TouchableOpacity>
                ))}
            </Animated.View>
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  cargando: { paddingVertical: Spacing[8], alignItems: 'center' },

  controles: { flexDirection: 'row', justifyContent: 'center' },
  grupoBotones: {
    flexDirection: 'row', gap: 4, padding: 3,
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  botonCorto: { paddingHorizontal: Spacing[4], paddingVertical: 7, borderRadius: BorderRadius.full },
  botonCortoOn: { backgroundColor: Colors.neon.paneHi },
  botonCortoTxt: { fontSize: 12, fontWeight: '700', color: Colors.neon.w3 },
  botonCortoTxtOn: { color: Colors.neon.white },

  lecturas: { flexDirection: 'row', gap: Spacing[2] },
  lectura: {
    flex: 1, gap: 2, padding: Spacing[3],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  lecturaOn: { borderColor: 'rgba(255,31,61,0.45)', backgroundColor: Colors.neon.redDim },
  lecturaTitulo: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: Colors.neon.w2 },
  lecturaPie: { fontSize: 10, color: Colors.neon.w3, lineHeight: 14 },

  tarjeta: {
    gap: Spacing[3], padding: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: 22,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  tarjetaTitulo: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white },
  tarjetaPie: { fontSize: 12, color: Colors.neon.w3, lineHeight: 18 },

  olvidados: { gap: Spacing[2] },
  olvidado: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingVertical: Spacing[2],
  },
  olvidadoPunto: { width: 8, height: 8, borderRadius: 4, opacity: 0.5 },
  olvidadoNombre: { flex: 1, fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.w2 },
  olvidadoCuando: { fontSize: 11, color: Colors.neon.w3 },

  fila: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingVertical: Spacing[3],
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.055)',
  },
  filaPunto: { width: 9, height: 9, borderRadius: 5 },
  filaNombre: { flex: 1, fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  filaSeries: { fontSize: 12, color: Colors.neon.w2, fontWeight: '600' },
  filaVolumen: { fontSize: 11, color: Colors.neon.w3, minWidth: 48, textAlign: 'right' },
})
