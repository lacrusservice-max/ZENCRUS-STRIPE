/**
 * AL AIRE LIBRE · RUTAS
 * ═════════════════════
 * Tus recorridos, para repetirlos.
 *
 * ── De dónde salen, que es la decisión que importa ──────────────────────────
 * NO hay un catálogo de rutas descargadas ni rutas «populares cerca de ti».
 * Eso pide un servicio externo que la app no tiene, y una lista de sitios
 * inventados sería peor que no tenerla: alguien saldría a buscar un sendero
 * que nadie ha comprobado que existe.
 *
 * Las rutas de aquí son **las que tú has corrido**, agrupadas por parecido.
 * Dos salidas se consideran la misma ruta si empiezan y acaban cerca y miden
 * casi lo mismo; entonces se pueden comparar entre sí, que es para lo que uno
 * quiere una ruta guardada.
 *
 * ── El umbral de «cerca» ────────────────────────────────────────────────────
 * 120 metros entre puntos de inicio. Más estricto y una misma vuelta al parque
 * saldría como tres rutas distintas por dónde aparcaste; más laxo y dos
 * recorridos que solo comparten el portal se mezclarían.
 */

import { useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { RunningColors } from '@/constants/running-tokens'
import { Tarjeta, Aura, Etiqueta, Chip } from '@/components/outdoor/Material'
import { Cifra, Metrica, FilaMetricas } from '@/components/outdoor/Cifra'
import { Recorrido } from '@/components/outdoor/Graficas'
import { Cabecera } from '@/components/outdoor/Cabecera'
import { BarraPestanas, ALTO_BARRA } from '@/components/outdoor/BarraPestanas'
import { DEPORTES } from '@/components/outdoor/Iconos'
import { useOutdoorStore, metrosEntre, ritmo, mmss, Actividad } from '@/store/outdoorStore'

const CERCA_M = 120
const PARECIDO = 0.12   // 12 % de diferencia de distancia

export default function Rutas() {
  const { width, height } = useWindowDimensions()
  const historial = useOutdoorStore(s => s.historial)

  /** Agrupa las salidas que son «la misma ruta». */
  const rutas = useMemo(() => {
    const grupos: Actividad[][] = []
    for (const a of historial) {
      if (a.puntos.length < 2 || a.metros < 200) continue
      const ini = a.puntos[0]
      const g = grupos.find(gr => {
        const ref = gr[0]
        if (ref.puntos.length < 2) return false
        const cerca = metrosEntre(ref.puntos[0], ini) < CERCA_M
        const parecida = Math.abs(ref.metros - a.metros) / Math.max(ref.metros, a.metros) < PARECIDO
        return cerca && parecida
      })
      if (g) g.push(a)
      else grupos.push([a])
    }
    return grupos.sort((x, y) => y.length - x.length)
  }, [historial])

  return (
    <View style={s.raiz}>
      <Aura ancho={width} alto={height} />
      <Cabecera
        titulo="Rutas"
        titular
        derecha={
          <Pressable onPress={() => router.push('/aire-libre/segmentos' as never)} hitSlop={10} style={s.accion}>
            <Ionicons name="podium-outline" size={17} color="rgba(255,255,255,0.7)" />
          </Pressable>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: ALTO_BARRA + 20 }}>
        {rutas.length === 0 ? (
          <Tarjeta>
            <Text style={s.vacioTit}>Todavía no hay rutas</Text>
            <Text style={s.vacioTxt}>
              Una ruta aparece sola en cuanto grabas una salida. Si repites el mismo
              recorrido, se agrupan y podrás compararte contigo mismo.
            </Text>
            <Text style={s.aviso}>
              No hay rutas descargadas ni «populares cerca de ti»: eso necesita un servicio
              externo que la app aún no tiene, y prefiero no inventar senderos.
            </Text>
          </Tarjeta>
        ) : (
          rutas.map((grupo, i) => {
            const ref = grupo[0]
            const km = ref.metros / 1000
            const mejor = grupo.reduce((m, a) => (a.segundos < m.segundos ? a : m))
            const ritMejor = ritmo(mejor.metros, mejor.segundos)
            return (
              <Pressable
                key={ref.id}
                onPress={() => router.push({ pathname: '/aire-libre/actividad/[id]', params: { id: mejor.id } } as never)}
                style={({ pressed }) => [{ marginBottom: 9 }, pressed && { opacity: 0.8 }]}
              >
                <Tarjeta plana>
                  <Recorrido puntos={ref.puntos} alto={118} grosor={4.4} />
                  <View style={{ padding: 15 }}>
                    <View style={s.ct}>
                      <Etiqueta>Ruta {i + 1}</Etiqueta>
                      <Chip>
                        {grupo.length} {grupo.length === 1 ? 'vez' : 'veces'}
                      </Chip>
                    </View>
                    <Cifra valor={km.toFixed(2)} unidad="km" tam={26} />
                    <View style={{ height: 12 }} />
                    <FilaMetricas>
                      <Metrica etiqueta="Deporte" valor={DEPORTES[ref.deporte].nombre} tam={13} />
                      <Metrica etiqueta="Mejor ritmo" valor={ritMejor ? mmss(ritMejor) : '—'} tam={13} />
                      <Metrica etiqueta="Desnivel" valor={String(Math.round(ref.desnivelPositivo))} unidad="m" tam={13} />
                    </FilaMetricas>
                  </View>
                </Tarjeta>
              </Pressable>
            )
          })
        )}
      </ScrollView>

      <BarraPestanas />
    </View>
  )
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: RunningColors.surface.void },
  accion: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  ct: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  vacioTit: { fontSize: 14.5, fontWeight: '700', color: '#fff', marginBottom: 5 },
  vacioTxt: { fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 18 },
  aviso: { fontSize: 10.5, color: 'rgba(255,255,255,0.32)', lineHeight: 15.5, marginTop: 11 },
})
