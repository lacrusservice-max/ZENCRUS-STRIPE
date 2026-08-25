/**
 * QUÉ MENÚ ENSEÑA LA BARRA
 * ════════════════════════
 * Un solo dato compartido: en qué destino está abierto el menú de sección.
 *
 * ── Por qué esto no puede vivir dentro de un componente ─────────────────────
 * Porque la barra son DOS componentes, no uno: `GlassTabBar` la dibuja en las
 * raíces de pestaña y `BarraDeSeccion` en las rutas del stack. Con un `useState`
 * en cada uno, abrir el menú en Nutrición y tocar «Recetas» te llevaba a una
 * pantalla del stack donde mandaba el OTRO componente, que arrancaba con su
 * propio estado a cero — y el menú se cerraba solo al elegir cualquier cosa.
 * Era exactamente el «me lo cambia solito».
 *
 * ── Por qué se guarda el destino y no un booleano ───────────────────────────
 * Guardando en QUÉ destino está abierto, el reinicio sale gratis: al cambiar de
 * destino el valor deja de coincidir y el menú se cierra solo, sin efectos ni
 * dependencias que mantener. El menú de Entrena no puede quedarse abierto
 * estando en Nutrición porque no es el mismo destino, y ya está.
 */

import { create } from 'zustand'
import type { DestinoApp } from '@/constants/menusDeSeccion'

interface MenuBarra {
  /** El destino cuyo menú está abierto. `null` = se ven los destinos de la app. */
  abiertoEn: DestinoApp | null
  /** Abre el menú de este destino, o lo cierra si ya era el suyo. */
  alternar: (destino: DestinoApp) => void
  cerrar: () => void
}

export const useMenuBarra = create<MenuBarra>((set) => ({
  abiertoEn: null,
  alternar: (destino) => set(s => ({ abiertoEn: s.abiertoEn === destino ? null : destino })),
  cerrar: () => set({ abiertoEn: null }),
}))
