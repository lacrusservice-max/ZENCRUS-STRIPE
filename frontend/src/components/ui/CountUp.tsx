import { useEffect, useRef, useState } from 'react'
import { Text, TextStyle, StyleProp } from 'react-native'

interface CountUpProps {
  value: number
  duration?: number
  style?: StyleProp<TextStyle>
  /** Separador de miles con espacio fino, como en el diseño. */
  format?: (n: number) => string
}

const defaultFormat = (n: number) =>
  Math.round(n).toLocaleString('es-MX').replace(/,/g, ' ')

/**
 * Cifra que sube desde cero con desaceleración cúbica.
 * Usa JS timing (no Reanimated) porque necesitamos re-renderizar texto,
 * que no es animable en el hilo de UI.
 */
export function CountUp({ value, duration = 1500, style, format = defaultFormat }: CountUpProps) {
  const [display, setDisplay] = useState(0)
  const raf = useRef<number | null>(null)
  const start = useRef<number | null>(null)

  useEffect(() => {
    start.current = null
    const from = 0
    const to = value

    const step = (ts: number) => {
      if (start.current === null) start.current = ts
      const p = Math.min((ts - start.current) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(from + (to - from) * eased)
      if (p < 1) raf.current = requestAnimationFrame(step)
    }

    raf.current = requestAnimationFrame(step)
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current)
    }
  }, [value, duration])

  return <Text style={style}>{format(display)}</Text>
}
