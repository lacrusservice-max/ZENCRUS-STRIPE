/**
 * AL AIRE LIBRE · GRÁFICAS
 * ════════════════════════
 * Pulso por zonas, altimetría, barras, carga y el recorrido. Todo con Skia,
 * que es lo que permite el relleno con degradado y el halo del trazo.
 *
 * ── LA REGLA QUE COMPARTEN LAS CINCO ────────────────────────────────────────
 * **Ninguna inventa un punto.** Todas reciben series que pueden venir vacías o
 * con huecos (`null`), y cuando no hay dato NO dibujan: enseñan su vacío y lo
 * dicen. Una gráfica que interpola un hueco convierte «no lo medí» en «medí
 * esto», y a partir de ahí cualquier media que se calcule encima es falsa.
 *
 * En `Barras` eso es literal: un periodo sin actividad pinta un tocón de 3 px
 * gris, no una barra corta. Siete barras cortas se leen como siete semanas
 * flojas; siete tocones se leen como lo que son, siete semanas sin registrar.
 */

import { useState } from 'react'
import { View, Text, StyleSheet, LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native'
import {
  Canvas, Path, Skia, LinearGradient as SkGradient, vec, BlurMask, Group, Circle, Rect,
} from '@shopify/react-native-skia'
import { RunningColors, OutdoorZones, OutdoorBrasa } from '@/constants/running-tokens'

// ── Utilidades ───────────────────────────────────────────────────────────────

/** Catmull-Rom a curva suave. La misma que usa el trazo del recorrido. */
function suavizar(p: { x: number; y: number }[], n = 8) {
  if (p.length < 3) return p
  const o: { x: number; y: number }[] = []
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], d = p[i + 2] || c
    for (let t = 0; t < n; t++) {
      const s = t / n, s2 = s * s, s3 = s2 * s
      o.push({
        x: 0.5 * ((2 * b.x) + (-a.x + c.x) * s + (2 * a.x - 5 * b.x + 4 * c.x - d.x) * s2 + (-a.x + 3 * b.x - 3 * c.x + d.x) * s3),
        y: 0.5 * ((2 * b.y) + (-a.y + c.y) * s + (2 * a.y - 5 * b.y + 4 * c.y - d.y) * s2 + (-a.y + 3 * b.y - 3 * c.y + d.y) * s3),
      })
    }
  }
  o.push(p[p.length - 1])
  return o
}

function linea(pts: { x: number; y: number }[]) {
  const path = Skia.Path.Make()
  pts.forEach((q, i) => (i ? path.lineTo(q.x, q.y) : path.moveTo(q.x, q.y)))
  return path
}

/** Envoltorio que mide y guarda el tamaño antes de dibujar. */
function Lienzo({ alto, children, style }: {
  alto: number
  children: (w: number, h: number) => React.ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const [w, setW] = useState(0)
  const medir = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)
  return (
    <View onLayout={medir} style={[{ height: alto }, style]}>
      {w > 1 ? <Canvas style={{ width: w, height: alto }}>{children(w, alto)}</Canvas> : null}
    </View>
  )
}

function Vacio({ alto, texto }: { alto: number; texto: string }) {
  return (
    <View style={[g.vacio, { height: alto }]}>
      <Text style={g.vacioTxt}>{texto}</Text>
    </View>
  )
}

// ── Pulso sobre las bandas de zona ───────────────────────────────────────────

/**
 * `serie` en pulsaciones por minuto. `min`/`max` acotan el eje; si no llegan,
 * se toman de la propia serie con un margen para que la curva no toque el borde.
 */
export function GraficaPulso({
  serie, alto = 104, min, max,
}: {
  serie: number[]
  alto?: number
  min?: number
  max?: number
}) {
  if (serie.length < 2) {
    return <Vacio alto={alto} texto="Sin mediciones de pulso en esta actividad" />
  }
  const lo = min ?? Math.min(...serie) - 6
  const hi = max ?? Math.max(...serie) + 6
  const rango = Math.max(1, hi - lo)

  // Reparto de las bandas. Es proporcional y fijo: las zonas no cambian de
  // grosor según los datos, o dejarían de ser comparables entre actividades.
  const reparto = [0.16, 0.2, 0.26, 0.24, 0.14]

  return (
    <Lienzo alto={alto}>
      {(w, h) => {
        const pts = serie.map((v, i) => ({
          x: (i / (serie.length - 1)) * w,
          y: h - ((v - lo) / rango) * h,
        }))
        const s = suavizar(pts, 4)
        const trazo = linea(s)

        const relleno = linea(s)
        relleno.lineTo(w, h); relleno.lineTo(0, h); relleno.close()

        let y = h
        const bandas = reparto.map((f, i) => {
          const alt = f * h
          y -= alt
          return { y, alt, color: OutdoorZones[i].color }
        })

        return (
          <Group>
            {bandas.map((b, i) => (
              <Group key={i}>
                <Rect x={0} y={b.y} width={w} height={b.alt} color={b.color + '20'} />
                <Rect x={0} y={b.y} width={2.5} height={b.alt} color={b.color} />
              </Group>
            ))}
            <Path path={relleno}>
              <SkGradient start={vec(0, 0)} end={vec(0, h)}
                colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0)']} />
            </Path>
            <Path path={trazo} style="stroke" strokeWidth={2.1} strokeJoin="round" color="#fff" />
            <Circle c={vec(s[s.length - 1].x - 2, s[s.length - 1].y)} r={Math.max(2.6, h * 0.035)} color="#fff" />
          </Group>
        )
      }}
    </Lienzo>
  )
}

