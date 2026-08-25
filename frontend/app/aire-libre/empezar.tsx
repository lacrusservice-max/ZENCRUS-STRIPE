/**
 * AL AIRE LIBRE · ELEGIR DEPORTE
 * ══════════════════════════════
 * Los cuatro deportes. Lo que cambia entre ellos no es la pantalla siguiente:
 * es qué cifra manda y qué métricas tienen sentido. Un ciclista no mira su
 * ritmo en minutos por kilómetro, mira velocidad y vatios.
 *
 * Se distinguen por icono y por lo que miden, NUNCA por color: aquí el color
 * ya significa esfuerzo, y gastarlo en identidad rompería la escala de zonas.
 */

import { useState } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { RunningColors } from '@/constants/running-tokens'
import { Tarjeta, Aura, Boton } from '@/components/outdoor/Material'
import { Cabecera } from '@/components/outdoor/Cabecera'
import { DEPORTES, ORDEN_DEPORTES, Deporte } from '@/components/outdoor/Iconos'
import { useOutdoorStore } from '@/store/outdoorStore'

export default function Empezar() {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const guardado = useOutdoorStore(s => s.deporte)
  const [elegido, setElegido] = useState<Deporte>(guardado)

  return (
    <View style={s.raiz}>
      <Aura ancho={width} alto={height} />
      <Cabecera titulo="Empezar" sub="¿Qué vas a hacer?" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}
      >
        {ORDEN_DEPORTES.map(d => {
          const info = DEPORTES[d]
          const activo = d === elegido
          return (
            <Pressable
              key={d}
              onPress={() => { Haptics.selectionAsync(); setElegido(d) }}
              style={({ pressed }) => [{ marginBottom: 9 }, pressed && { opacity: 0.85 }]}
            >
              <Tarjeta brasa={activo}>
                <View style={s.fila}>
                  <View style={[s.icono, activo && s.iconoActivo]}>
                    <Ionicons name={info.icono} size={19} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.nombre}>{info.nombre}</Text>
                    <Text style={s.lema}>{info.lema}</Text>
                  </View>
                  <Ionicons
                    name={activo ? 'checkmark-circle' : 'chevron-forward'}
                    size={activo ? 20 : 15}
                    color={activo ? '#fff' : 'rgba(255,255,255,0.26)'}
                  />
                </View>
              </Tarjeta>
            </Pressable>
          )
        })}

        <Text style={s.nota}>
          Los cuatro se graban con el mismo motor. Lo que cambia es la cifra que mandas
          en pantalla y las métricas que se guardan.
        </Text>
      </ScrollView>

      <View style={{ paddingHorizontal: 15, paddingBottom: insets.bottom + 14 }}>
        <Boton rojo onPress={() => router.push({ pathname: '/aire-libre/preparar', params: { deporte: elegido } } as never)}>
          Continuar
        </Boton>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: RunningColors.surface.void },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icono: {
    width: 38, height: 38, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)',
  },
  iconoActivo: { backgroundColor: RunningColors.signal.base, borderColor: 'transparent' },
  nombre: { fontSize: 14.5, fontWeight: '700', color: '#fff', letterSpacing: -0.35 },
  lema: { fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  nota: { fontSize: 11.5, color: 'rgba(255,255,255,0.34)', lineHeight: 17, marginTop: 6, paddingHorizontal: 3 },
})
