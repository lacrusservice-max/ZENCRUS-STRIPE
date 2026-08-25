/**
 * AL AIRE LIBRE · HOY
 * ═══════════════════
 * La portada del módulo.
 *
 * ── DE DÓNDE SALE CADA CIFRA ────────────────────────────────────────────────
 * Dos fuentes distintas y no se mezclan nunca:
 *
 *   · **Pasos** — de `healthTrackerStore`. Es lo que anda el usuario a lo largo
 *     del día, con o sin la app abierta. Alimenta el anillo.
 *   · **Salidas** — de `outdoorStore`, la captura por GPS. Son las carreras,
 *     rutas en bici y caminatas que se han grabado a propósito.
 *
 * Sumarlas sería tentador —«hoy llevas 12 km»— y estaría mal: los pasos de ir
 * al súper ya cuentan dentro de la carrera si llevabas el móvil encima. Sumar
 * las dos fuentes duplica todo lo que se solape.
 *
 * ── Si hay una actividad en marcha, manda ella ──────────────────────────────
 * Una salida a medias es lo más urgente que puede haber en esta pantalla, así
 * que se sube arriba del todo con un acceso directo para volver a ella. Salir
 * de la app a mitad de carrera y no encontrar el camino de vuelta es la manera
 * más rápida de perder un recorrido.
 */

import { useEffect, useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useHealthTrackerStore } from '@/store/healthTrackerStore'
import { RunningColors } from '@/constants/running-tokens'
import { Tarjeta, Aura, Etiqueta, Divisor, Chip, Boton } from '@/components/outdoor/Material'
import { Cifra, Metrica, FilaMetricas } from '@/components/outdoor/Cifra'
import { Anillo } from '@/components/outdoor/Anillo'
import { Recorrido } from '@/components/outdoor/Graficas'
import { Cabecera } from '@/components/outdoor/Cabecera'
import { BarraPestanas, ALTO_BARRA } from '@/components/outdoor/BarraPestanas'
import { DEPORTES } from '@/components/outdoor/Iconos'
import { useOutdoorStore, ritmo, mmss, hhmmss } from '@/store/outdoorStore'

const DIAS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

