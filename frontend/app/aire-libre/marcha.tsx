/**
 * AL AIRE LIBRE · EN MARCHA
 * ═════════════════════════
 * La pantalla que paga todo el trabajo del GPS. Tres vistas de lo mismo:
 *
 *   · **Cifra** — una sola, enorme, para mirar de reojo sin dejar de correr.
 *   · **Datos** — seis campos a la vez, para quien no quiere elegir.
 *   · **Mapa**  — el recorrido que llevas dibujado.
 *
 * ── Qué cifra manda depende del deporte ─────────────────────────────────────
 * Correr enseña distancia; la bici, velocidad; caminar, pasos; senderismo,
 * desnivel. La carcasa es idéntica: lo que cambia es cuál de las medidas ocupa
 * setenta puntos de altura, porque es la única que se lee en movimiento.
 *
 * ── El fondo no puede teñirse todavía, y por eso no se tiñe ─────────────────
 * El diseño pide que el fondo tome el color de tu zona de esfuerzo. Una zona
 * se calcula con el pulso, y sin pulsómetro no hay pulso. Teñirlo «estimando»
 * la zona por ritmo sería pintar de rojo a quien va suave cuesta arriba. Hasta
 * que haya banda o Apple Health, el fondo va con el rojo de marca y la pantalla
 * lo dice una vez, sin insistir.
 *
 * ── La pantalla se queda encendida ──────────────────────────────────────────
 * `useKeepAwake` mientras grabas. Que se apague a mitad de una serie y haya que
 * despertar el teléfono con las manos sudadas es la clase de detalle que hace
 * que la gente se lleve otro reloj.
 */

import { useState } from 'react'
import { View, Text, StyleSheet, Pressable, useWindowDimensions, Alert } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useKeepAwake } from 'expo-keep-awake'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { RunningColors } from '@/constants/running-tokens'
import { BotonIA } from '@/constants/layout'
import { Tarjeta, Aura, Etiqueta, Divisor, Chip, Boton } from '@/components/outdoor/Material'
import { Cifra, Metrica, FilaMetricas } from '@/components/outdoor/Cifra'
import { Recorrido } from '@/components/outdoor/Graficas'
import { DEPORTES } from '@/components/outdoor/Iconos'
import { useOutdoorStore, ritmo, mmss, hhmmss } from '@/store/outdoorStore'

type Vista = 'cifra' | 'datos' | 'mapa'

