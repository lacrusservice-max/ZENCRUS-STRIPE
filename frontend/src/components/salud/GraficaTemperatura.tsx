/**
 * LA CURVA DE TEMPERATURA BASAL
 * ═══════════════════════════════════════════════════════════════════════════
 * Una gráfica que existe para enseñar UNA cosa: el escalón.
 *
 * ── Por qué el eje se ajusta al dato y no a la escala del termómetro ───────
 * El salto que confirma la ovulación mide unas dos décimas de grado. Dibujado
 * sobre un eje de 35 a 40 °C —que es lo que sale por defecto— esas dos décimas
 * son medio píxel: el dato está y no se ve, que a efectos prácticos es igual
 * que no tenerlo. El eje va del mínimo al máximo reales con un pequeño margen,
 * y por eso el escalón se lee como un escalón.
 *
 * ── La línea de cobertura es la explicación, no un adorno ──────────────────
 * Es la línea que el método sintotérmico traza sobre las seis lecturas previas
 * y que las tres siguientes tienen que superar. Dibujarla convierte «la app
 * dice que ovulaste» en «mira: estas tres están por encima de esta línea», que
 * es lo único que hace comprobable una afirmación sobre el propio cuerpo.
 *
 * ── Y la curva va partida en dos ───────────────────────────────────────────
 * Antes y después del escalón, con un color por tramo. Una sola línea continua
 * esconde justo lo que hay que ver: que hay dos mesetas.
 */

import { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import {
  Canvas, Path, Circle, Line, vec, DashPathEffect, Group,
} from '@shopify/react-native-skia'
import { base, family, numeric } from '@/theme/salud/tokens'
import type { CurvaTemperatura } from '@/features/salud/ciclo/temperatura'

const ALTO = 190
const PAD = { arriba: 16, abajo: 26, izq: 34, der: 10 }

export function GraficaTemperatura({ curva, ancho, tono }: {
  curva: CurvaTemperatura
  ancho: number
  tono: string
}) {
  const { puntos, cambio, corte, min, max } = curva

  const g = useMemo(() => {
    const w = ancho - PAD.izq - PAD.der
    const h = ALTO - PAD.arriba - PAD.abajo
    const rango = Math.max(0.3, max - min)   // suelo: sin él, una curva plana explota

    const x = (i: number) => PAD.izq + (puntos.length === 1 ? w / 2 : (i / (puntos.length - 1)) * w)
    const y = (c: number) => PAD.arriba + h - ((c - min) / rango) * h

    const trazo = (desde: number, hasta: number) => {
      const trozo = puntos.slice(desde, hasta)
      if (trozo.length < 2) return null
      return trozo
        .map((p, k) => `${k === 0 ? 'M' : 'L'} ${x(desde + k).toFixed(2)} ${y(p.celsius).toFixed(2)}`)
        .join(' ')
    }

    const fin = corte ?? puntos.length
    return {
      x, y, w, h,
      antes: trazo(0, fin),
      /* El tramo alto arranca en el ÚLTIMO punto bajo, no en el primero alto:
         si empezara en el primero alto, el escalón —lo único que importa— se
         quedaría sin dibujar, como un hueco entre las dos mesetas. */
      despues: corte != null ? trazo(Math.max(0, corte - 1), puntos.length) : null,
      yLinea: cambio ? y(cambio.lineaCobertura) : null,
      xCambio: corte != null ? x(corte) : null,
    }
  }, [puntos, cambio, corte, min, max, ancho])

  if (!puntos.length) return null

  const etiquetasY = [max - 0.05, (max + min) / 2, min + 0.05]

  return (
    <View>
      <Canvas style={{ width: ancho, height: ALTO }}>
        {/* Línea de cobertura: discontinua, porque es un umbral y no un dato. */}
        {g.yLinea != null && (
          <Group>
            <Line
              p1={vec(PAD.izq, g.yLinea)}
              p2={vec(ancho - PAD.der, g.yLinea)}
              color={base.textLow}
              style="stroke"
              strokeWidth={1}
            >
              <DashPathEffect intervals={[4, 4]} />
            </Line>
          </Group>
        )}

        {/* Marca del escalón. */}
        {g.xCambio != null && (
          <Line
            p1={vec(g.xCambio, PAD.arriba)}
            p2={vec(g.xCambio, ALTO - PAD.abajo)}
            color={`${tono}55`}
            style="stroke"
            strokeWidth={1.5}
          />
        )}

        {/* Fase baja. */}
        {g.antes && (
          <Path path={g.antes} style="stroke" strokeWidth={1.8} color={base.textLow} strokeJoin="round" strokeCap="round" />
        )}
        {/* Fase alta: es la que lleva el color. */}
        {g.despues && (
          <Path path={g.despues} style="stroke" strokeWidth={2.4} color={tono} strokeJoin="round" strokeCap="round" />
        )}

        {/* Los puntos. Los de la fase alta, rellenos. */}
        {puntos.map((p, i) => {
          const alto = corte != null && i >= corte
          return (
            <Circle
              key={p.fecha}
              cx={g.x(i)}
              cy={g.y(p.celsius)}
              r={alto ? 3.4 : 2.6}
              color={alto ? tono : base.textMid}
            />
          )
        })}
      </Canvas>

      {/* Eje vertical, fuera del canvas: es texto y el texto va en RN. */}
      <View style={s.ejeY} pointerEvents="none">
        {etiquetasY.map((t, i) => (
          <Text key={i} style={s.ejeTxt}>{t.toFixed(1)}</Text>
        ))}
      </View>

      <View style={s.pie}>
        <Text style={s.pieTxt}>{puntos[0].fecha.slice(8)} · {puntos.length} lecturas</Text>
        {cambio ? (
          <Text style={[s.pieTxt, { color: tono }]}>
            escalón de +{cambio.salto.toFixed(2)} °C
          </Text>
        ) : (
          <Text style={s.pieTxt}>sin escalón todavía</Text>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  ejeY: {
    position: 'absolute', left: 0, top: PAD.arriba - 6,
    height: ALTO - PAD.arriba - PAD.abajo, justifyContent: 'space-between',
  },
  ejeTxt: { fontFamily: family.data, fontSize: 9.5, color: base.textLow, ...numeric },
  pie: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  pieTxt: { fontFamily: family.data, fontSize: 10, color: base.textLow, ...numeric },
})
