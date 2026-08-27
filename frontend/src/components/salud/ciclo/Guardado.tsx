/**
 * «GUARDADO ✓»
 * ═══════════════════════════════════════════════════════════════════════════
 * El acuse que aparece un instante antes de salir del registro.
 *
 * ── Por qué hace falta si ya se guarda al tocar ────────────────────────────
 * Precisamente por eso. El registro guarda cada toque al momento y nunca
 * enseña un botón de «guardar» que haga nada: el botón del final solo cierra.
 * Eso es lo correcto —cerrar a media captura no pierde nada— pero deja a
 * quien registra sin ninguna señal de que su trabajo esté a salvo, y la
 * reacción natural ante esa duda es volver a entrar a comprobarlo. Este medio
 * segundo es lo que cierra el gesto.
 *
 * ── Y por qué no sale siempre ──────────────────────────────────────────────
 * Solo si de verdad se guardó algo en esta visita. Decir «guardado» al salir
 * de una pantalla en la que no se tocó nada es ruido, y peor: entrena a no
 * leerlo, con lo que el día que importe tampoco se leerá.
 *
 * ── Medio segundo, no dos ──────────────────────────────────────────────────
 * Lo justo para verlo sin que se convierta en una espera. La navegación
 * ocurre al terminar, así que cada milisegundo de más es un milisegundo que
 * ella no puede hacer nada.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Animated, Easing } from 'react-native'
import { Icono } from './Claro'
import { SUP, TEXTO, FUENTE, SOMBRA, ACENTO } from '@/theme/salud/cicloClaro'

/** Lo que se ve el acuse antes de que la pantalla se vaya. */
const ESPERA = 620

export function useGuardadoAlSalir(salir: () => void) {
  const [tocado, setTocado] = useState(false)
  const [visible, setVisible] = useState(false)
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Si la pantalla se desmonta por otro camino —el gesto de volver de iOS, un
     enlace profundo— el temporizador seguiría vivo y navegaría desde una
     pantalla que ya no existe. */
  useEffect(() => () => { if (reloj.current) clearTimeout(reloj.current) }, [])

  const marcar = useCallback(() => setTocado(true), [])

  const cerrar = useCallback(() => {
    if (!tocado) { salir(); return }
    setVisible(true)
    reloj.current = setTimeout(salir, ESPERA)
  }, [tocado, salir])

  return { marcar, cerrar, visible }
}

export function Guardado({ visible }: { visible: boolean }) {
  const v = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible) return
    Animated.timing(v, {
      toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true,
    }).start()
  }, [visible, v])

  if (!visible) return null

  return (
    <View style={s.capa} pointerEvents="none">
      <Animated.View style={[s.pastilla, {
        opacity: v,
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
      }]}>
        <Icono nombre="stats_check" tam={20} />
        <Text style={s.txt}>Guardado</Text>
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  capa: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  pastilla: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 20, paddingVertical: 13, borderRadius: 999,
    backgroundColor: SUP.tarjeta, borderWidth: 1, borderColor: ACENTO.moradoFondo,
    ...SOMBRA,
  },
  txt: { fontFamily: FUENTE.fuerte, fontSize: 15, color: TEXTO.fuerte },
})
