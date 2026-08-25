/**
 * AL AIRE LIBRE · PREPARAR
 * ════════════════════════
 * Lo que se decide ANTES de salir y no en marcha: qué tipo de salida, cuál es
 * el objetivo y si el GPS ya te ve.
 *
 * ── La señal se enseña aquí, no en el kilómetro dos ─────────────────────────
 * Se pide una posición real antes de dejarte arrancar y se dice cuántos metros
 * de incertidumbre trae. Es el momento de descubrir que estás bajo un techo,
 * no cuando vuelvas a casa y falte medio recorrido.
 */

import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions, Alert } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { RunningColors } from '@/constants/running-tokens'
import { Tarjeta, Aura, Etiqueta, Boton, Chip } from '@/components/outdoor/Material'
import { Metrica, FilaMetricas } from '@/components/outdoor/Cifra'
import { Cabecera } from '@/components/outdoor/Cabecera'
import { DEPORTES, Deporte } from '@/components/outdoor/Iconos'
import { useOutdoorStore } from '@/store/outdoorStore'
import { useOutdoorMaterial, kmDePieza } from '@/store/outdoorMaterialStore'

type Senal = { estado: 'buscando' | 'lista' | 'sin-permiso' | 'error'; precision: number | null }

const MODOS = ['Libre', 'Distancia', 'Tiempo', 'Ritmo'] as const