// ── Altimetría ───────────────────────────────────────────────────────────────

/** `serie` en metros sobre el nivel del mar. */
export function Altimetria({
  serie, alto = 66, color = RunningColors.signal.base,
}: {
  serie: number[]
  alto?: number
  color?: string
}) {
  if (serie.length < 2) return <Vacio alto={alto} texto="Sin datos de altura" />
  const lo = Math.min(...serie), hi = Math.max(...serie)
  const rango = Math.max(1, hi - lo)

  return (
    <Lienzo alto={alto}>
      {(w, h) => {
        const pts = serie.map((v, i) => ({
          x: (i / (serie.length - 1)) * w,
          y: h - ((v - lo) / rango) * (h - 8) - 4,
        }))
        const s = suavizar(pts, 4)
        const area = linea(s)
        area.lineTo(w, h); area.lineTo(0, h); area.close()
        return (
          <Group>
            <Path path={area}>
              <SkGradient start={vec(0, 0)} end={vec(0, h)}
                colors={[color + '7A', color + '26', color + '05']} positions={[0, 0.6, 1]} />
            </Path>
            <Group>
              <Path path={linea(s)} style="stroke" strokeWidth={1.8} strokeJoin="round" color={color}>
                <BlurMask blur={4} style="normal" />
              </Path>
            </Group>
            <Path path={linea(s)} style="stroke" strokeWidth={1.8} strokeJoin="round" color={color} />
          </Group>
        )
      }}
    </Lienzo>
  )
}

// ── Barras ───────────────────────────────────────────────────────────────────

/**
 * `valores` admite `null`, que es «ese periodo no se registró».
 * Se dibuja un tocón gris, NO una barra pequeña.
 */
export function Barras({
  valores, alto = 72, color = RunningColors.signal.base, destacada = -1,
}: {
  valores: (number | null)[]
  alto?: number
  color?: string
  destacada?: number
}) {
  const hayAlguno = valores.some(v => v != null && v > 0)
  if (!hayAlguno) return <Vacio alto={alto} texto="Nada registrado en este periodo" />
  const tope = Math.max(...valores.map(v => v ?? 0))

  return (
    <Lienzo alto={alto}>
      {(w, h) => {
        const n = valores.length
        const sep = (w / n) * 0.3
        const an = (w - sep * (n - 1)) / n
        return (
          <Group>
            {valores.map((v, i) => {
              const x = i * (an + sep)
              if (v == null || v <= 0) {
                const t = Skia.Path.Make()
                t.addRRect(Skia.RRectXY(Skia.XYWHRect(x, h - 3, an, 3), 1.5, 1.5))
                return <Path key={i} path={t} color="rgba(255,255,255,0.08)" />
              }
              const alt = Math.max(5, (v / tope) * h)
              const foco = destacada < 0 || i === destacada
              const p = Skia.Path.Make()
              p.addRRect(Skia.RRectXY(Skia.XYWHRect(x, h - alt, an, alt), 4, 4))
              return (
                <Path key={i} path={p}>
                  <SkGradient
                    start={vec(0, h - alt)} end={vec(0, h)}
                    colors={foco ? [color, color + '55'] : ['rgba(255,255,255,0.26)', 'rgba(255,255,255,0.09)']}
                  />
                </Path>
              )
            })}
          </Group>
        )
      }}
    </Lienzo>
  )
}

// ── Carga y forma ────────────────────────────────────────────────────────────

/**
 * Dos curvas sobre la misma rejilla: la forma —media larga— y el cansancio
 * —media corta—. Cuando la roja se dispara por encima de la cian es cuando
 * aparecen las lesiones, y por eso van juntas y no en dos tarjetas.
 */
