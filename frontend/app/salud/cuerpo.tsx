/**
 * SALUD · TU CUERPO
 * ═══════════════════════════════════════════════════════════════════════════
 * Lo que se mide de vez en cuando: pulso, peso, medidas y la ficha médica.
 *
 * ── Por qué existe este reparto ────────────────────────────────────────────
 * Antes eran cuatro casillas sueltas en la pestaña de Salud, del mismo tamaño
 * que el check-in diario. Y no son lo mismo: el check-in se hace todas las
 * mañanas y esto se toca una vez al mes —o el día que hace falta enseñarle
 * algo a un médico—. Dándoles el mismo peso, lo de cada día quedaba enterrado
 * entre lo de cada tanto.
 *
 * ── Las cifras de arriba son las últimas REALES ────────────────────────────
 * Un hueco donde no se ha medido nada, nunca un cero. De un teléfono que no
 * ha tomado una pulsación no se puede afirmar que el pulso sea cero.
 */

import { useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, type Href } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useHealthTrackerStore } from '@/store/healthTrackerStore'
import { elegir } from '@/utils/haptica'
import { Spacing } from '@/constants/theme'

type IconName = React.ComponentProps<typeof Ionicons>['name']

const DESTINOS: Array<{ icono: IconName; titulo: string; lema: string; ruta: Href }> = [
  {
    icono: 'stats-chart-outline',
    titulo: 'Historial',
    lema: 'Pasos, sueño y frecuencia cardíaca',
    ruta: '/health-tracker',
  },
  {
    icono: 'body-outline',
    titulo: 'Medidas y peso',
    lema: 'Lo que registras cada semana',
    ruta: '/measurements',
  },
  {
    icono: 'medkit-outline',
    titulo: 'Ficha médica',
    lema: 'Alergias, grupo sanguíneo y contactos',
    ruta: '/medical-id',
  },
]

export default function Cuerpo() {
  const load = useHealthTrackerStore(s => s.load)
  useEffect(() => { void load() }, [load])

  const resumen = useHealthTrackerStore.getState().getTodaySummary()
  const pulso = useHealthTrackerStore.getState().getRestingHeartRate()

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <View style={s.head}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={s.volver}>
              <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.7)" />
            </Pressable>
            <Text style={s.eyebrow}>ZENCRUS · SALUD</Text>
            <Text style={s.titulo}>Tu cuerpo</Text>
          </View>

          <View style={s.tira}>
            <Lectura valor={pulso} unidad="lpm" etiqueta="Pulso en reposo" />
            <View style={s.filete} />
            <Lectura
              valor={resumen.sleepHours != null ? resumen.sleepHours.toFixed(1) : null}
              unidad="h" etiqueta="Sueño de anoche"
            />
            <View style={s.filete} />
            <Lectura valor={resumen.steps} etiqueta="Pasos hoy" />
          </View>

          {DESTINOS.map(d => (
            <Pressable
              key={d.titulo}
              onPress={() => { elegir(); router.push(d.ruta) }}
              style={({ pressed }) => [s.fila, pressed && s.pulsado]}
              accessibilityRole="button"
              accessibilityLabel={`${d.titulo}. ${d.lema}`}
            >
              <View style={s.caja}><Ionicons name={d.icono} size={18} color="#FF7A1F" /></View>
              <View style={s.textos}>
                <Text style={s.filaTitulo}>{d.titulo}</Text>
                <Text style={s.filaLema}>{d.lema}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color="rgba(255,255,255,0.35)" />
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

/** Una lectura, o el hueco honesto de que no la hay. */
function Lectura({ valor, unidad, etiqueta }: {
  valor: number | string | null
  unidad?: string
  etiqueta: string
}) {
  const vacio = valor == null || valor === ''
  return (
    <View style={s.lectura}>
      <View style={s.lecturaFila}>
        <Text style={[s.lecturaValor, vacio && s.lecturaVacia]}>{vacio ? '—' : valor}</Text>
        {unidad && !vacio ? <Text style={s.lecturaUnidad}>{unidad}</Text> : null}
      </View>
      <Text style={s.lecturaEtiqueta}>{etiqueta}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050505' },
  safe: { flex: 1 },
  scroll: { paddingBottom: 130 },
  pulsado: { opacity: 0.75 },

  head: { paddingHorizontal: Spacing[5], paddingTop: Spacing[2], paddingBottom: Spacing[5] },
  volver: { width: 34, height: 34, justifyContent: 'center', marginLeft: -6, marginBottom: Spacing[2] },
  eyebrow: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 11, color: '#FF5C00',
    letterSpacing: 2.8, marginBottom: 6,
  },
  titulo: { fontFamily: 'Inter_600SemiBold', fontSize: 34, color: '#fff', letterSpacing: -1 },

  tira: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing[5], marginBottom: Spacing[5],
    paddingVertical: Spacing[4], paddingHorizontal: Spacing[3],
    borderRadius: 18, backgroundColor: '#17181c',
  },
  filete: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.08)' },
  lectura: { flex: 1, alignItems: 'center' },
  lecturaFila: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  lecturaValor: {
    fontFamily: 'GeistMono_500Medium', fontSize: 22, color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  lecturaVacia: { color: 'rgba(255,255,255,0.3)' },
  lecturaUnidad: { fontFamily: 'Inter_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  lecturaEtiqueta: {
    fontFamily: 'Inter_400Regular', fontSize: 11,
    color: 'rgba(255,255,255,0.45)', marginTop: 4,
  },

  fila: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    marginHorizontal: Spacing[5], marginBottom: 9,
    paddingHorizontal: 14, height: 68, borderRadius: 16, backgroundColor: '#17181c',
  },
  caja: {
    width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,122,31,0.14)',
  },
  textos: { flex: 1 },
  filaTitulo: { fontFamily: 'Inter_500Medium', fontSize: 15.5, color: '#fff' },
  filaLema: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
})
