/**
 * AL AIRE LIBRE · PROGRESO
 * ════════════════════════
 * Hacia dónde vas. Tres cosas en una pantalla porque se leen juntas:
 * el volumen por semana, las mejores marcas y la carga de entrenamiento.
 *
 * ── LA CARGA SE CALCULA CON TIEMPO, Y SE DICE ───────────────────────────────
 * Lo suyo es ponderar cada minuto por el esfuerzo al que fue —eso es lo que
 * hace Garmin— y para eso hace falta el pulso. Sin pulsómetro, aquí la carga
 * es **minutos en movimiento**, sin ponderar. Sirve para ver la tendencia y
 * para avisar de un salto brusco de volumen, que es lo que lesiona; no sirve
 * para comparar una sesión de series con un rodaje suave de la misma duración.
 *
 * Eso está escrito en la pantalla, no solo aquí. Un número que parece carga de
 * entrenamiento y no lo es acaba tomándose decisiones de descanso encima.
 *
 * ── El aviso del 10 % ───────────────────────────────────────────────────────
 * Subir el volumen semanal más de un 10 % es la regla más vieja y más útil que
 * hay sobre lesiones por sobrecarga. Se compara la última semana con la media
 * de las cuatro anteriores, no con la semana pasada suelta: una semana floja
 * por gripe convertiría la vuelta a la normalidad en una alarma falsa.
 */

import { useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { RunningColors } from '@/constants/running-tokens'
import { Tarjeta, Aura, Etiqueta, Divisor, Chip } from '@/components/outdoor/Material'
import { Cifra, Metrica, FilaMetricas } from '@/components/outdoor/Cifra'
import { Barras, CargaYForma } from '@/components/outdoor/Graficas'
import { Cabecera } from '@/components/outdoor/Cabecera'
import { BarraPestanas, ALTO_BARRA } from '@/components/outdoor/BarraPestanas'
import { DEPORTES, ORDEN_DEPORTES } from '@/components/outdoor/Iconos'
import { useOutdoorStore, hhmmss } from '@/store/outdoorStore'

const SEMANA_MS = 7 * 24 * 3600 * 1000

export default function Progreso() {
  const { width, height } = useWindowDimensions()
  const historial = useOutdoorStore(s => s.historial)
  const records = useOutdoorStore(s => s.records)()

  /** Las últimas 8 semanas. `null` = semana sin registrar, y no pinta barra. */
  const semanas = useMemo(() => {
    const ahora = Date.now()
    return Array.from({ length: 8 }, (_, i) => {
      const desde = ahora - (8 - i) * SEMANA_MS
      const hasta = desde + SEMANA_MS
      const dentro = historial.filter(a => a.inicio >= desde && a.inicio < hasta)
      if (dentro.length === 0) return null
      return {
        km: dentro.reduce((x, a) => x + a.metros, 0) / 1000,
        minutos: dentro.reduce((x, a) => x + a.segundos, 0) / 60,
        n: dentro.length,
      }
    })
  }, [historial])

  const conDato = semanas.filter(Boolean) as { km: number; minutos: number; n: number }[]
  const ultima = semanas[7]
  const anteriores = semanas.slice(3, 7).filter(Boolean) as typeof conDato
  const media = anteriores.length ? anteriores.reduce((x, s) => x + s.km, 0) / anteriores.length : 0
  const salto = ultima && media > 0 ? ((ultima.km - media) / media) * 100 : null

  const totalKm = historial.reduce((x, a) => x + a.metros, 0) / 1000
  const totalSeg = historial.reduce((x, a) => x + a.segundos, 0)
  const totalDesnivel = Math.round(historial.reduce((x, a) => x + a.desnivelPositivo, 0))

  const porDeporte = ORDEN_DEPORTES.map(d => ({
    d,
    km: historial.filter(a => a.deporte === d).reduce((x, a) => x + a.metros, 0) / 1000,
  })).filter(x => x.km > 0)
  const topeDeporte = Math.max(1, ...porDeporte.map(x => x.km))

  /** Serie de carga: minutos por semana, cruda y suavizada a 4 semanas. */
  const carga = useMemo(() => {
    const min = semanas.map(s => s?.minutos ?? 0)
    const cronica = min.map((_, i) => {
      const v = min.slice(Math.max(0, i - 3), i + 1)
      return v.reduce((a, b) => a + b, 0) / v.length
    })
    return { aguda: min, cronica }
  }, [semanas])

  return (
    <View style={s.raiz}>
      <Aura ancho={width} alto={height} />
      <Cabecera
        titulo="Progreso"
        titular
        derecha={
          <Pressable onPress={() => router.push('/aire-libre/planes' as never)} hitSlop={10} style={s.accion}>
            <Ionicons name="school-outline" size={17} color="rgba(255,255,255,0.7)" />
          </Pressable>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: ALTO_BARRA + 20 }}>
        {historial.length === 0 ? (
          <Tarjeta>
            <Text style={s.vacioTit}>Aún no hay nada que comparar</Text>
            <Text style={s.vacioTxt}>
              El progreso necesita al menos dos o tres salidas. En cuanto grabes alguna,
              aquí aparecen el volumen por semana, tus marcas y la carga.
            </Text>
          </Tarjeta>
        ) : (
          <>
            {/* ── Volumen ── */}
            <Tarjeta>
              <View style={s.ct}>
                <Etiqueta>Últimas 8 semanas</Etiqueta>
                {salto != null && (
                  <Chip tono={salto > 10 ? RunningColors.state.loaded : RunningColors.state.restored}>
                    {salto > 0 ? '+' : ''}{Math.round(salto)} % vs media
                  </Chip>
                )}
              </View>
              <Cifra valor={(ultima?.km ?? 0).toFixed(1)} unidad="km" tam={34} />
              <View style={{ height: 10 }} />
              <Barras valores={semanas.map(s => (s ? s.km : null))} alto={70} />
              <Divisor />
              <FilaMetricas>
                <Metrica etiqueta="Total" valor={totalKm.toFixed(1)} unidad="km" tam={17} />
                <Metrica etiqueta="Tiempo" valor={hhmmss(totalSeg)} tam={17} />
                <Metrica etiqueta="Desnivel" valor={String(totalDesnivel)} unidad="m" tam={17} />
              </FilaMetricas>
            </Tarjeta>

            {/* ── Aviso de sobrecarga ── */}
            {salto != null && salto > 10 && (
              <Tarjeta brasa style={{ marginTop: 9 }}>
                <Etiqueta style={{ marginBottom: 6 }}>Cuidado con el salto</Etiqueta>
                <Text style={s.cuerpo}>
                  Has subido <Text style={s.fuerte}>{Math.round(salto)} %</Text> sobre la media de las
                  cuatro semanas previas. Por encima del 10 % es cuando aparecen las lesiones por
                  sobrecarga. Una semana suave ahora vale más que dos paradas después.
                </Text>
              </Tarjeta>
            )}

            {/* ── Reparto por deporte ── */}
            {porDeporte.length > 1 && (
              <Tarjeta style={{ marginTop: 9 }}>
                <Etiqueta style={{ marginBottom: 9 }}>Reparto por deporte</Etiqueta>
                {porDeporte.map(({ d, km }) => (
                  <View key={d} style={s.filaDeporte}>
                    <Text style={s.nombreDeporte}>{DEPORTES[d].nombre}</Text>
                    <View style={s.carril}>
                      <View style={[s.relleno, { width: `${Math.round((km / topeDeporte) * 100)}%` as `${number}%` }]} />
                    </View>
                    <Cifra valor={km.toFixed(1)} unidad="km" tam={12} />
                  </View>
                ))}
              </Tarjeta>
            )}

            {/* ── Marcas ── */}
            <Tarjeta style={{ marginTop: 9 }}>
              <Etiqueta style={{ marginBottom: 4 }}>Mejores marcas</Etiqueta>
              {Object.entries(records).map(([nombre, r], i) => (
                <View key={nombre} style={[s.filaRecord, i > 0 && s.filaBorde]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.recordNombre}>{nombre}</Text>
                    <Text style={s.recordFecha}>
                      {r ? new Date(r.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) : 'sin registrar'}
                    </Text>
                  </View>
                  <Cifra valor={r ? hhmmss(r.segundos) : '—'} tam={17} color={r ? '#fff' : 'rgba(255,255,255,0.28)'} />
                </View>
              ))}
              <Text style={s.aviso}>
                Se calculan con el ritmo medio de las salidas que cubrieron esa distancia.
                No es un cronómetro del mejor tramo: eso pide recorrer los puntos con una
                ventana deslizante, y llega después.
              </Text>
            </Tarjeta>

            {/* ── Carga ── */}
            <Tarjeta style={{ marginTop: 9 }}>
              <View style={s.ct}>
                <Etiqueta>Carga y forma</Etiqueta>
                <Text style={s.nota}>minutos por semana</Text>
              </View>
              <CargaYForma forma={carga.cronica} cansancio={carga.aguda} alto={84} />
              <View style={s.leyenda}>
                <View style={s.leyendaItem}>
                  <View style={[s.punto, { backgroundColor: RunningColors.state.optimal }]} />
                  <Text style={s.leyendaTxt}>Forma (media de 4 semanas)</Text>
                </View>
                <View style={s.leyendaItem}>
                  <View style={[s.punto, { backgroundColor: RunningColors.signal.base }]} />
                  <Text style={s.leyendaTxt}>Esta semana</Text>
                </View>
              </View>
              <Text style={s.aviso}>
                Sin pulsómetro, la carga son <Text style={s.fuerte}>minutos en movimiento sin ponderar</Text>.
                Vale para ver la tendencia y avisar de un salto brusco; no para comparar unas series
                con un rodaje de la misma duración.
              </Text>
            </Tarjeta>
          </>
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
  ct: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  nota: { fontSize: 10.5, color: 'rgba(255,255,255,0.4)' },
  cuerpo: { fontSize: 12.5, color: 'rgba(255,255,255,0.72)', lineHeight: 18.5 },
  fuerte: { color: '#fff', fontWeight: '700' },
  aviso: { fontSize: 10.5, color: 'rgba(255,255,255,0.32)', lineHeight: 15.5, marginTop: 11 },
  vacioTit: { fontSize: 14.5, fontWeight: '700', color: '#fff', marginBottom: 5 },
  vacioTxt: { fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 18 },
  filaDeporte: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 4.5 },
  nombreDeporte: { width: 74, fontSize: 11, color: 'rgba(255,255,255,0.72)' },
  carril: { flex: 1, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  relleno: { height: '100%', borderRadius: 4, backgroundColor: RunningColors.signal.base },
  filaRecord: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  filaBorde: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  recordNombre: { fontSize: 12.5, fontWeight: '600', color: '#fff' },
  recordFecha: { fontSize: 10.5, color: 'rgba(255,255,255,0.32)', marginTop: 1 },
  leyenda: { flexDirection: 'row', gap: 14, marginTop: 9 },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  punto: { width: 10, height: 2.5, borderRadius: 2 },
  leyendaTxt: { fontSize: 9.5, color: 'rgba(255,255,255,0.44)' },
})
