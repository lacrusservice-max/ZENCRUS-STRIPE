/**
 * EL FONDO DE NUTRICIÓN
 * ═════════════════════
 * Un rubor rojo que sube desde arriba y muere en el negro, para que la pantalla
 * no se sienta seca sin robarle sitio a los datos.
 *
 * ── Rojo de MARCA, nunca el semántico ───────────────────────────────────────
 * Usa #FF1F3D, el rojo de ZENCRUS, y no el #FF3B47 del «te pasaste». Si fueran
 * el mismo, al cruzar el techo el aviso rojo caería sobre un fondo del mismo
 * rojo y dejaría de avisar de nada: el color perdería su único trabajo.
 *
 * ── Qué separa esto de un degradado barato ──────────────────────────────────
 *   · va a baja saturación — es un tinte, no un color;
 *   · son focos DESCENTRADOS, no una diagonal simétrica: lo simétrico se lee
 *     como plantilla;
 *   · muere en el negro del fondo, no en otro color;
 *   · y no se mueve. La vida la ponen los datos al crecer, no el fondo latiendo
 *     detrás — eso ya se probó en el anillo y había que quitarlo.
 *
 * ── Vive ARRIBA, y se acaba ─────────────────────────────────────────────────
 * La primera versión cubría la pantalla entera y teñía de rojo las tarjetas de
 * las comidas al hacer scroll: parecía que la app tuviera un filtro puesto, que
 * es justo lo barato que había que evitar. Ahora el rubor se apaga antes del
 * medio y de ahí abajo la lista se lee sobre negro limpio.
 */

import { View, StyleSheet } from 'react-native'
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg'

const s = StyleSheet.create({
  marco: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
})

export function FondoPlato() {
  return (
    /* Solo el tercio superior: es donde vive el plato, y donde el color aporta.
       Más abajo empieza la lista de comidas, que necesita fondo neutro. */
    <View style={s.marco} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          {/* El foco principal, colgando del borde superior. */}
          <RadialGradient id="alto" cx="52%" cy="-4%" rx="72%" ry="30%">
            <Stop offset="0"    stopColor="#FF1F3D" stopOpacity="0.42" />
            <Stop offset="0.42" stopColor="#FF1F3D" stopOpacity="0.11" />
            <Stop offset="1"    stopColor="#FF1F3D" stopOpacity="0" />
          </RadialGradient>
          {/* Un segundo foco descentrado, para que no haya un eje simétrico. */}
          <RadialGradient id="lado" cx="6%" cy="17%" rx="44%" ry="22%">
            <Stop offset="0" stopColor="#A81028" stopOpacity="0.30" />
            <Stop offset="1" stopColor="#A81028" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#alto)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#lado)" />
      </Svg>
    </View>
  )
}
