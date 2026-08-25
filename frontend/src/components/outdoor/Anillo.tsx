/**
 * AL AIRE LIBRE · ANILLO DE PROGRESO
 * ══════════════════════════════════
 * La meta de la semana. Se dibuja con Skia y no con `MiniRing` porque el trazo
 * lleva degradado —naranja de salida, rojo de marca al final— y un halo, y el
 * anillo de SVG solo admite un color plano.
 *
 * ── El remate redondo miente, y aquí también ────────────────────────────────
 * `MiniRing` ya documenta el problema y esto hereda su corrección: un remate
 * redondo proyecta media luna de radio `grosor/2` MÁS ALLÁ del punto donde el
 * trazo termina. Con los dos remates, un anillo pintado a `pct` ocupa en
 * realidad `pct + grosor/circunferencia`.
 *
 * Con un grosor de 11 sobre un anillo de 104, eso son casi cuatro puntos:
 * el número de dentro diría 61 % mientras el anillo pinta 65 %. Así que se
 * descuenta el grosor del barrido y se recorta a cero para que un progreso
 * diminuto no dé la vuelta al revés.
 */

import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import {
  Canvas, Path, Skia, SweepGradient, vec, BlurMask, Group, Circle,
} from '@shopify/react-native-skia'
import { OutdoorBrasa } from '@/constants/running-tokens'

export function Anillo({
  valor, tam = 104, grosor, children, style,
}: {
  /** 0-1. Por encima de 1 se recorta: un anillo no da dos vueltas. */
  valor: number
  tam?: number
  grosor?: number
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const gr = grosor ?? Math.round(tam * 0.11)
  const r = tam / 2 - gr / 2
  const circunferencia = 2 * Math.PI * r

  const pct = Math.max(0, Math.min(1, valor))
  // Se descuenta lo que añaden los dos remates redondos.
  const corregido = Math.max(0, pct - gr / circunferencia)
  const barrido = corregido * 360

  const caja = Skia.XYWHRect(gr / 2, gr / 2, tam - gr, tam - gr)

  const carril = Skia.Path.Make()
  carril.addArc(caja, 0, 360)

  const trazo = Skia.Path.Make()
  if (barrido > 0) trazo.addArc(caja, -90, barrido)

  // El punto de cabeza, que remata el trazo y da la sensación de que avanza.
  const ang = (-90 + barrido) * (Math.PI / 180)
  const cabeza = vec(tam / 2 + Math.cos(ang) * r, tam / 2 + Math.sin(ang) * r)

  return (
    <View style={[{ width: tam, height: tam }, style]}>
      <Canvas style={{ width: tam, height: tam }}>
        <Path
          path={carril}
          style="stroke"
          strokeWidth={gr}
          color="rgba(255,255,255,0.09)"
        />
        {barrido > 0 && (
          <>
            {/* El halo: la misma forma, desenfocada y por debajo. */}
            <Group opacity={0.55}>
              <Path path={trazo} style="stroke" strokeWidth={gr} strokeCap="round">
                <SweepGradient
                  c={vec(tam / 2, tam / 2)}
                  start={-90}
                  end={270}
                  colors={[...OutdoorBrasa]}
                />
                <BlurMask blur={gr * 0.85} style="normal" />
              </Path>
            </Group>
            <Path path={trazo} style="stroke" strokeWidth={gr} strokeCap="round">
              <SweepGradient
                c={vec(tam / 2, tam / 2)}
                start={-90}
                end={270}
                colors={[...OutdoorBrasa]}
              />
            </Path>
            <Circle c={cabeza} r={gr * 0.22} color="#fff" />
          </>
        )}
      </Canvas>
      {children ? <View style={[StyleSheet.absoluteFill, a.centro]}>{children}</View> : null}
    </View>
  )
}

const a = StyleSheet.create({
  centro: { alignItems: 'center', justifyContent: 'center' },
})
