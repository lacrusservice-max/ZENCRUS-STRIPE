/**
 * AL AIRE LIBRE · LAYOUT DEL MÓDULO
 * ═════════════════════════════════
 * Una pila propia, sin cabecera del sistema: cada pantalla dibuja la suya
 * porque la del sistema no sabe ponerse encima de un fondo teñido ni de un
 * recorrido a sangre.
 *
 * `marcha` va con gesto de atrás desactivado a propósito: salirse de una
 * carrera en curso con un arrastre lateral es demasiado fácil, y perder el
 * recorrido por un roce es exactamente lo que esta sección promete no hacer.
 */

import { Stack } from 'expo-router'
import { RunningColors } from '@/constants/running-tokens'

export default function LayoutAireLibre() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: RunningColors.surface.void },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="actividad" options={{ animation: 'none' }} />
      <Stack.Screen name="progreso" options={{ animation: 'none' }} />
      <Stack.Screen name="rutas" options={{ animation: 'none' }} />
      <Stack.Screen name="empezar" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="marcha" options={{ gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="resumen" options={{ gestureEnabled: false, animation: 'slide_from_bottom' }} />
    </Stack>
  )
}