export function CargaYForma({
  forma, cansancio, alto = 84,
}: {
  forma: number[]
  cansancio: number[]
  alto?: number
}) {
  if (forma.length < 2 || cansancio.length < 2) {
    return <Vacio alto={alto} texto="Hacen falta varias semanas de actividad" />
  }
  const todo = [...forma, ...cansancio]
  const lo = Math.min(...todo) * 0.9, hi = Math.max(...todo) * 1.05
  const rango = Math.max(1, hi - lo)
  const aPuntos = (serie: number[], w: number, h: number) =>
    suavizar(serie.map((v, i) => ({
      x: (i / (serie.length - 1)) * w,
      y: h - ((v - lo) / rango) * h,
    })), 3)

  return (
    <Lienzo alto={alto}>
      {(w, h) => {
        const f = aPuntos(forma, w, h)
        const c = aPuntos(cansancio, w, h)
        const areaF = linea(f); areaF.lineTo(w, h); areaF.lineTo(0, h); areaF.close()
        const rejilla = Skia.Path.Make()
        for (let i = 1; i < 4; i++) { rejilla.moveTo(0, (i * h) / 4); rejilla.lineTo(w, (i * h) / 4) }
        return (
          <Group>
            <Path path={rejilla} style="stroke" strokeWidth={1} color="rgba(255,255,255,0.06)" />
            <Path path={areaF}>
              <SkGradient start={vec(0, 0)} end={vec(0, h)}
                colors={[RunningColors.state.optimal + '4D', RunningColors.state.optimal + '03']} />
            </Path>
            <Path path={linea(f)} style="stroke" strokeWidth={1.9} strokeJoin="round" color={RunningColors.state.optimal} />
            <Path path={linea(c)} style="stroke" strokeWidth={1.9} strokeJoin="round" color={RunningColors.signal.base} />
          </Group>
        )
      }}
    </Lienzo>
  )
}

// ── El recorrido ─────────────────────────────────────────────────────────────

/**
 * EL TRAZO DEL GPS, SIN MAPA DEBAJO
 * ─────────────────────────────────
 * Dibuja la línea que grabó el GPS, normalizada al lienzo. **No hay calles
 * debajo** y no las finge: la app todavía no tiene proveedor de mapas, y
 * pintar una cuadrícula inventada sería decir que ese trazo pasó por unas
 * calles que nadie ha comprobado.
 *
 * Cuando entre Apple Maps o Mapbox, esto se convierte en la capa de encima.
 * El trazo son tres capas —sombra, cuerpo con degradado y filo blanco—, que
 * es lo que hace que parezca luz en vez de pintura.
 */
export function Recorrido({
  puntos, alto = 160, hasta = 1, grosor = 5, extremos = true, margen = 18,
}: {
  /** Coordenadas crudas. Se normalizan aquí; da igual la escala de entrada. */
  puntos: { lat: number; lon: number }[]
  alto?: number
  hasta?: number
  grosor?: number
  extremos?: boolean
  margen?: number
}) {
  if (puntos.length < 2) return <Vacio alto={alto} texto="Sin recorrido grabado" />

  return (
    <Lienzo alto={alto}>
      {(w, h) => {
        const lats = puntos.map(p => p.lat), lons = puntos.map(p => p.lon)
        const la0 = Math.min(...lats), la1 = Math.max(...lats)
        const lo0 = Math.min(...lons), lo1 = Math.max(...lons)
        // La longitud se encoge con el coseno de la latitud, o el recorrido
        // sale estirado a lo ancho en cuanto te alejas del ecuador.
        const kx = Math.cos(((la0 + la1) / 2) * Math.PI / 180)
        const anchoGeo = Math.max(1e-9, (lo1 - lo0) * kx)
        const altoGeo = Math.max(1e-9, la1 - la0)
        const k = Math.min((w - margen * 2) / anchoGeo, (h - margen * 2) / altoGeo)

        const todos = puntos.map(p => ({
          x: (p.lon - lo0) * kx * k + (w - anchoGeo * k) / 2,
          // La latitud crece hacia el norte y la Y de la pantalla hacia abajo.
          y: h - ((p.lat - la0) * k + (h - altoGeo * k) / 2),
        }))
        const corte = Math.max(2, Math.floor(hasta * todos.length))
        const pts = todos.slice(0, corte)
        const trazo = linea(pts)

        return (
          <Group>
            <Path path={trazo} style="stroke" strokeWidth={grosor + 3.4} strokeCap="round" strokeJoin="round" color="rgba(5,5,5,0.6)" />
            <Group>
              <Path path={trazo} style="stroke" strokeWidth={grosor} strokeCap="round" strokeJoin="round">
                <SkGradient start={vec(pts[0].x, pts[0].y)} end={vec(pts[pts.length - 1].x, pts[pts.length - 1].y)}
                  colors={[...OutdoorBrasa]} />
                <BlurMask blur={grosor * 1.6} style="normal" />
              </Path>
            </Group>
            <Path path={trazo} style="stroke" strokeWidth={grosor} strokeCap="round" strokeJoin="round">
              <SkGradient start={vec(pts[0].x, pts[0].y)} end={vec(pts[pts.length - 1].x, pts[pts.length - 1].y)}
                colors={[...OutdoorBrasa]} />
            </Path>
            <Path path={trazo} style="stroke" strokeWidth={Math.max(0.8, grosor * 0.26)} strokeCap="round" color="rgba(255,255,255,0.5)" />
            {extremos && (
              <Group>
                <Circle c={vec(pts[0].x, pts[0].y)} r={grosor * 1.05} color={RunningColors.state.restored} />
                <Circle c={vec(pts[pts.length - 1].x, pts[pts.length - 1].y)} r={grosor * 1.2} color="#fff" />
              </Group>
            )}
          </Group>
        )
      }}
    </Lienzo>
  )
}

const g = StyleSheet.create({
  vacio: { alignItems: 'center', justifyContent: 'center' },
  vacioTxt: { fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', paddingHorizontal: 16 },
})
