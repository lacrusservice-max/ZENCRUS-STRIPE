/**
 * RECUPERACIÓN — el único check-in de la app
 * ══════════════════════════════════════════
 * Antes esto era un modal de tres preguntas en la pestaña de Salud, y había
 * OTRO modal de cuatro preguntas en Progreso con una escala distinta. Los dos
 * preguntaban por la energía y el estrés. Ahora es uno, tiene página propia, y
 * Progreso enlaza aquí.
 *
 * ── Nada viene contestado ───────────────────────────────────────────────────
 * Las filas arrancan sin marcar, no en el punto medio. Un formulario que nace
 * relleno se guarda solo: quien abría el check-in y pulsaba «Guardar» sin mirar
 * persistía un 3/3/3 que nadie había dicho, y ese 3/3/3 pesa la mitad del score
 * de recuperación. El botón no se activa hasta que las cuatro están marcadas.
 */

import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useRecoveryStore } from '@/store/recoveryStore'
import { useStreakStore } from '@/store/streakStore'
import { elegir, logro } from '@/utils/haptica'
import { hoyLocal, haceDias } from '@/utils/fechas'
import { Colors, Glass, Typography, Spacing, BorderRadius } from '@/constants/theme'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { GlassCard } from '@/components/ui/Glass'
import { TabBar } from '@/constants/layout'

const NIVELES = ['Muy bajo', 'Bajo', 'Normal', 'Bueno', 'Excelente']

/** Cada eje con su propio vocabulario: «energía excelente» y «dolor excelente»
 *  no se dicen igual, y una etiqueta genérica obliga a traducir mentalmente. */
const EJES = [
  {
    key: 'energy' as const,
    label: 'Energía',
    ayuda: 'Cómo te notas de batería hoy',
    icono: 'flash' as const,
    escala: ['En reserva', 'Baja', 'Normal', 'Buena', 'A tope'],
  },
  {
    key: 'mood' as const,
    label: 'Ánimo',
    ayuda: 'Cómo estás de cabeza, no de piernas',
    icono: 'happy' as const,
    escala: ['Muy bajo', 'Bajo', 'Normal', 'Bueno', 'Excelente'],
  },
  {
    key: 'stress' as const,
    label: 'Calma',
    ayuda: 'Más alto = más relajado',
    icono: 'leaf' as const,
    escala: ['Muy tenso', 'Tenso', 'Normal', 'Tranquilo', 'En paz'],
  },
  {
    key: 'soreness' as const,
    label: 'Músculos',
    ayuda: 'Más alto = menos agujetas',
    icono: 'body' as const,
    escala: ['Muy doloridos', 'Doloridos', 'Algo cargados', 'Bien', 'Como nuevos'],
  },
]

type EjeKey = typeof EJES[number]['key']

// ── Anillo del score ──────────────────────────────────────────────────────────

/**
 * Sin score no hay anillo pintado, solo el carril.
 *
 * Un anillo al 0 % y un anillo «sin datos» se dibujan igual si no se separan a
 * propósito, y el primero afirma que la recuperación está a cero.
 */
