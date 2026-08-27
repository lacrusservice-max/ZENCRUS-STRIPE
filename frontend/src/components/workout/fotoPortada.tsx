/**
 * LA FOTOGRAFÍA DE LA PORTADA
 * ───────────────────────────
 * Vive aparte porque la portada tiene cinco caras —te toca, a medias, ya está,
 * día libre y sin plan— y la foto es la MISMA en todas. Estaba solo dentro de
 * la de «te toca», así que quien elegía su foto un lunes la perdía el martes:
 * los días de descanso enseñaban otra y no había forma de cambiarla. En un plan
 * de tres días eso son cuatro días de cada siete con una foto ajena.
 *
 * ── Por qué se guarda en el teléfono y no en el servidor ────────────────────
 * Es una preferencia visual de este aparato, no un dato del plan. No merece una
 * columna, ni un viaje, ni sincronizarse: si te cambias de móvil, elegir foto
 * otra vez cuesta dos toques.
 *
 * ── Por qué por programa y no una para todo ─────────────────────────────────
 * La foto acompaña a lo que estás haciendo. Quien pasa de un plan de fuerza a
 * uno de movilidad quiere otra imagen, y si fuera única tendría que cambiarla
 * a mano cada vez que cambia de plan.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable,
  ImageSourcePropType,
} from 'react-native'
import { Image } from '@/components/ui/Imagen'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { FOTOS, fotoDePrograma } from '@/constants/imagenes'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

const T = Typography
const C = Colors

const LLAVE = (programId: string) => `zencrus_foto_hoy_${programId}`

/** Las ocho de marca, con nombre para el selector. */
const ELEGIBLES: { id: string; nombre: string }[] = [
  { id: 'gimnasio', nombre: 'Gimnasio' },
  { id: 'fuerza', nombre: 'Fuerza' },
  { id: 'brazos', nombre: 'Brazos' },
  { id: 'casa', nombre: 'En casa' },
  { id: 'aireLibre', nombre: 'Aire libre' },
  { id: 'montana', nombre: 'Montaña' },
  { id: 'rio', nombre: 'Río' },
  { id: 'movilidad', nombre: 'Movilidad' },
]

/** Lo mínimo del programa que hace falta aquí: ni la portada ni esto necesitan más. */
export interface ProgramaDeFoto {
  id: string
  mode?: string | null
  goal?: string | null
}

/**
 * La foto de este programa, con lo necesario para cambiarla.
 *
 * Devuelve la fuente ya resuelta: mientras AsyncStorage responde se enseña la
 * que toca por defecto, así que nunca hay un hueco negro esperando al disco.
 */
export function useFotoPortada(programa: ProgramaDeFoto | null | undefined) {
  const [elegida, setElegida] = useState<string | null>(null)
  const [eligiendo, setEligiendo] = useState(false)
  const id = programa?.id

  useEffect(() => {
    if (!id) { setElegida(null); return }
    let vivo = true
    void AsyncStorage.getItem(LLAVE(id))
      .then(v => { if (vivo && v && FOTOS[v]) setElegida(v) })
      .catch(() => {})
    return () => { vivo = false }
  }, [id])

  const elegir = useCallback(async (foto: string) => {
    void Haptics.selectionAsync()
    setElegida(foto)
    setEligiendo(false)
    if (!id) return
    try { await AsyncStorage.setItem(LLAVE(id), foto) } catch { /* da igual: se ve igual esta vez */ }
  }, [id])

  const fuente: ImageSourcePropType = elegida && FOTOS[elegida]
    ? FOTOS[elegida].fuente
    : programa
      ? fotoDePrograma(programa as Parameters<typeof fotoDePrograma>[0])
      : FOTOS.gimnasio.fuente

  return { fuente, elegida, eligiendo, abrir: () => setEligiendo(true), cerrar: () => setEligiendo(false), elegir }
}

/**
 * El botón de cambiarla, arriba a la derecha de la portada.
 *
 * Pequeño y translúcido a propósito: es un ajuste, no una acción del día. Si
 * pesara lo mismo que «Empezar», competiría con lo único que importa.
 */
export function BotonFoto({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={f.editar}
      onPress={() => { void Haptics.selectionAsync(); onPress() }}
      hitSlop={10}
      activeOpacity={0.8}
      accessibilityLabel="Cambiar la foto de la portada"
    >
      <Ionicons name="image-outline" size={15} color="#fff" />
    </TouchableOpacity>
  )
}

/**
 * Elegir la fotografía.
 *
 * Ocho, con su nombre y su miniatura. No hay subir la tuya: una foto propia mal
 * recortada rompe la portada, y resolver recorte, peso y permisos es otro
 * trabajo. Las de marca ya vienen oscurecidas y encuadradas para que el texto
 * se lea encima.
 */
export function SelectorFoto({ abierto, actual, onCerrar, onElegir }: {
  abierto: boolean
  actual: string | null
  onCerrar: () => void
  onElegir: (id: string) => void
}) {
  return (
    <Modal visible={abierto} transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable style={f.modalFondo} onPress={onCerrar}>
        <Animated.View entering={FadeInDown.duration(280)} style={f.modal}>
          <Pressable>
            <View style={f.asa} />
            <Text style={f.modalTitulo}>La foto de tu portada</Text>
            <Text style={f.modalSub}>Se queda guardada en este teléfono para este plan.</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={f.tiras}>
              {ELEGIBLES.map((x, i) => (
                <Animated.View key={x.id} entering={FadeIn.delay(i * 40).duration(220)}>
                  <TouchableOpacity
                    style={[f.opcion, actual === x.id && f.opcionOn]}
                    onPress={() => onElegir(x.id)}
                    activeOpacity={0.85}
                  >
                    <Image
                      source={FOTOS[x.id].fuente}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      transition={180}
                    />
                    <LinearGradient
                      colors={['transparent', 'rgba(5,5,5,0.85)']}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />
                    <Text style={f.opcionTxt}>{x.nombre}</Text>
                    {actual === x.id && (
                      <View style={f.tic}>
                        <Ionicons name="checkmark" size={11} color={C.neon.void} />
                      </View>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  )
}

const f = StyleSheet.create({
  editar: {
    position: 'absolute', top: Spacing[3], right: Spacing[3], zIndex: 3,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(5,5,5,0.42)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },

  modalFondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(5,5,5,0.62)' },
  modal: {
    backgroundColor: '#0d0d10',
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderTopWidth: 1, borderColor: C.neon.edge,
    padding: Spacing[4], paddingBottom: Spacing[6], gap: Spacing[2],
  },
  asa: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: C.neon.w4, marginBottom: Spacing[2] },
  modalTitulo: { fontSize: T.fontSize.lg, fontWeight: '800', color: C.neon.white, letterSpacing: -0.3 },
  modalSub: { fontSize: T.fontSize.xs, color: C.neon.w3 },

  tiras: { gap: Spacing[2], paddingVertical: Spacing[2], paddingRight: Spacing[2] },
  opcion: {
    width: 104, height: 74, borderRadius: BorderRadius.lg, overflow: 'hidden',
    justifyContent: 'flex-end', padding: Spacing[2],
    borderWidth: 1.5, borderColor: 'transparent',
  },
  opcionOn: { borderColor: C.neon.red },
  opcionTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  tic: {
    position: 'absolute', top: 6, right: 6,
    width: 17, height: 17, borderRadius: 9, backgroundColor: C.neon.red,
    alignItems: 'center', justifyContent: 'center',
  },
})
