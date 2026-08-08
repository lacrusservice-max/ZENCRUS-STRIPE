/**
 * REDIRECCIÓN DE ENTRADA · ZENCRUS
 * ════════════════════════════════
 *
 * La pestaña «Inicio» se retiró: el progreso, la racha y el score viven ahora
 * en Configuración → Progreso (`/progress`), y la app abre directamente en
 * Nutrición, que es la tarea diaria real.
 *
 * Esta ruta se conserva —vacía— porque `/(tabs)` sigue siendo el destino de
 * `router.replace('/(tabs)')` tras iniciar sesión y tras el checkout. Expo
 * Router resuelve ese grupo a su `index`, así que borrarlo dejaría ambos flujos
 * sin pantalla. Queda oculta del tab bar mediante `href: null` en el layout.
 */

import { Redirect } from 'expo-router'

export default function TabsIndexRedirect() {
  return <Redirect href="/(tabs)/nutrition" />
}
