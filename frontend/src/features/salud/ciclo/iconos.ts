/**
 * CICLO · LOS ICONOS DEL MOCKUP
 * ═══════════════════════════════════════════════════════════════════════════
 * Los 41 PNG que vinieron con el mockup, en un solo sitio.
 *
 * ── Por qué un registro y no `require` suelto en cada pantalla ─────────────
 * Porque `require` con una ruta mal escrita NO falla al compilar: falla al
 * abrir la pantalla, en el móvil, con un hueco donde debía ir el icono. Con
 * el registro, el nombre es una clave de TypeScript y el editor la autocompleta
 * o la marca en rojo antes de que llegue a ejecutarse.
 *
 * Además deja ver de un vistazo lo que HAY, que es lo que evita dibujar un
 * icono nuevo cuando ya existía uno con otro nombre.
 *
 * ── Los de registro e inicio de sesión no están ────────────────────────────
 * `ic_auth_correo`, `ic_auth_check_blanco` y los dos de login social se
 * quedaron fuera: esa parte ya vive en la app principal y no se duplica.
 *
 * Este archivo se genera desde los ficheros reales de `assets/iconos-ciclo`,
 * no a mano.
 */

export const ICONO = {
  'auth_candado': require('@/assets/iconos-ciclo/ic_auth_candado.png'),  // Candado: contraseña / PIN
  'auth_discreto': require('@/assets/iconos-ciclo/ic_auth_discreto.png'),  // Mostrar/ocultar contraseña y modo discreto
  'auth_faceid': require('@/assets/iconos-ciclo/ic_auth_faceid.png'),  // Face ID (pantalla Seguridad)
  'auth_huella': require('@/assets/iconos-ciclo/ic_auth_huella.png'),  // Huella dactilar (pantalla Seguridad)
  'community_buscar': require('@/assets/iconos-ciclo/ic_community_buscar.png'),  // Buscar articulos
  'community_decorativo': require('@/assets/iconos-ciclo/ic_community_decorativo.png'),  // Icono decorativo grande translucido
  'community_marcador': require('@/assets/iconos-ciclo/ic_community_marcador.png'),  // Guardar/marcador de articulo
  'community_reloj': require('@/assets/iconos-ciclo/ic_community_reloj.png'),  // Icono de articulo (reloj)
  'cycle_anticonceptivo': require('@/assets/iconos-ciclo/ic_cycle_anticonceptivo.png'),  // Metodo anticonceptivo
  'cycle_calendario': require('@/assets/iconos-ciclo/ic_cycle_calendario.png'),  // Proximo periodo / calendario (chip)
  'cycle_duracion': require('@/assets/iconos-ciclo/ic_cycle_duracion.png'),  // Duracion del ciclo/periodo
  'cycle_gota_bn': require('@/assets/iconos-ciclo/ic_cycle_gota_bn.png'),  // Gota contorno: color del sangrado
  'cycle_gota_color': require('@/assets/iconos-ciclo/ic_cycle_gota_color.png'),  // Gota color solido: flujo/sangrado
  'cycle_regular': require('@/assets/iconos-ciclo/ic_cycle_regular.png'),  // Regularidad del ciclo
  'dashboard_anillo': require('@/assets/iconos-ciclo/ic_dashboard_anillo.png'),  // Anillo de progreso del ciclo
  'dashboard_editar': require('@/assets/iconos-ciclo/ic_dashboard_editar.png'),  // Editar (lapiz, boton flotante)
  'dashboard_marcador_dia': require('@/assets/iconos-ciclo/ic_dashboard_marcador_dia.png'),  // Marcador triangular del dia actual
  'dashboard_notificacion': require('@/assets/iconos-ciclo/ic_dashboard_notificacion.png'),  // Campana de notificaciones
  'mood_badge': require('@/assets/iconos-ciclo/ic_mood_badge.png'),  // Icono de seccion 'Estado de animo'
  'mood_feliz': require('@/assets/iconos-ciclo/ic_mood_feliz.png'),  // Animo: Feliz
  'mood_irritable': require('@/assets/iconos-ciclo/ic_mood_irritable.png'),  // Animo: Irritable
  'mood_sensible': require('@/assets/iconos-ciclo/ic_mood_sensible.png'),  // Animo: Sensible
  'mood_tranquila': require('@/assets/iconos-ciclo/ic_mood_tranquila.png'),  // Animo: Tranquila
  'mood_triste': require('@/assets/iconos-ciclo/ic_mood_triste.png'),  // Animo: Triste
  'nav_ajustes': require('@/assets/iconos-ciclo/ic_nav_ajustes.png'),  // Tab Ajustes
  'nav_calendario': require('@/assets/iconos-ciclo/ic_nav_calendario.png'),  // Tab Calendario
  'nav_comunidad': require('@/assets/iconos-ciclo/ic_nav_comunidad.png'),  // Tab Comunidad (3 personas)
  'nav_estadisticas': require('@/assets/iconos-ciclo/ic_nav_estadisticas.png'),  // Tab Estadisticas
  'nav_inicio': require('@/assets/iconos-ciclo/ic_nav_inicio.png'),  // Tab Inicio
  'stats_check': require('@/assets/iconos-ciclo/ic_stats_check.png'),  // Check verde (logro/cumplido)
  'stats_insight': require('@/assets/iconos-ciclo/ic_stats_insight.png'),  // Bombilla: insight/patron del mes
  'stats_racha': require('@/assets/iconos-ciclo/ic_stats_racha.png'),  // Racha de dias (calendario+check)
  'ui_cerrar': require('@/assets/iconos-ciclo/ic_ui_cerrar.png'),  // Cerrar (X, header)
  'ui_flecha_atras': require('@/assets/iconos-ciclo/ic_ui_flecha_atras.png'),  // Flecha atras (header)
  'wellness_corazon_relleno': require('@/assets/iconos-ciclo/ic_wellness_corazon_relleno.png'),  // Ventana fertil (calendario)
  'wellness_energia': require('@/assets/iconos-ciclo/ic_wellness_energia.png'),  // Nivel de energia
  'wellness_entrenamiento': require('@/assets/iconos-ciclo/ic_wellness_entrenamiento.png'),  // Entrenamiento
  'wellness_nutricion': require('@/assets/iconos-ciclo/ic_wellness_nutricion.png'),  // Nutricion: apetito y antojos
  'wellness_piel': require('@/assets/iconos-ciclo/ic_wellness_piel.png'),  // Piel y cabello
  'wellness_salud_corazon': require('@/assets/iconos-ciclo/ic_wellness_salud_corazon.png'),  // Salud / vida sexual (corazon contorno)
  'wellness_sintomas': require('@/assets/iconos-ciclo/ic_wellness_sintomas.png'),  // Sintomas (colicos, etc.)
} as const

export type NombreIcono = keyof typeof ICONO
