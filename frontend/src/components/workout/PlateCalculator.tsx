/**
 * CALCULADORA DE DISCOS
 * ─────────────────────
 * Enseña la barra cargada tal y como se va a ver en el suelo: los discos de un
 * lado, del más grande al más pequeño, con el color que tienen de verdad.
 *
 * ── Se dibuja, no se lista ──────────────────────────────────────────────────
 * Una lista de números («25, 15, 2.5») obliga a traducir mentalmente a discos.
 * Un dibujo a escala se compara de un vistazo con lo que ya hay puesto en la
 * barra, que es lo que se hace: mirar y ver si sobra o falta uno.
 *
 * La altura de cada disco es proporcional a su peso, con un mínimo para que un
 * 1,25 siga siendo visible. A escala pura, un 1,25 al lado de un 25 sería una
 * raya de un píxel.
 */

import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { BARRAS, COLOR_DISCO, repartirDiscos } from '@/utils/discos'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

const ALTO_MAX = 76
const ALTO_MIN = 22

interface Props {
  /** Peso objetivo en kilos. */
  peso: number
  barraKg: number
  onCambiarBarra: (kg: number) => void
  /** Corrige el peso al alcanzable más cercano. */
  onAjustar?: (kg: number) => void
}

export function PlateCalculator({ peso, barraKg, onCambiarBarra, onAjustar }: Props) {
  const r = repartirDiscos(peso, barraKg)

  return (
    <View style={s.wrap}>
      {/* ── Elegir barra ────────────────────────────────────────────────── */}
      <View style={s.barras}>
        {BARRAS.map(b => {
          const activa = b.kg === barraKg
          return (
            <TouchableOpacity
              key={b.id}
              style={[s.chipBarra, activa && s.chipBarraOn]}
              onPress={() => onCambiarBarra(b.kg)}
              activeOpacity={0.8}
            >
              <Text style={[s.chipBarraTxt, activa && s.chipBarraTxtOn]}>{b.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* ── La barra dibujada ───────────────────────────────────────────── */}
      <View style={s.escena}>
        {r.menorQueLaBarra ? (
          <Text style={s.aviso}>
            {peso} kg es menos que la barra ({barraKg} kg). Elige otra barra o sube el peso.
          </Text>
        ) : r.porLado.length === 0 ? (
          <Text style={s.aviso}>La barra sola. Sin discos.</Text>
        ) : (
          <View style={s.barraFila}>
            {/* El manguito: la parte de la barra donde entran los discos. */}
            <View style={s.manguito} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              // Sin esto el ScrollView horizontal crece dentro de la columna y
              // aplasta a sus hijos hasta dejar los discos sin altura. Ya pasó
              // una vez con los filtros de la biblioteca.
              style={s.discosScroll}
              contentContainerStyle={s.discosFila}
            >
              {r.porLado.flatMap(d =>
                Array.from({ length: d.n }, (_, i) => {
                  const alto = ALTO_MIN + (ALTO_MAX - ALTO_MIN) * (d.kg / 25)
                  const color = COLOR_DISCO[d.kg] ?? Colors.neon.steel
                  return (
                    <View key={`${d.kg}-${i}`} style={s.discoCol}>
                      <View style={[s.disco, {
                        height: alto,
                        backgroundColor: color,
                        // Los discos claros necesitan un borde o se pierden
                        // contra el panel; los oscuros no.
                        borderColor: d.kg === 5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.22)',
                      }]} />
                      <Text style={s.discoKg}>{String(d.kg).replace('.', ',')}</Text>
                    </View>
                  )
                }),
              )}
            </ScrollView>
            <View style={s.tope} />
          </View>
        )}
      </View>

      {/* ── La cuenta ───────────────────────────────────────────────────── */}
      <View style={s.cuenta}>
        <View style={s.cuentaBloque}>
          <Text style={s.cuentaValor}>{String(r.kgPorLado).replace('.', ',')}</Text>
          <Text style={s.cuentaEtiqueta}>KG POR LADO</Text>
        </View>
        <View style={s.cuentaSep} />
        <View style={s.cuentaBloque}>
          <Text style={s.cuentaValor}>{String(r.total).replace('.', ',')}</Text>
          <Text style={s.cuentaEtiqueta}>TOTAL EN LA BARRA</Text>
        </View>
      </View>

      {/* Un peso que no se puede montar se DICE, no se calla: si no, quien
          carga cree que lo hizo mal. */}
      {r.falta > 0 && !r.menorQueLaBarra && (
        <TouchableOpacity
          style={s.ajuste}
          onPress={() => onAjustar?.(r.total)}
          disabled={!onAjustar}
          activeOpacity={0.8}
        >
          <Ionicons name="alert-circle-outline" size={15} color={Colors.neon.red} />
          <Text style={s.ajusteTxt}>
            Con discos normales no se llega a {String(peso).replace('.', ',')} kg.
            {onAjustar ? ` Toca para usar ${String(r.total).replace('.', ',')} kg.` : ''}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { gap: Spacing[4] },

  barras: { flexDirection: 'row', gap: Spacing[2], flexWrap: 'wrap' },
  chipBarra: {
    paddingHorizontal: Spacing[3], paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.neon.edge,
    backgroundColor: Colors.neon.pane,
  },
  chipBarraOn: { borderColor: Colors.neon.red, backgroundColor: Colors.neon.redDim },
  chipBarraTxt: { fontSize: 11, fontWeight: '700', color: Colors.neon.w2 },
  chipBarraTxtOn: { color: Colors.neon.white },

  escena: {
    minHeight: 116, justifyContent: 'center',
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1, borderColor: Colors.neon.edge,
    paddingVertical: Spacing[3],
  },
  aviso: {
    fontSize: Typography.fontSize.sm, color: Colors.neon.w2,
    textAlign: 'center', paddingHorizontal: Spacing[4], lineHeight: 20,
  },

  barraFila: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[2] },
  manguito: { width: 26, height: 9, backgroundColor: Colors.neon.steelSoft, borderRadius: 2 },
  tope: { width: 12, height: 26, backgroundColor: Colors.neon.steel, borderRadius: 3, marginLeft: 2 },
  discosScroll: { flexGrow: 0 },
  discosFila: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 2 },
  discoCol: { alignItems: 'center', gap: 4 },
  disco: { width: 15, borderRadius: 3, borderWidth: 1 },
  discoKg: { fontSize: 9, fontWeight: '700', color: Colors.neon.w3 },

  cuenta: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
    paddingVertical: Spacing[3],
  },
  cuentaBloque: { flex: 1, alignItems: 'center' },
  cuentaSep: { width: 1, height: 30, backgroundColor: Colors.neon.edge },
  cuentaValor: { fontSize: 24, fontWeight: '800', color: Colors.neon.white, letterSpacing: -0.5 },
  cuentaEtiqueta: { fontSize: 9, fontWeight: '700', color: Colors.neon.w3, letterSpacing: 1, marginTop: 2 },

  ajuste: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    backgroundColor: Colors.neon.redDim,
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.3)',
    borderRadius: BorderRadius.md, padding: Spacing[3],
  },
  ajusteTxt: { flex: 1, fontSize: 11, color: Colors.neon.redCore, lineHeight: 16 },
})
