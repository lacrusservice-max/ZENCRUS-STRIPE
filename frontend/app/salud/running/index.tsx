/**
 * RUNNING
 * ═══════
 * El sitio de los pasos y, en cuanto esté la captura por GPS, de las carreras.
 *
 * ── Lo que hay hoy y lo que no ──────────────────────────────────────────────
 * Los pasos y su semana salen del historial que ya lleva la app. La grabación
 * de una carrera —GPS, ritmo, desnivel, splits— necesita el build nativo con
 * `expo-location` y `expo-task-manager`, que es lo que se acaba de preparar.
 *
 * Esta pantalla NO finge tener esa parte. Un botón «Empezar carrera» que no
 * grabara nada sería peor que no tenerlo: la promesa se cobra la primera vez
 * que alguien sale a la calle confiando en ella y vuelve sin su recorrido.
 */

import { useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useHealthTrackerStore } from '@/store/healthTrackerStore'
import { Colors, Glass, Typography, Spacing, BorderRadius } from '@/constants/theme'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { GlassCard } from '@/components/ui/Glass'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// ── Semana de pasos ───────────────────────────────────────────────────────────

/**
 * Un día sin contar no pinta barra.
 *
 * Es la misma regla que ya seguía la gráfica del tracker: siete tocones iguales
 * se leen como siete días medidos y flojos, no como una semana sin registrar.
 */
function SemanaPasos({ meta }: { meta: number }) {
  const { getWeeklySummary } = useHealthTrackerStore()
  const semana = getWeeklySummary()
  const hayAlguno = semana.some(d => d.steps != null && d.steps > 0)

  if (!hayAlguno) {
    return (
      <View style={sm.vacio}>
        <Text style={sm.vacioTxt}>Sin pasos registrados esta semana</Text>
      </View>
    )
  }

  const tope = Math.max(meta, ...semana.map(d => d.steps ?? 0))

  return (
    <View style={sm.wrap}>
      {semana.slice().reverse().map((d, i) => {
        const hay = d.steps != null && d.steps > 0
        const pct = hay && tope > 0 ? Math.min(1, (d.steps as number) / tope) : 0
        const fecha = new Date(d.date + 'T12:00:00')
        const cumplida = hay && (d.steps as number) >= meta
        return (
          <View key={i} style={sm.col}>
            <Text style={sm.val} numberOfLines={1}>
              {hay ? ((d.steps as number) >= 1000 ? `${((d.steps as number) / 1000).toFixed(1)}k` : d.steps) : ''}
            </Text>
            <View style={sm.carril}>
              {hay && (
                <View style={[sm.barra, {
                  height: `${Math.max(4, pct * 100)}%` as any,
                  backgroundColor: cumplida ? Colors.accent.green : Colors.primary[400],
                }]} />
              )}
            </View>
            <Text style={sm.dia}>{DIAS[fecha.getDay()]}</Text>
          </View>
        )
      })}
    </View>
  )
}

const sm = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 6, height: 116, alignItems: 'flex-end' },
  col: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 4 },
  carril: { flex: 1, width: '100%', justifyContent: 'flex-end', borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)' },
  barra: { width: '100%', borderRadius: 4 },
  val: { fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: '700' },
  dia: { fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: '700' },
  vacio: { height: 116, alignItems: 'center', justifyContent: 'center' },
  vacioTxt: { fontSize: 11, color: 'rgba(255,255,255,0.28)' },
})

// ── Pantalla ──────────────────────────────────────────────────────────────────