export default function AireLibreHoy() {
  const { load, getTodayProgress, getWeeklySummary, getRestingHeartRate, stepGoal } = useHealthTrackerStore()
  const estado = useOutdoorStore(s => s.estado)
  const actual = useOutdoorStore(s => s.actual)
  const historial = useOutdoorStore(s => s.historial)
  const resumen = useOutdoorStore(s => s.resumenSemana)()

  const { width, height } = useWindowDimensions()

  useEffect(() => { load() }, [])

  const hoy = getTodayProgress()
  const semana = getWeeklySummary()
  const reposo = getRestingHeartRate()

  /** Solo los días registrados. Sumar los `null` como cero hunde la media. */
  const sem = useMemo(() => {
    const conDato = semana.filter(d => d.steps != null)
    return {
      dias: conDato.length,
      pasos: conDato.reduce((a, d) => a + (d.steps ?? 0), 0),
      tope: Math.max(stepGoal, ...semana.map(d => d.steps ?? 0)),
    }
  }, [semana, stepGoal])

  const ultima = historial[0]

  return (
    <View style={s.raiz}>
      <Aura ancho={width} alto={height} />
      <Cabecera
        titulo="Hoy"
        titular
        derecha={
          <Pressable onPress={() => router.push('/aire-libre/ajustes' as never)} hitSlop={10} style={s.engranaje}>
            <Ionicons name="options-outline" size={17} color="rgba(255,255,255,0.7)" />
          </Pressable>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: ALTO_BARRA + 20 }}>

        {/* ── Una salida a medias manda sobre todo lo demás ── */}
        {actual && estado !== 'inactiva' && (
          <Pressable onPress={() => router.push('/aire-libre/marcha' as never)} style={{ marginBottom: 10 }}>
            <Tarjeta brasa>
              <View style={s.ct}>
                <Etiqueta>{estado === 'pausada' ? 'En pausa' : 'Grabando ahora'}</Etiqueta>
                <Chip tono={estado === 'pausada' ? RunningColors.state.loaded : RunningColors.state.restored}>
                  {DEPORTES[actual.deporte].nombre}
                </Chip>
              </View>
              <FilaMetricas>
                <Metrica etiqueta="Distancia" valor={(actual.metros / 1000).toFixed(2)} unidad="km" tam={22} />
                <Metrica etiqueta="Tiempo" valor={hhmmss(actual.segundos)} tam={22} />
                <Metrica etiqueta="Volver" valor="›" tam={22} />
              </FilaMetricas>
            </Tarjeta>
          </Pressable>
        )}

        {/* ── El anillo de pasos ── */}
        <View style={s.bloqueAnillo}>
          <Anillo valor={hoy.registrado ? hoy.steps / Math.max(1, stepGoal) : 0} tam={112}>
            {hoy.registrado ? (
              <>
                <Cifra valor={miles(hoy.steps)} tam={23} />
                <Etiqueta style={{ marginTop: 3, fontSize: 8 }}>de {miles(stepGoal)}</Etiqueta>
              </>
            ) : (
              <Etiqueta style={{ fontSize: 8, textAlign: 'center' }}>Sin{'\n'}registrar</Etiqueta>
            )}
          </Anillo>

          <View style={{ flex: 1 }}>
            <Etiqueta style={{ marginBottom: 7 }}>Pasos de hoy</Etiqueta>
            {[
              ['Distancia', hoy.registrado ? String(hoy.km) : '—', 'km'],
              ['Gasto', hoy.registrado ? String(hoy.calories) : '—', 'kcal'],
              ['Activo', hoy.registrado ? String(hoy.activeMin) : '—', 'min'],
            ].map(([l, v, u]) => (
              <View key={l} style={s.filaLado}>
                <Text style={s.filaLadoTxt}>{l}</Text>
                <Cifra valor={v} unidad={v === '—' ? undefined : u} tam={15} />
              </View>
            ))}
          </View>
        </View>

        {/* ── Salidas grabadas esta semana ── */}
        <Tarjeta>
          <View style={s.ct}>
            <Etiqueta>Salidas de esta semana</Etiqueta>
            {resumen.actividades > 0 && (
              <Text style={s.nota}>{resumen.actividades} {resumen.actividades === 1 ? 'salida' : 'salidas'}</Text>
            )}
          </View>

          {resumen.actividades === 0 ? (
            <>
              <Text style={s.cuerpo}>
                Todavía no has grabado ninguna esta semana. El GPS ya está listo: distancia,
                ritmo, parciales por kilómetro y el recorrido dibujado, también con la
                pantalla bloqueada.
              </Text>
              <View style={{ marginTop: 12 }}>
                <Boton rojo onPress={() => router.push('/aire-libre/empezar' as never)}>
                  <Ionicons name="flash" size={16} color="#fff" />  Empezar una salida
                </Boton>
              </View>
            </>
          ) : (
            <>
              <Cifra valor={(resumen.metros / 1000).toFixed(1)} unidad="km" tam={34} />
              <Divisor />
              <FilaMetricas>
                <Metrica etiqueta="Tiempo" valor={hhmmss(resumen.segundos)} tam={17} />
                <Metrica
                  etiqueta="Ritmo medio"
                  valor={ritmo(resumen.metros, resumen.segundos) ? mmss(ritmo(resumen.metros, resumen.segundos)!) : '—'}
                  tam={17}
                />
                <Metrica etiqueta="Desnivel" valor={String(resumen.desnivel)} unidad="m" tam={17} />
              </FilaMetricas>
            </>
          )}
        </Tarjeta>

        {/* ── La última salida ── */}
        {ultima && (
          <Pressable
            onPress={() => router.push({ pathname: '/aire-libre/actividad/[id]', params: { id: ultima.id } } as never)}
            style={{ marginTop: 9 }}
          >
            <Tarjeta plana>
              <Recorrido puntos={ultima.puntos} alto={104} grosor={4} />
              <View style={{ padding: 15 }}>
                <View style={s.ct}>
                  <Etiqueta>Tu última salida</Etiqueta>
                  <Chip>{DEPORTES[ultima.deporte].nombre}</Chip>
                </View>
                <FilaMetricas>
                  <Metrica etiqueta="Distancia" valor={(ultima.metros / 1000).toFixed(2)} unidad="km" tam={18} />
                  <Metrica etiqueta="Tiempo" valor={hhmmss(ultima.segundos)} tam={18} />
                  <Metrica
                    etiqueta="Ritmo"
                    valor={ritmo(ultima.metros, ultima.segundos) ? mmss(ritmo(ultima.metros, ultima.segundos)!) : '—'}
                    tam={18}
                  />
                </FilaMetricas>
              </View>
            </Tarjeta>
          </Pressable>
        )}

        {/* ── La semana de pasos ── */}
        <Tarjeta style={{ marginTop: 9 }}>
          <View style={s.ct}>
            <Etiqueta>Pasos de la semana</Etiqueta>
            <Text style={s.nota}>
              {sem.dias > 0 ? `${miles(sem.pasos)} en ${sem.dias} ${sem.dias === 1 ? 'día' : 'días'}` : 'Sin datos'}
            </Text>
          </View>
          <View style={s.semana}>
            {semana.slice().reverse().map((d, i) => {
              const hay = d.steps != null
              const alto = hay && sem.tope > 0 ? Math.max(4, ((d.steps as number) / sem.tope) * 100) : 0
              const fecha = new Date(d.date + 'T12:00:00')
              return (
                <View key={i} style={s.col}>
                  <View style={s.carril}>
                    {/* Un día sin registrar no pinta barra: siete tocones iguales se
                        leerían como siete días flojos, no como una semana en blanco. */}
                    {hay
                      ? <View style={[s.barra, { height: `${alto}%` as `${number}%` }]} />
                      : <View style={s.hueco} />}
                  </View>
                  <Text style={s.dia}>{DIAS[fecha.getDay()]}</Text>
                </View>
              )
            })}
          </View>
          {reposo != null && (
            <>
              <Divisor />
              <Text style={s.cuerpoTenue}>
                <Text style={s.fuerte}>{reposo} ppm</Text> en reposo. Con un pulsómetro conectado,
                las zonas de esfuerzo dejarían de estar vacías.
              </Text>
            </>
          )}
        </Tarjeta>
      </ScrollView>

      <BarraPestanas />
    </View>
  )
}

const miles = (n: number) => n.toLocaleString('es-MX')

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: RunningColors.surface.void },
  engranaje: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bloqueAnillo: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14 },
  filaLado: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingVertical: 3.5 },
  filaLadoTxt: { fontSize: 11.5, color: 'rgba(255,255,255,0.44)' },
  ct: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  nota: { fontSize: 10.5, color: 'rgba(255,255,255,0.38)' },
  cuerpo: { fontSize: 12.5, color: 'rgba(255,255,255,0.62)', lineHeight: 18.5 },
  cuerpoTenue: { fontSize: 11.5, color: 'rgba(255,255,255,0.45)', lineHeight: 17 },
  fuerte: { color: '#fff', fontWeight: '700' },
  semana: { flexDirection: 'row', gap: 6, height: 84, alignItems: 'flex-end' },
  col: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 5 },
  carril: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  barra: { width: '100%', borderRadius: 4, backgroundColor: RunningColors.signal.base },
  hueco: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.09)' },
  dia: { fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: '700' },
})
