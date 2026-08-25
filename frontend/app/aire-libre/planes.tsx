/**
 * AL AIRE LIBRE · PLANES
 * ══════════════════════
 * Elegir un plan y ver la semana que toca.
 *
 * ── Cada día dice para qué sirve ────────────────────────────────────────────
 * Un plan que solo pone «45 min» se cumple sin entender, y en cuanto surge un
 * imprevisto la gente improvisa mal porque no sabe qué estaba comprando con
 * esa sesión. El `porque` de cada sesión no es relleno: es la mitad del valor.
 *
 * ── La semana no avanza sola ────────────────────────────────────────────────
 * Se avanza a mano. Un plan que corre según el calendario deja atrás a quien
 * se saltó tres días por trabajo y le pone en la semana 5 sin haber hecho la 3.
 * Avanzar cuando de verdad has terminado la semana es lo que hace que el plan
 * siga significando algo.
 */

import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions, Alert } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { RunningColors } from '@/constants/running-tokens'
import { Tarjeta, Aura, Etiqueta, Chip, Boton } from '@/components/outdoor/Material'
import { Cabecera } from '@/components/outdoor/Cabecera'
import { BarraPestanas, ALTO_BARRA } from '@/components/outdoor/BarraPestanas'
import { DEPORTES } from '@/components/outdoor/Iconos'
import { PLANES, buscarPlan, buscarSesion } from '@/constants/outdoor-planes'
import { useOutdoorAjustes } from '@/store/outdoorAjustesStore'

export default function Planes() {
  const { width, height } = useWindowDimensions()
  const { planActivo, semanaPlan, activarPlan, avanzarSemana } = useOutdoorAjustes()
  const plan = buscarPlan(planActivo)

  return (
    <View style={s.raiz}>
      <Aura ancho={width} alto={height} />
      <Cabecera titulo="Planes" sub={plan ? `${plan.nombre} · semana ${semanaPlan} de ${plan.semanas}` : 'Ninguno activo'} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: ALTO_BARRA + 20 }}>
        {plan ? (
          <>
            {/* ── La semana en curso ── */}
            <Tarjeta brasa>
              <View style={s.ct}>
                <Etiqueta>{plan.nombre}</Etiqueta>
                <Chip>Semana {semanaPlan} de {plan.semanas}</Chip>
              </View>
              <View style={s.carril}>
                <View style={[s.relleno, { width: `${Math.round((semanaPlan / plan.semanas) * 100)}%` as `${number}%` }]} />
              </View>
              <Text style={s.lema}>{plan.lema}</Text>
            </Tarjeta>

            <Tarjeta style={{ marginTop: 9 }} plana>
              {plan.dias(semanaPlan).map((d, i) => {
                const ses = buscarSesion(d.sesion)
                return (
                  <Pressable
                    key={d.dia}
                    disabled={!ses}
                    onPress={() => ses && router.push({ pathname: '/aire-libre/sesiones', params: { id: ses.id } } as never)}
                    style={({ pressed }) => [s.dia, i > 0 && s.diaBorde, pressed && ses && { opacity: 0.7 }]}
                  >
                    <Text style={[s.diaNombre, d.descanso && { color: 'rgba(255,255,255,0.3)' }]}>{d.dia}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.diaTitulo, d.descanso && { color: 'rgba(255,255,255,0.4)', fontWeight: '500' }]}>
                        {d.titulo}
                      </Text>
                      {d.detalle ? <Text style={s.diaDetalle}>{d.detalle}</Text> : null}
                    </View>
                    {ses && <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.26)" />}
                  </Pressable>
                )
              })}
            </Tarjeta>

            <View style={{ marginTop: 12, gap: 8 }}>
              {semanaPlan < plan.semanas ? (
                <Boton rojo onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  avanzarSemana()
                }}>
                  Terminé la semana {semanaPlan}
                </Boton>
              ) : (
                <Tarjeta>
                  <Text style={s.fin}>Última semana del plan. Cuando la acabes, has terminado.</Text>
                </Tarjeta>
              )}
              <Boton onPress={() => Alert.alert(
                'Dejar el plan',
                'Se olvida por qué semana ibas. Las actividades ya grabadas no se tocan.',
                [{ text: 'Seguir', style: 'cancel' },
                 { text: 'Dejarlo', style: 'destructive', onPress: () => activarPlan(null) }]
              )}>
                Dejar este plan
              </Boton>
            </View>

            <Text style={s.nota}>
              La semana avanza cuando tú lo dices, no con el calendario. Si te saltaste tres
              días, el plan te espera en vez de dejarte atrás.
            </Text>
          </>
        ) : (
          <>
            <Text style={s.intro}>
              Un plan no es una lista de sesiones: es un orden. Cada día dice también para qué
              sirve, que es lo que permite improvisar bien cuando la vida se cruza.
            </Text>

            {PLANES.map(p => (
              <Tarjeta key={p.id} style={{ marginBottom: 9 }}>
                <View style={s.ct}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.nombre}>{p.nombre}</Text>
                    <Text style={s.lema}>{p.lema}</Text>
                  </View>
                  <View style={s.iconoDeporte}>
                    <Ionicons name={DEPORTES[p.deporte].icono} size={15} color="rgba(255,255,255,0.6)" />
                  </View>
                </View>
                <Text style={s.requisito}>
                  <Text style={s.fuerte}>Hace falta: </Text>{p.requisito}
                </Text>
                <View style={{ marginTop: 11 }}>
                  <Boton rojo onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                    activarPlan(p.id)
                  }}>
                    Empezar · {p.semanas} semanas
                  </Boton>
                </View>
              </Tarjeta>
            ))}
          </>
        )}
      </ScrollView>

      <BarraPestanas />
    </View>
  )
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: RunningColors.surface.void },
  ct: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9 },
  intro: { fontSize: 12.5, color: 'rgba(255,255,255,0.5)', lineHeight: 18.5, marginBottom: 14, paddingHorizontal: 3 },
  nombre: { fontSize: 14.5, fontWeight: '700', color: '#fff', letterSpacing: -0.35 },
  lema: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3, lineHeight: 16 },
  requisito: { fontSize: 11.5, color: 'rgba(255,255,255,0.5)', lineHeight: 17 },
  fuerte: { color: '#fff', fontWeight: '700' },
  iconoDeporte: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  carril: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  relleno: { height: '100%', borderRadius: 3, backgroundColor: '#fff' },
  dia: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10, paddingHorizontal: 15 },
  diaBorde: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  diaNombre: { width: 28, fontSize: 10, fontWeight: '700', color: '#FF93A6' },
  diaTitulo: { fontSize: 12.5, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
  diaDetalle: { fontSize: 10.5, color: 'rgba(255,255,255,0.36)', marginTop: 2 },
  fin: { fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 18 },
  nota: { fontSize: 10.5, color: 'rgba(255,255,255,0.32)', lineHeight: 15.5, marginTop: 12, paddingHorizontal: 3 },
})
