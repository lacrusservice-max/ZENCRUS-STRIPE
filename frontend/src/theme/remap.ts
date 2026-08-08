// Motor de remapeo de color dark → light.
//
// Toda la app está escrita con la paleta oscura literal (negro + rojo #FF1F3D)
// dentro de StyleSheet.create, que se evalúa una sola vez al importar el módulo
// y por eso NO puede leer un hook de React. En vez de reescribir 1900+ literales
// en 67 archivos, el tema claro se deriva de la paleta oscura con dos reglas:
//
//   1. Los grises (blanco ↔ negro) invierten su luminosidad.
//   2. Los rojos rotan al azul de marca #0F448B conservando su claridad relativa.
//
// El alpha siempre se conserva, así los cristales y bordes translúcidos siguen
// funcionando. Los colores semánticos (verde/ámbar) mantienen su tono y solo se
// oscurecen lo necesario para leerse sobre blanco.

export interface RGBA { r: number; g: number; b: number; a: number }

const NAMED: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  red: '#ff0000',
}

/** Convierte cualquier string de color CSS/RN soportado a RGBA. */
export function parseColor(input: string): RGBA | null {
  let s = input.trim().toLowerCase()
  if (!s || s === 'transparent' || s === 'currentcolor') return null
  if (NAMED[s]) s = NAMED[s]

  if (s[0] === '#') {
    const h = s.slice(1)
    if (h.length === 3 || h.length === 4) {
      const r = parseInt(h[0] + h[0], 16)
      const g = parseInt(h[1] + h[1], 16)
      const b = parseInt(h[2] + h[2], 16)
      const a = h.length === 4 ? parseInt(h[3] + h[3], 16) / 255 : 1
      return Number.isNaN(r + g + b) ? null : { r, g, b, a }
    }
    if (h.length === 6 || h.length === 8) {
      const r = parseInt(h.slice(0, 2), 16)
      const g = parseInt(h.slice(2, 4), 16)
      const b = parseInt(h.slice(4, 6), 16)
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
      return Number.isNaN(r + g + b) ? null : { r, g, b, a }
    }
    return null
  }

  const m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/)
  if (m) {
    return {
      r: Math.min(255, +m[1]),
      g: Math.min(255, +m[2]),
      b: Math.min(255, +m[3]),
      a: m[4] === undefined ? 1 : Math.min(1, +m[4]),
    }
  }
  return null
}

function toCss({ r, g, b, a }: RGBA): string {
  const R = Math.round(Math.max(0, Math.min(255, r)))
  const G = Math.round(Math.max(0, Math.min(255, g)))
  const B = Math.round(Math.max(0, Math.min(255, b)))
  if (a >= 0.999) {
    const hex = (n: number) => n.toString(16).padStart(2, '0')
    return `#${hex(R)}${hex(G)}${hex(B)}`
  }
  return `rgba(${R},${G},${B},${Math.round(a * 1000) / 1000})`
}

// ── HSL ───────────────────────────────────────────────────────────────────────

interface HSL { h: number; s: number; l: number }

function rgbToHsl(r: number, g: number, b: number): HSL {
  const R = r / 255, G = g / 255, B = b / 255
  const max = Math.max(R, G, B), min = Math.min(R, G, B)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) * 60
  else if (max === G) h = ((B - R) / d + 2) * 60
  else h = ((R - G) / d + 4) * 60
  return { h, s, l }
}