export default function Marcha() {
  useKeepAwake()
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  const estado = useOutdoorStore(s => s.estado)
  const actual = useOutdoorStore(s => s.actual)
  const problema = useOutdoorStore(s => s.problema)
  const { pausar, reanudar, terminar, descartar } = useOutdoorStore.getState()

  const [vista, setVista] = useState<Vista>('cifra')

  if (!actual) {
    return (
      <View style={[s.raiz, s.centrado]}>
        <Text style={s.vacio}>No hay ninguna actividad en marcha.</Text>
        <View style={{ width: 200, marginTop: 16 }}>
          <Boton onPress={() => router.replace('/aire-libre' as never)}>Volver</Boton>
        </View>
      </View>
    )
  }

  const pausada = estado === 'pausada'
  const info = DEPORTES[actual.deporte]
  const km = actual.metros / 1000
  const seg = actual.segundos
  const rit = ritmo(actual.metros, seg)
  const velocidad = seg > 0 ? (actual.metros / seg) * 3.6 : 0

  // La cifra grande, según el deporte.
  const principal =
    actual.deporte === 'bici'
      ? { etiqueta: 'Velocidad', valor: velocidad.toFixed(1), unidad: 'km/h' }
      : actual.deporte === 'senderismo'
        ? { etiqueta: 'Desnivel', valor: String(Math.round(actual.desnivelPositivo)), unidad: 'm' }
        : { etiqueta: 'Distancia', valor: km.toFixed(2), unidad: 'km' }

  const acabar = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    if (actual.metros < 50) {
      Alert.alert(
        'Muy corta para guardar',
        'Llevas menos de 50 metros. Si la guardo, el ritmo y los parciales saldrían sin sentido.',
        [
          { text: 'Seguir grabando', style: 'cancel' },
          { text: 'Descartar', style: 'destructive', onPress: () => { descartar(); router.replace('/aire-libre' as never) } },
        ]
      )
      return
    }
    const cerrada = terminar()
    if (cerrada) router.replace({ pathname: '/aire-libre/resumen', params: { id: cerrada.id } } as never)
    else router.replace('/aire-libre' as never)
  }

  return (
    <View style={s.raiz}>
      <Aura ancho={width} alto={height} pausado={pausada} />

      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 15, flex: 1 }}>
        {/* ── Selector de vista ── */}
        <View style={s.selector}>
          {(['cifra', 'datos', 'mapa'] as Vista[]).map(v => (
            <Pressable key={v} onPress={() => { Haptics.selectionAsync(); setVista(v) }}>
              <Chip activo={v === vista}>{v === 'cifra' ? 'Cifra' : v === 'datos' ? 'Datos' : 'Mapa'}</Chip>
            </Pressable>
          ))}
          <View style={{ flex: 1 }} />
          <Chip tono={pausada ? RunningColors.state.loaded : RunningColors.state.restored}>
            {pausada ? 'En pausa' : info.nombre}
          </Chip>
        </View>

        {/* ── El cuerpo ── */}
        {vista === 'cifra' && (
          <View style={[s.centro, pausada && { opacity: 0.45 }]}>
            <Etiqueta style={{ marginBottom: 8 }}>{principal.etiqueta}</Etiqueta>
            <Cifra valor={principal.valor} unidad={principal.unidad} tam={68} />
          </View>
        )}

        {vista === 'datos' && (
          <View style={s.rejilla}>
            {[
              ['Distancia', km.toFixed(2), 'km'],
              ['Tiempo', hhmmss(seg), ''],
              [actual.deporte === 'bici' ? 'Velocidad' : 'Ritmo',
               actual.deporte === 'bici' ? velocidad.toFixed(1) : (rit ? mmss(rit) : '—'),
               actual.deporte === 'bici' ? 'km/h' : (rit ? '/km' : '')],
              ['Desnivel', String(Math.round(actual.desnivelPositivo)), 'm'],
              ['Puntos', String(actual.puntos.length), ''],
              ['Parciales', String(actual.parciales.length), 'km'],
            ].map(([l, v, u]) => (
              <View key={l} style={s.casilla}>
                <Etiqueta style={{ marginBottom: 4 }}>{l}</Etiqueta>
                <Cifra valor={v} unidad={u || undefined} tam={26} />
              </View>
            ))}
          </View>
        )}

        {vista === 'mapa' && (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Recorrido puntos={actual.puntos} alto={Math.min(360, height * 0.42)} grosor={6} />
            <Text style={s.pieMapa}>
              Sin callejero debajo: la app todavía no tiene proveedor de mapas y no voy a
              dibujar unas calles que nadie ha comprobado.
            </Text>
          </View>
        )}

        {/* ── Mandos ── */}
        <View style={{ marginTop: 'auto', paddingBottom: insets.bottom + 14 }}>
          {problema && <Text style={s.problema}>{problema}</Text>}

          <Tarjeta>
            <FilaMetricas>
              <Metrica etiqueta="Distancia" valor={km.toFixed(2)} unidad="km" tam={23} />
              <Metrica etiqueta={actual.deporte === 'bici' ? 'Velocidad' : 'Ritmo'}
                valor={actual.deporte === 'bici' ? velocidad.toFixed(1) : (rit ? mmss(rit) : '—')}
                unidad={actual.deporte === 'bici' ? 'km/h' : undefined} tam={23} />
              <Metrica etiqueta="Tiempo" valor={hhmmss(seg)} tam={23} />
            </FilaMetricas>
            <Divisor />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Boton
                  rojo={pausada}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); pausada ? reanudar() : pausar() }}
                >
                  {pausada ? 'Reanudar' : 'Pausar'}
                </Boton>
              </View>
              <Pressable onPress={acabar} style={s.fin}>
                <Ionicons name="stop" size={16} color="#fff" />
              </Pressable>
            </View>
            {pausada && (
              <Text style={s.notaPausa}>
                En pausa no se suma tiempo ni distancia. El fondo pierde el color para que se vea.
              </Text>
            )}
          </Tarjeta>

          {actual.pulso.length === 0 && (
            <Text style={s.sinPulso}>
              Sin pulsómetro no hay zonas de esfuerzo. No las estimo por ritmo.
            </Text>
          )}
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: RunningColors.surface.void },
  centrado: { alignItems: 'center', justifyContent: 'center' },
  vacio: { fontSize: 13, color: 'rgba(255,255,255,0.45)' },
  // Mismo motivo que en `Cabecera`: el botón de perfil flota en esa esquina.
  selector: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, paddingRight: BotonIA.reserva },
  centro: { alignItems: 'center', marginTop: 22 },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 1, borderRadius: 19, overflow: 'hidden', marginTop: 6 },
  casilla: {
    width: '49.7%', paddingVertical: 16, paddingHorizontal: 14,
    backgroundColor: 'rgba(23,24,28,0.82)',
  },
  pieMapa: { fontSize: 10.5, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 15, marginTop: 12, paddingHorizontal: 14 },
  fin: {
    width: 54, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)',
  },
  notaPausa: { fontSize: 10.5, color: 'rgba(255,255,255,0.36)', textAlign: 'center', lineHeight: 15, marginTop: 10 },
  problema: {
    fontSize: 11, color: RunningColors.state.loaded, lineHeight: 16,
    marginBottom: 9, paddingHorizontal: 4,
  },
  sinPulso: { fontSize: 10.5, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 10, lineHeight: 15 },
})