export default function Preparar() {
  const { deporte: dep } = useLocalSearchParams<{ deporte?: string }>()
  const deporte = (dep as Deporte) || 'correr'
  const info = DEPORTES[deporte]

  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const empezar = useOutdoorStore(s => s.empezar)
  const historial = useOutdoorStore(s => s.historial)
  const { piezas, favorita } = useOutdoorMaterial()

  // La pieza que toca según el deporte, y solo si no está retirada.
  const tipoPieza = deporte === 'bici' ? 'bici' : 'zapatillas'
  const pieza = piezas.find(x => x.id === favorita[tipoPieza] && !x.retirada) ?? null

  const [modo, setModo] = useState<typeof MODOS[number]>('Libre')
  const [senal, setSenal] = useState<Senal>({ estado: 'buscando', precision: null })
  const [arrancando, setArrancando] = useState(false)

  /**
   * Se pide una posición de verdad, no solo el permiso. Tener permiso y tener
   * señal son cosas distintas, y la que importa para grabar es la segunda.
   */
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const p = await Location.getForegroundPermissionsAsync()
      if (p.status !== 'granted') {
        const pedido = await Location.requestForegroundPermissionsAsync()
        if (pedido.status !== 'granted') { vivo && setSenal({ estado: 'sin-permiso', precision: null }); return }
      }
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation })
        if (vivo) setSenal({ estado: 'lista', precision: pos.coords.accuracy ?? null })
      } catch {
        if (vivo) setSenal({ estado: 'error', precision: null })
      }
    })()
    return () => { vivo = false }
  }, [])

  const salir = async () => {
    setArrancando(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    const ok = await empezar(deporte, pieza?.id ?? null)
    setArrancando(false)
    if (!ok) {
      Alert.alert('No puedo grabar', useOutdoorStore.getState().problema ?? 'Falta el permiso de ubicación.')
      return
    }
    router.replace('/aire-libre/marcha' as never)
  }

  const senalTexto =
    senal.estado === 'buscando' ? 'Buscando satélites…'
    : senal.estado === 'sin-permiso' ? 'Sin permiso de ubicación'
    : senal.estado === 'error' ? 'No consigo posición aquí'
    : senal.precision == null ? 'Posición obtenida'
    : senal.precision <= 10 ? `Fuerte · ±${Math.round(senal.precision)} m`
    : senal.precision <= 25 ? `Aceptable · ±${Math.round(senal.precision)} m`
    : `Floja · ±${Math.round(senal.precision)} m`

  const senalColor =
    senal.estado === 'lista'
      ? (senal.precision != null && senal.precision <= 10 ? RunningColors.state.restored
        : senal.precision != null && senal.precision <= 25 ? RunningColors.state.loaded
        : RunningColors.state.strained)
      : senal.estado === 'buscando' ? RunningColors.state.optimal
      : RunningColors.state.strained

  return (
    <View style={s.raiz}>
      <Aura ancho={width} alto={height} />
      <Cabecera titulo={info.nombre} sub={`Salida ${modo.toLowerCase()}`} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}>
        <View style={s.chips}>
          {MODOS.map(m => (
            <Pressable key={m} onPress={() => { Haptics.selectionAsync(); setModo(m) }}>
              <Chip activo={m === modo}>{m}</Chip>
            </Pressable>
          ))}
        </View>

        {modo !== 'Libre' && (
          <Tarjeta style={{ marginBottom: 9 }}>
            <Text style={s.aviso}>
              Los objetivos con aviso de voz llegan cuando esté el motor de sesiones.
              De momento la salida se graba entera y sin avisos.
            </Text>
          </Tarjeta>
        )}

        <Tarjeta>
          <View style={s.fila}>
            <View style={s.icono}><Ionicons name="navigate" size={15} color={senalColor} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.filaTitulo}>Señal GPS</Text>
              <Text style={[s.filaSub, { color: senalColor }]}>{senalTexto}</Text>
            </View>
          </View>
          <View style={[s.fila, s.filaBorde]}>
            <View style={s.icono}><Ionicons name="heart-outline" size={15} color="rgba(255,255,255,0.5)" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.filaTitulo}>Pulsómetro</Text>
              <Text style={s.filaSub}>Sin conectar — no se grabarán zonas de esfuerzo</Text>
            </View>
          </View>
          <View style={[s.fila, s.filaBorde]}>
            <View style={s.icono}>
              <Ionicons name={deporte === 'bici' ? 'bicycle-outline' : 'footsteps-outline'} size={15} color="rgba(255,255,255,0.5)" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.filaTitulo}>{pieza ? pieza.nombre : 'Sin material asignado'}</Text>
              <Text style={s.filaSub}>
                {pieza
                  ? `${Math.round(kmDePieza(pieza, historial))} km${pieza.topeKm ? ` de ${pieza.topeKm}` : ''}`
                  : 'Los kilómetros no se sumarán a ninguna pieza'}
              </Text>
            </View>
            <Pressable onPress={() => router.push('/aire-libre/material' as never)}>
              <Chip>{pieza ? 'Cambiar' : 'Añadir'}</Chip>
            </Pressable>
          </View>
        </Tarjeta>

        <Tarjeta style={{ marginTop: 9 }}>
          <Etiqueta style={{ marginBottom: 9 }}>Qué se va a medir</Etiqueta>
          <FilaMetricas>
            <Metrica etiqueta="Manda" valor={info.principal} tam={14} />
            <Metrica etiqueta="Puntos" valor="1/s" tam={14} />
            <Metrica etiqueta="Parciales" valor="1 km" tam={14} />
          </FilaMetricas>
          <Text style={s.nota}>
            {info.metricas.join(' · ')}. El pulso queda vacío mientras no haya banda o Apple Health.
          </Text>
        </Tarjeta>
      </ScrollView>

      <View style={{ paddingHorizontal: 15, paddingBottom: insets.bottom + 14 }}>
        <Boton
          rojo
          onPress={salir}
          style={senal.estado === 'sin-permiso' || arrancando ? { opacity: 0.45 } : undefined}
        >
          {arrancando ? 'Arrancando…' : 'Empezar'}
        </Boton>
        {senal.estado === 'sin-permiso' && (
          <Text style={s.pie}>Hace falta el permiso de ubicación para grabar el recorrido.</Text>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: RunningColors.surface.void },
  chips: { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 6 },
  filaBorde: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.09)', marginTop: 6, paddingTop: 12 },
  icono: {
    width: 32, height: 32, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.09)',
  },
  filaTitulo: { fontSize: 12.5, fontWeight: '600', color: '#fff' },
  filaSub: { fontSize: 10.5, color: 'rgba(255,255,255,0.36)', marginTop: 1 },
  nota: { fontSize: 11, color: 'rgba(255,255,255,0.36)', lineHeight: 16, marginTop: 10 },
  aviso: { fontSize: 11.5, color: 'rgba(255,255,255,0.5)', lineHeight: 17 },
  pie: { fontSize: 10.5, color: 'rgba(255,255,255,0.34)', textAlign: 'center', marginTop: 9 },
})
