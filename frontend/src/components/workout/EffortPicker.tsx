/**
 * ESFUERZO DE LA SERIE · RIR y RPE
 * ────────────────────────────────
 * Cuánto quedaba en el depósito al acabar la serie.
 *
 * ── Un control, dos lecturas ────────────────────────────────────────────────
 * RIR («repeticiones en recámara») y RPE («esfuerzo percibido») son la misma
 * escala del revés: RPE = 10 − RIR. Poner dos controles obligaría a elegir uno
 * y a que la mitad de las sesiones quedaran registradas en la escala que no se
 * usa el resto del tiempo. Aquí se toca una vez y se ve la equivalencia.
 *
 * ── Se pregunta en repeticiones, no en un número del 1 al 10 ────────────────
 * «Me quedaban 2» es una observación; «esfuerzo 8» es un juicio. La primera se
 * contesta bien de memoria justo después de soltar la barra, la segunda no.
 * Por eso lo grande es el RIR y el RPE va debajo, como consecuencia.
 *
 * Cero repeticiones en recámara es el fallo muscular, y va marcado en rojo: no
 * es una opción más de la escala, es el techo.
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

/** Hasta 5 repeticiones en recámara. Más allá, la serie no entrena nada. */
const OPCIONES = [0, 1, 2, 3, 4, 5] as const

const DESCRIPCION: Record<number, string> = {
  0: 'Al fallo — no salía una más',
  1: 'Quedaba una',
  2: 'Quedaban dos',
  3: 'Quedaban tres',
  4: 'Quedaban cuatro',
  5: 'Cinco o más — serie suave',
}

interface Props {
  /** Repeticiones en recámara. Null = no se ha dicho. */
  valor: number | null
  onCambiar: (rir: number | null) => void
}

export function EffortPicker({ valor, onCambiar }: Props) {
  const tocar = (rir: number) => {
    void Haptics.selectionAsync()
    // Volver a tocar el que ya está lo quita: registrar el esfuerzo es
    // opcional y no puede haber una elección de la que no se pueda salir.
    onCambiar(valor === rir ? null : rir)
  }

  return (
    <View style={s.wrap}>
      <View style={s.cabecera}>
        <Text style={s.titulo}>ESFUERZO</Text>
        <Text style={s.equivalencia}>
          {valor === null ? 'Opcional' : `RIR ${valor}  ·  RPE ${10 - valor}`}
        </Text>
      </View>

      <View style={s.fila}>
        {OPCIONES.map(rir => {
          const activo = valor === rir
          const fallo = rir === 0
          return (
            <TouchableOpacity
              key={rir}
              style={[
                s.celda,
                activo && s.celdaOn,
                activo && fallo && s.celdaFallo,
              ]}
              onPress={() => tocar(rir)}
              activeOpacity={0.8}
            >
              <Text style={[s.celdaTxt, activo && s.celdaTxtOn]}>
                {rir === 5 ? '5+' : rir}
              </Text>
              {/* La barra de abajo crece con el esfuerzo: se lee el nivel sin
                  saber qué significa el número. */}
              <View style={[
                s.medida,
                { width: 4 + (10 - rir) * 1.6 },
                activo && { backgroundColor: fallo ? Colors.neon.red : Colors.neon.white },
              ]} />
            </TouchableOpacity>
          )
        })}
      </View>

      <Text style={s.pie}>
        {valor === null ? 'Repeticiones que quedaban en el depósito' : DESCRIPCION[valor]}
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { gap: Spacing[2] },
  cabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  titulo: { fontSize: 10, fontWeight: '700', color: Colors.neon.w3, letterSpacing: 1.4 },
  equivalencia: { fontSize: 11, fontWeight: '700', color: Colors.neon.w2 },
  fila: { flexDirection: 'row', gap: Spacing[2] },
  celda: {
    flex: 1, alignItems: 'center', gap: 5,
    paddingVertical: Spacing[2],
    borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.neon.edge,
    backgroundColor: Colors.neon.pane,
  },
  celdaOn: { borderColor: 'rgba(255,255,255,0.55)', backgroundColor: Colors.neon.paneHi },
  celdaFallo: { borderColor: Colors.neon.red, backgroundColor: Colors.neon.redDim },
  celdaTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.w2 },
  celdaTxtOn: { color: Colors.neon.white },
  medida: { height: 3, borderRadius: 2, backgroundColor: Colors.neon.w4 },
  pie: { fontSize: 11, color: Colors.neon.w3 },
})