function hslToRgb({ h, s, l }: HSL): { r: number; g: number; b: number } {
  if (s === 0) { const v = l * 255; return { r: v, g: v, b: v } }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const H = ((h % 360) + 360) % 360 / 360
  const hue = (t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return { r: hue(H + 1 / 3) * 255, g: hue(H) * 255, b: hue(H - 1 / 3) * 255 }
}

// ── Objetivo del tema claro ───────────────────────────────────────────────────

/** Azul de marca del tema claro. Es el único azul de acento de toda la app. */
export const ACCENT = { r: 15, g: 68, b: 139 } // #0F448B

/** Tinte frío mínimo para que los grises claros no se lean "sucios" sobre blanco. */
const COOL_BIAS_H = 220
const COOL_BIAS_S = 0.14

function isRedFamily(h: number, s: number): boolean {
  // Rojos/rosas saturados: el rojo de marca vive en ~351°, sus variantes entre 340–15°.
  return s > 0.35 && (h >= 335 || h <= 18)
}

/** Convierte un color de la paleta oscura a su equivalente en tema claro. */
export function toLight(input: string): string {
  const c = parseColor(input)
  if (!c) return input

  const { h, s, l } = rgbToHsl(c.r, c.g, c.b)

  // 1. Familia roja → SIEMPRE el azul de marca exacto, sin variantes.
  // Todo lo que era rojo en el tema oscuro es #0F448B en el claro; lo único que
  // se conserva es el alpha, para que los tintes y bordes translúcidos sigan
  // funcionando como washes del mismo azul.
  if (isRedFamily(h, s)) {
    return toCss({ ...ACCENT, a: c.a })
  }

  // 2. Eje acromático (blancos, negros, grises) → luminosidad invertida.
  if (s <= 0.18) {
    const nl = 1 - l
    // Los extremos se anclan: blanco puro → tinta, negro puro → blanco.
    const anchored = l > 0.94 ? 0.045 : l < 0.06 ? 0.985 : nl
    // Sesgo frío suave solo en superficies claras, para que el blanco no sea plano.
    const bias = anchored > 0.7 ? COOL_BIAS_S * 0.25 : COOL_BIAS_S * 0.5
    const rgb = hslToRgb({ h: COOL_BIAS_H, s: bias, l: anchored })
    return toCss({ ...rgb, a: c.a })
  }

  // 3. Colores semánticos (verde, ámbar, cian…) → mismo tono, legible sobre blanco.
  // Los amarillos y ámbares son los que peor contrastan sobre blanco, así que se
  // limitan más que el resto.
  const isAmber = h >= 35 && h <= 70
  const cap = isAmber ? 0.40 : 0.48
  const nl = l > cap ? Math.max(isAmber ? 0.30 : 0.34, Math.min(l - 0.22, cap)) : l
  const rgb = hslToRgb({ h, s: Math.min(1, s * 1.05), l: nl })
  return toCss({ ...rgb, a: c.a })
}

// ── Caché ─────────────────────────────────────────────────────────────────────

const cache = new Map<string, string>()

/**
 * Colores que ya son resultado de una conversión.
 *
 * Un mismo color pasa por el interceptor varias veces: los componentes de React
 * Native reenvían `style` y `color` a sus elementos internos, así que cada nivel
 * de reenvío vuelve a verlo. La conversión es prácticamente su propia inversa
 * (blanco ↔ tinta), de modo que un número par de pasadas devolvía el color
 * original y el tema claro se quedaba oscuro. Registrando las salidas, convertir
 * es idempotente y da igual cuántas veces se aplique.
 */
const produced = new Set<string>()

/**
 * Blanco que sobrevive a la conversión.
 *
 * `#fff` no sirve para esto: significa dos cosas opuestas —texto sobre fondo
 * oscuro (que debe volverse tinta) y texto sobre un botón de acento (que debe
 * seguir blanco)—. Este literal representa solo el segundo caso y está marcado
 * como resultado final, así que da igual cuántas veces vuelva a pasar por el
 * interceptor: nunca se convierte.
 */
export const KEEP_WHITE = 'rgba(255,255,255,1)'

/**
 * Marca un color como ya perteneciente al tema claro para que el interceptor no
 * lo toque. Para componentes que definen a mano sus colores de tema claro.
 */
export function final(color: string): string {
  produced.add(color)
  return color
}

final(KEEP_WHITE)

/** toLight() memoizado e idempotente — se llama en cada render. */
export function remap(input: string): string {
  if (produced.has(input)) return input
  const hit = cache.get(input)
  if (hit !== undefined) return hit
  const out = toLight(input)
  cache.set(input, out)
  produced.add(out)
  return out
}

/**
 * ¿Este color es un fondo de acento sólido? Sirve para detectar botones de
 * acción, donde el texto blanco debe seguir siendo blanco en tema claro
 * (blanco sobre el azul de marca).
 *
 * Solo cuentan los colores SATURADOS, nunca los neutros oscuros: un panel negro
 * se convierte en una superficie clara, así que su texto tiene que oscurecerse
 * como cualquier otro. Incluir los neutros aquí dejaba títulos blancos sobre
 * fondo blanco.
 */
export function isSolidStrong(input: string): boolean {
  const c = parseColor(input)
  if (!c || c.a < 0.85) return false
  const { h, s, l } = rgbToHsl(c.r, c.g, c.b)
  if (isRedFamily(h, s)) return true   // botón rojo → azul de marca, sigue oscuro
  return s > 0.35 && l < 0.62          // acento saturado que sigue oscuro en claro
}

/** ¿El color es prácticamente blanco puro? (texto/icono sobre botón de acción) */
export function isNearWhite(input: string): boolean {
  const c = parseColor(input)
  if (!c || c.a < 0.6) return false
  return c.r > 235 && c.g > 235 && c.b > 235
}
