/**
 * AL AIRE LIBRE · SEGMENTOS
 * ═════════════════════════
 * Los tramos donde compites contigo.
 *
 * ── QUÉ NO ES ESTO, QUE ES LO PRIMERO QUE HAY QUE DECIR ─────────────────────
 * NO son los segmentos de Strava. Aquellos son tramos públicos con una
 * clasificación mundial, y eso necesita un servidor donde todo el mundo suba
 * sus recorridos y un emparejado geométrico contra millones de trazas. La app
 * no tiene ni lo uno ni lo otro, y una tabla con corredores inventados sería
 * una estafa pequeña pero estafa.
 *
 * ── Qué SÍ es ──────────────────────────────────────────────────────────────
 * Cuando repites una ruta, cada kilómetro se convierte en un tramo comparable
 * contigo mismo: el mismo kilómetro 3, en tus cinco intentos. Eso es real, sale
 * de tus datos y es lo que de verdad usa alguien para saber si va mejor.
 *
 * ── Dos salidas son «la misma ruta» si ──────────────────────────────────────
 * empiezan a menos de 120 m una de otra y miden casi lo mismo (12 % de margen).
 * Es el mismo criterio que usa la pantalla de Rutas, y por lo mismo: más
 * estricto y una vuelta al parque sale como tres rutas según dónde aparcaste.
 */

import { useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native'
import { RunningColors } from '@/constants/running-tokens'
import { Tarjeta, Aura, Etiqueta, Divisor, Chip } from '@/components/outdoor/Material'
import { Cifra, Metrica, FilaMetricas } from '@/components/outdoor/Cifra'
import { Recorrido } from '@/components/outdoor/Graficas'
import { Cabecera } from '@/components/outdoor/Cabecera'
import { useOutdoorStore, metrosEntre, mmss, Actividad } from '@/store/outdoorStore'

const CERCA_M = 120
const PARECIDO = 0.12

export default function Segmentos() {
  const { width, height } = useWindowDimensions()
  const historial = useOutdoorStore(s => s.historial)

  /** Solo interesan las rutas hechas DOS o más veces: una sola no compara nada. */
  const repetidas = useMemo(() => {
    const grupos: Actividad[][] = []
    for (const a of historial) {
      if (a.puntos.length < 2 || a.parciales.length === 0) continue
      const g = grupos.find(gr => {
        const ref = gr[0]
        return metrosEntre(ref.puntos[0], a.puntos[0]) < CERCA_M
          && Math.abs(ref.metros - a.metros) / Math.max(ref.metros, a.metros) < PARECIDO
      })
      if (g) g.push(a); else grupos.push([a])
    }
    return grupos.filter(g => g.length >= 2)
  }, [historial])

  return (
    <View style={s.raiz}>
      <Aura ancho={width} alto={height} />
      <Cabecera
        titulo="Segmentos"
        sub={repetidas.length === 0 ? 'Ninguna ruta repetida todavía' : `${repetidas.length} ${repetidas.length === 1 ? 'ruta repetida' : 'rutas repetidas'}`}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 26 }}>
        <Tarjeta style={{ marginBottom: 12 }}>
          <Text style={s.aclaracion}>
            <Text style={s.fuerte}>No son los segmentos de Strava.</Text> Aquellos tienen una
            clasificación mundial y eso pide un servidor compartido que la app no tiene. Estos
            comparan cada kilómetro <Text style={s.fuerte}>contigo mismo</Text> cuando repites
            una ruta, que es lo que de verdad dice si vas mejor.
          </Text>
        </Tarjeta>

        {repetidas.length === 0 ? (
          <Tarjeta>
            <Text style={s.vacioTit}>Todavía no hay nada que comparar</Text>
            <Text style={s.vacioTxt}>
              Hace falta repetir una ruta al menos dos veces. En cuanto vuelvas por el mismo
              sitio, cada kilómetro se convierte en un tramo con historia.
            </Text>
          </Tarjeta>
        ) : (
          repetidas.map((grupo, gi) => {
            const ref = grupo[0]
            // Cuántos kilómetros tienen TODOS los intentos: comparar el km 7 de
            // una salida con el de otra que no llegó sería comparar con nada.
            const kmComunes = Math.min(...grupo.map(a => a.parciales.length))
            return (
              <View key={ref.id} style={{ marginBottom: 14 }}>
                <Tarjeta plana>
                  <Recorrido puntos={ref.puntos} alto={104} grosor={4} />
                  <View style={{ padding: 15 }}>
                    <View style={s.ct}>
                      <Etiqueta>Ruta {gi + 1}</Etiqueta>
                      <Chip>{grupo.length} intentos</Chip>
                    </View>
                    <FilaMetricas>
                      <Metrica etiqueta="Distancia" valor={(ref.metros / 1000).toFixed(2)} unidad="km" tam={16} />
                      <Metrica etiqueta="Tramos" valor={String(kmComunes)} unidad="km" tam={16} />
                      <Metrica
                        etiqueta="Mejor total"
                        valor={mmss(Math.min(...grupo.map(a => a.segundos)))}
                        tam={16}
                      />
                    </FilaMetricas>

                    <Divisor />
                    <Etiqueta style={{ marginBottom: 9 }}>Kilómetro a kilómetro</Etiqueta>

                    {Array.from({ length: kmComunes }, (_, k) => {
                      const tiempos = grupo.map(a => a.parciales[k].segundos)
                      const mejor = Math.min(...tiempos)
                      const peor = Math.max(...tiempos)
                      const ultimo = tiempos[0]          // el más reciente, historial va descendente
                      const esRecord = ultimo === mejor && grupo.length > 1
                      const dif = ultimo - mejor
                      return (
                        <View key={k} style={s.tramo}>
                          <Text style={s.tramoKm}>{k + 1}</Text>
                          <View style={s.carril}>
                            {/* Cada intento, un punto. El mejor, encendido. */}
                            {tiempos.map((t, ti) => {
                              const pos = peor === mejor ? 50 : ((peor - t) / (peor - mejor)) * 100
                              return (
                                <View
                                  key={ti}
                                  style={[
                                    s.punto,
                                    { left: `${Math.max(2, Math.min(96, pos))}%` as `${number}%` },
                                    t === mejor && s.puntoMejor,
                                    ti === 0 && s.puntoUltimo,
                                  ]}
                                />
                              )
                            })}
                          </View>
                          <Text style={[s.tramoDif, esRecord && { color: RunningColors.state.restored }]}>
                            {esRecord ? 'récord' : `+${mmss(dif)}`}
                          </Text>
                          <Cifra valor={mmss(ultimo)} tam={12} color={esRecord ? '#7BE8A8' : '#fff'} />
                        </View>
                      )
                    })}

                    <Text style={s.leyenda}>
                      Cada punto es un intento; el hueco, tu mejor marca. El punto blanco es la
                      última vez que pasaste por ahí.
                    </Text>
                  </View>
                </Tarjeta>
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: RunningColors.surface.void },
  ct: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  aclaracion: { fontSize: 11.5, color: 'rgba(255,255,255,0.55)', lineHeight: 17.5 },
  fuerte: { color: '#fff', fontWeight: '700' },
  vacioTit: { fontSize: 14.5, fontWeight: '700', color: '#fff', marginBottom: 5 },
  vacioTxt: { fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 18 },
  tramo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  tramoKm: { width: 13, fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.34)' },
  carril: {
    flex: 1, height: 16, borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
  },
  punto: {
    position: 'absolute', width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  puntoMejor: { backgroundColor: RunningColors.signal.base, width: 7, height: 7, borderRadius: 3.5 },
  puntoUltimo: { borderWidth: 1.5, borderColor: '#fff' },
  tramoDif: { width: 44, fontSize: 9.5, textAlign: 'right', color: 'rgba(255,255,255,0.34)' },
  leyenda: { fontSize: 10, color: 'rgba(255,255,255,0.3)', lineHeight: 14.5, marginTop: 10 },
})