function AnilloScore({ score, color }: { score: number | null; color: string }) {
  const R = 58
  const STROKE = 10
  const circ = 2 * Math.PI * R
  const offset = score == null ? circ : circ - (score / 100) * circ

  return (
    <View style={an.wrap}>
      <Svg width={140} height={140} viewBox="0 0 140 140">
        <Circle cx={70} cy={70} r={R} stroke="rgba(255,255,255,0.07)" strokeWidth={STROKE} fill="none" />
        {score != null && (
          <Circle
            cx={70} cy={70} r={R}
            stroke={color} strokeWidth={STROKE} fill="none"
            strokeDasharray={`${circ}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            rotation={-90}
            origin="70, 70"
          />
        )}
      </Svg>
      <View style={an.centro}>
        <Text style={[an.num, score == null && an.numVacio, { color }]}>{score ?? '—'}</Text>
        <Text style={an.sub}>{score == null ? 'SIN DATOS' : 'RECUPERACIÓN'}</Text>
      </View>
    </View>
  )
}

const an = StyleSheet.create({
  wrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  centro: { position: 'absolute', alignItems: 'center' },
  num: { fontSize: 38, fontWeight: '900', lineHeight: 42 },
  /* El hueco no pesa lo que un dato: a 38 px y peso 900 un guión se lee como
     una barra a medio cargar, no como «no hay nada». */
  numVacio: { fontSize: 28, fontWeight: '700' },
  sub: { fontSize: 8, color: 'rgba(255,255,255,0.32)', letterSpacing: 1.6, fontWeight: '800', marginTop: 2 },
})

// ── Una fila del check-in ─────────────────────────────────────────────────────

function Eje({ eje, valor, onChange }: {
  eje: typeof EJES[number]
  valor: number | null
  onChange: (v: number) => void
}) {
  return (
    <View style={ej.wrap}>
      <View style={ej.cabecera}>
        <View style={ej.tituloFila}>
          <View style={ej.iconoCaja}>
            <Ionicons name={eje.icono} size={14} color={Colors.primary[400]} />
          </View>
          <View>
            <Text style={ej.label}>{eje.label}</Text>
            <Text style={ej.ayuda}>{eje.ayuda}</Text>
          </View>
        </View>
        <Text style={[ej.valor, valor == null && ej.valorVacio]}>
          {valor != null ? eje.escala[valor - 1] : 'sin marcar'}
        </Text>
      </View>
      <View style={ej.puntos}>
        {[1, 2, 3, 4, 5].map(n => {
          const activo = valor != null && n <= valor
          return (
            <TouchableOpacity
              key={n}
              style={[ej.punto, activo && ej.puntoOn]}
              onPress={() => { elegir(); onChange(n) }}
              activeOpacity={0.7}
              accessibilityLabel={`${eje.label}: ${eje.escala[n - 1]}`}
            />
          )
        })}
      </View>
    </View>
  )
}

const ej = StyleSheet.create({
  wrap: { gap: Spacing[3] },
  cabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing[3] },
  tituloFila: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], flex: 1 },
  iconoCaja: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: `${Colors.primary[500]}1f`, borderWidth: 1, borderColor: `${Colors.primary[500]}30`,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: '#fff' },
  ayuda: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 },
  valor: { fontSize: 11, fontWeight: '700', color: Colors.primary[400], textAlign: 'right', maxWidth: 96 },
  valorVacio: { color: 'rgba(255,255,255,0.28)', fontStyle: 'italic', fontWeight: '600' },
  puntos: { flexDirection: 'row', gap: Spacing[2] },
  punto: {
    flex: 1, height: 38, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: Glass.cardBorder,
  },
  puntoOn: { backgroundColor: Colors.primary[500], borderColor: Colors.primary[500] },
})

// ── Historial de 14 días ──────────────────────────────────────────────────────

function Historial() {
  const { entries } = useRecoveryStore()
  const dias = Array.from({ length: 14 }, (_, i) => haceDias(13 - i))
  const hay = dias.some(d => entries[d])

  if (!hay) return null

  return (
    <View style={hi.wrap}>
      {dias.map(d => {
        const e = entries[d]
        /* Media de los tres ejes físicos, no de los cuatro: el ánimo no dice si
           el cuerpo está recuperado, y colarlo aquí haría que un día triste se
           pintara como un día de fatiga. */
        const media = e ? (e.energy + e.soreness + e.stress) / 3 : null
        const alto = media != null ? Math.max(0.12, media / 5) : 0
        return (
          <View key={d} style={hi.col}>
            <View style={hi.carril}>
              {media != null && (
                <View style={[hi.barra, {
                  height: `${alto * 100}%` as any,
                  backgroundColor: media >= 3.5 ? Colors.accent.green
                    : media >= 2.5 ? Colors.primary[400]
                    : Colors.accent.orange,
                }]} />
              )}
            </View>
          </View>
        )
      })}
    </View>
  )
}

const hi = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 4, height: 56, alignItems: 'flex-end', marginTop: Spacing[3] },
  col: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  carril: { height: '100%', justifyContent: 'flex-end', borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)' },
  barra: { width: '100%', borderRadius: 3 },
})

// ── Pantalla ──────────────────────────────────────────────────────────────────

export default function RecuperacionScreen() {
  const { logToday, getToday, getRecoveryScore, getRecoverySources, getTrend, getWeeklyAverage } = useRecoveryStore()
  const { markActivity } = useStreakStore()

  const existente = getToday()
  const [valores, setValores] = useState<Record<EjeKey, number | null>>({
    energy: existente?.energy ?? null,
    mood: existente?.mood ?? null,
    stress: existente?.stress ?? null,
    soreness: existente?.soreness ?? null,
  })
  const [intencion, setIntencion] = useState(existente?.intention ?? '')
  const [guardando, setGuardando] = useState(false)

  const score = getRecoveryScore()
  const fuentes = getRecoverySources()
  const trend = getTrend()
  const weekAvg = getWeeklyAverage()

  /* Las cuatro, o no se guarda. Con una a medias el score saldría de un
     promedio al que le falta un sumando, que no es lo mismo que un promedio. */
  const completo = EJES.every(e => valores[e.key] != null)

  const color = score == null
    ? 'rgba(255,255,255,0.28)'
    : score >= 70 ? Colors.accent.green
    : score >= 40 ? Colors.accent.orange
    : Colors.primary[500]

  const guardar = async () => {
    if (!completo || guardando) return
    setGuardando(true)
    await logToday({
      energy: valores.energy!,
      soreness: valores.soreness!,
      stress: valores.stress!,
      mood: valores.mood!,
      intention: intencion.trim() || undefined,
    })
    /* El check-in cuenta para la racha, como contaba el de Progreso. */
    await markActivity(hoyLocal(), { checkInDone: true })
    logro()
    setGuardando(false)
    router.back()
  }

  const medido = [fuentes.sueno && 'tu sueño', fuentes.pulso && 'tus pulsaciones'].filter(Boolean) as string[]
  const listaMedida = medido.length === 2 ? `${medido[0]} y ${medido[1]}` : medido[0]

  return (
    <Screen tint={Colors.primary[500]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: TabBar.scrollInset }}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeader
            back
            eyebrow="Zencrus · Salud"
            title="Recuperación"
            subtitle="Cómo estás hoy, en cuatro respuestas"
            icon="pulse"
          />

          {/* ── Score ── */}
          <View style={s.seccion}>
            <GlassCard>
              <View style={s.heroFila}>
                <AnilloScore score={score} color={color} />
                <View style={s.heroInfo}>
                  {weekAvg && trend !== 'none' && (
                    <View style={s.tendencia}>
                      <Ionicons
                        name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove'}
                        size={14}
                        color={trend === 'up' ? Colors.accent.green : trend === 'down' ? Colors.primary[400] : 'rgba(255,255,255,0.4)'}
                      />
                      <Text style={s.tendenciaTxt}>
                        {trend === 'up' ? 'Mejorando' : trend === 'down' ? 'A la baja' : 'Estable'}
                      </Text>
                    </View>
                  )}
                  <Text style={s.heroTxt}>
                    {score == null
                      ? 'Todavía no hay nada con lo que puntuarte. Marca las cuatro filas de abajo y aparece aquí.'
                      : !existente
                        ? listaMedida
                          ? `Hoy sale solo de ${listaMedida}. Con tu check-in se afina.`
                          : 'Marca cómo te sientes para afinarlo.'
                        : !listaMedida
                          ? 'Sale solo de tu check-in. Apunta tu sueño o tus pulsaciones y contarán también.'
                          : `Sale de tu check-in y de ${listaMedida}.`}
                  </Text>
                </View>
              </View>
              <Historial />
            </GlassCard>
          </View>

          {/* ── Check-in ── */}
          <View style={s.seccion}>
            <Text style={s.tituloSeccion}>
              {existente ? 'Tu check-in de hoy' : '¿Cómo te sientes hoy?'}
            </Text>
            <GlassCard style={{ gap: Spacing[5] }}>
              {EJES.map(e => (
                <Eje
                  key={e.key}
                  eje={e}
                  valor={valores[e.key]}
                  onChange={v => setValores(prev => ({ ...prev, [e.key]: v }))}
                />
              ))}
            </GlassCard>
          </View>

          {/* ── Intención ── */}
          <View style={s.seccion}>
            <Text style={s.tituloSeccion}>Intención de hoy</Text>
            <GlassCard>
              <TextInput
                style={s.intencion}
                value={intencion}
                onChangeText={setIntencion}
                placeholder="Hoy voy a…"
                placeholderTextColor="rgba(255,255,255,0.22)"
                multiline
                maxLength={140}
              />
              <Text style={s.opcional}>Opcional. Se ve en Progreso durante el día.</Text>
            </GlassCard>
          </View>

          <View style={s.seccion}>
            <TouchableOpacity
              style={[s.guardar, !completo && s.guardarOff]}
              onPress={guardar}
              disabled={!completo || guardando}
              activeOpacity={0.85}
            >
              <Text style={s.guardarTxt}>
                {completo
                  ? existente ? 'Actualizar check-in' : 'Guardar check-in'
                  : 'Marca las cuatro filas'}
              </Text>
              {completo && <Ionicons name="arrow-forward" size={16} color="#fff" />}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const s = StyleSheet.create({
  seccion: { marginHorizontal: Spacing[5], marginBottom: Spacing[4] },
  tituloSeccion: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff', marginBottom: Spacing[3] },
  heroFila: { flexDirection: 'row', alignItems: 'center', gap: Spacing[4] },
  heroInfo: { flex: 1, gap: Spacing[2] },
  tendencia: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: BorderRadius.base,
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[1],
  },
  tendenciaTxt: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  heroTxt: { fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 17 },
  intencion: {
    fontSize: Typography.fontSize.sm, color: '#fff', lineHeight: 21,
    minHeight: 46, textAlignVertical: 'top',
  },
  opcional: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: Spacing[2] },
  guardar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[2],
    backgroundColor: Colors.primary[500], borderRadius: BorderRadius.lg, padding: Spacing[4],
  },
  guardarOff: { opacity: 0.35 },
  guardarTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
})