export default function RunningScreen() {
  const { load, getTodayProgress, stepGoal, getWeeklySummary } = useHealthTrackerStore()

  useEffect(() => { load() }, [])

  const hoy = getTodayProgress()
  const semana = getWeeklySummary()
  const totalSemana = semana.reduce((a, d) => a + (d.steps ?? 0), 0)
  const diasConDato = semana.filter(d => d.steps != null && d.steps > 0).length
  const pct = hoy.registrado && stepGoal > 0 ? Math.min(hoy.steps / stepGoal, 1) : 0

  return (
    <Screen tint={Colors.primary[500]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <ScreenHeader
          back
          eyebrow="Zencrus · Salud"
          title="Running"
          subtitle="Tus pasos y, muy pronto, tus carreras"
          icon="walk"
        />

        {/* ── Hoy ── */}
        <View style={s.seccion}>
          <GlassCard>
            <Text style={s.etiqueta}>PASOS DE HOY</Text>
            <View style={s.cifraFila}>
              <Text style={[s.cifra, !hoy.registrado && s.cifraVacia]}>
                {hoy.registrado ? hoy.steps.toLocaleString('es-MX') : '—'}
              </Text>
              <Text style={s.meta}>de {stepGoal.toLocaleString('es-MX')}</Text>
            </View>

            {hoy.registrado ? (
              <>
                <View style={s.carril}>
                  <View style={[s.relleno, { width: `${pct * 100}%` as any }]} />
                </View>
                <View style={s.statsFila}>
                  <Dato valor={`${hoy.km}`} unidad="km" />
                  <Dato valor={`${hoy.calories}`} unidad="kcal" />
                  <Dato valor={`${hoy.activeMin}`} unidad="min activo" />
                </View>
              </>
            ) : (
              <Text style={s.ayuda}>
                Nadie está contando tus pasos todavía. En cuanto el podómetro esté
                activo, esta cifra se llena sola.
              </Text>
            )}
          </GlassCard>
        </View>

        {/* ── Semana ── */}
        <View style={s.seccion}>
          <View style={s.cabeceraSeccion}>
            <Text style={s.tituloSeccion}>Esta semana</Text>
            {diasConDato > 0 && (
              <Text style={s.notaSeccion}>
                {totalSemana.toLocaleString('es-MX')} pasos en {diasConDato} {diasConDato === 1 ? 'día' : 'días'}
              </Text>
            )}
          </View>
          <GlassCard>
            <SemanaPasos meta={stepGoal} />
          </GlassCard>
        </View>

        {/* ── Carreras ── */}
        <View style={s.seccion}>
          <Text style={s.tituloSeccion}>Carreras</Text>
          <GlassCard>
            <View style={s.proximo}>
              <View style={s.proximoIcono}>
                <Ionicons name="navigate" size={20} color={Colors.primary[400]} />
              </View>
              <Text style={s.proximoTitulo}>Grabación por GPS</Text>
              <Text style={s.proximoTxt}>
                Distancia, ritmo, desnivel, parciales por kilómetro y el recorrido
                dibujado — grabando también con la pantalla bloqueada.
              </Text>
              <Text style={s.proximoPie}>
                El permiso de ubicación y el de movimiento ya están preparados en la
                app. Falta conectar la captura.
              </Text>
            </View>
          </GlassCard>
        </View>
      </ScrollView>
    </Screen>
  )
}

function Dato({ valor, unidad }: { valor: string; unidad: string }) {
  return (
    <View style={{ gap: 1 }}>
      <Text style={s.datoVal}>{valor}</Text>
      <Text style={s.datoUni}>{unidad}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  seccion: { marginHorizontal: Spacing[5], marginBottom: Spacing[4] },
  cabeceraSeccion: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: Spacing[3] },
  tituloSeccion: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
  notaSeccion: { fontSize: 10, color: 'rgba(255,255,255,0.35)' },
  etiqueta: { fontSize: 9, fontWeight: '900', color: Colors.primary[400], letterSpacing: 2 },
  cifraFila: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing[2], marginTop: Spacing[2] },
  cifra: { fontSize: 40, fontWeight: '900', color: '#fff', lineHeight: 44 },
  cifraVacia: { fontSize: 32, color: 'rgba(255,255,255,0.28)', fontWeight: '700' },
  meta: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  carril: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: Spacing[3] },
  relleno: { height: 4, borderRadius: 2, backgroundColor: Colors.primary[400] },
  statsFila: { flexDirection: 'row', gap: Spacing[6], marginTop: Spacing[4] },
  datoVal: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
  datoUni: { fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  ayuda: { fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 17, marginTop: Spacing[3] },
  proximo: { alignItems: 'center', gap: Spacing[2], paddingVertical: Spacing[3] },
  proximoIcono: {
    width: 46, height: 46, borderRadius: 15,
    backgroundColor: `${Colors.primary[500]}1c`, borderWidth: 1, borderColor: `${Colors.primary[500]}30`,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing[1],
  },
  proximoTitulo: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
  proximoTxt: { fontSize: 12, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 18 },
  proximoPie: { fontSize: 10, color: 'rgba(255,255,255,0.28)', textAlign: 'center', lineHeight: 15, marginTop: Spacing[2] },
})
