/**
 * AL AIRE LIBRE · CABECERA
 * ════════════════════════
 * La barra de arriba de las pantallas de detalle: flecha, título y una acción
 * opcional a la derecha. Se repite en quince sitios, así que vive aquí.
 *
 * `titular` la convierte en la cabecera grande de las cuatro raíces de pestaña
 * —Hoy, Actividad, Progreso, Rutas—, con el rótulo de sección encima y sin
 * flecha, porque de una raíz no se vuelve: se cambia de pestaña.
 */

import { View, Text, StyleSheet, Pressable } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { RunningColors, RunningFonts } from '@/constants/running-tokens'
import { BotonIA } from '@/constants/layout'
import { Etiqueta } from './Material'

export function Cabecera({
  titulo, sub, titular, derecha, sinVolver,
}: {
  titulo: string
  sub?: string
  /** Cabecera grande de raíz de pestaña, con Michroma y sin flecha. */
  titular?: boolean
  derecha?: React.ReactNode
  sinVolver?: boolean
}) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[c.wrap, { paddingTop: insets.top + 6 }]}>
      {!titular && !sinVolver && (
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/aire-libre' as never))}
          style={c.boton}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.85)" />
        </Pressable>
      )}

      <View style={{ flex: 1 }}>
        {titular && <Etiqueta>Zencrus · Al aire libre</Etiqueta>}
        <Text style={titular ? c.titular : c.titulo} numberOfLines={1}>{titulo}</Text>
        {sub ? <Text style={c.sub} numberOfLines={1}>{sub}</Text> : null}
      </View>

      {derecha}
    </View>
  )
}

const c = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 15,
    paddingBottom: 12,
    // `BotonPerfil` flota sobre TODAS las pantallas desde `app/_layout.tsx`.
    // Sin reservarle su hueco se pone encima del título y de la acción de la
    // derecha —es translúcido, así que se ven los dos y no se entiende nada— y
    // además se lleva el toque.
    paddingRight: 15 + BotonIA.reserva,
  },
  boton: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  titulo: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: -0.45 },
  titular: {
    fontFamily: RunningFonts.display,
    fontSize: 25,
    color: RunningColors.text.primary,
    marginTop: 6,
    letterSpacing: -0.3,
  },
  sub: { fontSize: 10.5, color: 'rgba(255,255,255,0.36)', marginTop: 2 },
})
