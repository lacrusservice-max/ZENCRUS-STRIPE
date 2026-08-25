/**
 * AL AIRE LIBRE · ACTIVIDADES
 * ═══════════════════════════
 * Todo lo que llevas grabado, agrupado por mes y filtrable por deporte.
 *
 * Cada fila lleva su recorrido en miniatura, dibujado con los puntos reales de
 * esa salida: se reconoce la ruta antes de leer la fecha. Y si una actividad no
 * tiene puntos —porque el GPS no llegó a enganchar— la miniatura se queda vacía
 * en vez de inventar una forma bonita.
 */

import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { RunningColors } from '@/constants/running-tokens'
import { Tarjeta, Aura, Etiqueta, Chip } from '@/components/outdoor/Material'
import { Cifra } from '@/components/outdoor/Cifra'
import { Recorrido } from '@/components/outdoor/Graficas'
import { Cabecera } from '@/components/outdoor/Cabecera'
import { BarraPestanas, ALTO_BARRA } from '@/components/outdoor/BarraPestanas'
import { DEPORTES, ORDEN_DEPORTES, Deporte } from '@/components/outdoor/Iconos'
import { useOutdoorStore, ritmo, mmss, hhmmss, Actividad } from '@/store/outdoorStore'

export default function Actividades() {
  const { width, height } = useWindowDimensions()
  const historial = useOutdoorStore(s => s.historial)
  const [filtro, setFiltro] = useState<Deporte | null>(null)

  const visibles = useMemo(
    () => (filtro ? historial.filter(a => a.deporte === filtro) : historial),
    [historial, filtro]
  )

  /** Agrupadas por mes, en orden descendente. */
  const meses = useMemo(() => {
    const mapa = new Map<string, Actividad[]>()
    for (const a of visibles) {
      const d = new Date(a.inicio)
      const clave = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
      if (!mapa.has(clave)) mapa.set(clave, [])
      mapa.get(clave)!.push(a)
    }
    return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [visibles])

  return (
    <View style={s.raiz}>
      <Aura ancho={width} alto={height} />
      <Cabecera
        titulo="Actividad"
        titular
        derecha={
          <Pressable onPress={() => router.push('/aire-libre/calendario' as never)} hitSlop={10} style={s.accion}>
            <Ionicons name="calendar-outline" size={17} color="rgba(255,255,255,0.7)" />
          </Pressable>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: ALTO_BARRA + 20 }}>
        <View style={s.filtros}>
          <Pressable onPress={() => { Haptics.selectionAsync(); setFiltro(null) }}>
            <Chip activo={filtro === null}>Todo</Chip>
          </Pressable>
          {ORDEN_DEPORTES.map(d => (
            <Pressable key={d} onPress={() => { Haptics.selectionAsync(); setFiltro(d === filtro ? null : d) }}>
              <Chip activo={filtro === d}>
                <Ionicons name={DEPORTES[d].icono} size={12} color={filtro === d ? '#0D0D12' : 'rgba(255,255,255,0.62)'} />
              </Chip>
            </Pressable>
          ))}
        </View>

        {meses.length === 0 ? (
          <Tarjeta>
            <Text style={s.vacioTit}>Todavía no hay nada grabado</Text>
            <Text style={s.vacioTxt}>
              {filtro
                ? `Ninguna salida de ${DEPORTES[filtro].nombre.toLowerCase()} por ahora.`
                : 'En cuanto termines una salida aparecerá aquí, con su recorrido y sus parciales.'}
            </Text>
          </Tarjeta>
        ) : (
          meses.map(([clave, lista]) => {
            const [anio, mes] = clave.split('-').map(Number)
            const total = lista.reduce((x, a) => x + a.metros, 0) / 1000
            const nombreMes = new Date(anio, mes, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
            return (
              <View key={clave} style={{ marginBottom: 14 }}>
                <View style={s.cabeceraMes}>
                  <Etiqueta>{nombreMes}</Etiqueta>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7 }}>
                    <Cifra valor={total.toFixed(1)} unidad="km" tam={19} />
                    <Text style={s.nota}>{lista.length} {lista.length === 1 ? 'salida' : 'salidas'}</Text>
                  </View>
                </View>

                <Tarjeta plana>
                  {lista.map((a, i) => <Fila key={a.id} a={a} primera={i === 0} />)}
                </Tarjeta>
              </View>
            )
          })
        )}
      </ScrollView>

      <BarraPestanas />
    </View>
  )
}

function Fila({ a, primera }: { a: Actividad; primera: boolean }) {
  const info = DEPORTES[a.deporte]
  const km = a.metros / 1000
  const rit = ritmo(a.metros, a.segundos)
  const d = new Date(a.inicio)
  const cuando = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' })
  const hora = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/aire-libre/actividad/[id]', params: { id: a.id } } as never)}
      style={({ pressed }) => [s.fila, !primera && s.filaBorde, pressed && { opacity: 0.7 }]}
    >
      <View style={s.mini}>
        <Recorrido puntos={a.puntos} alto={40} grosor={2.4} extremos={false} margen={5} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.filaTit} numberOfLines={1}>{cuando} · {hora}</Text>
        <Text style={s.filaSub} numberOfLines={1}>
          {info.nombre} · {hhmmss(a.segundos)}{rit ? ` · ${mmss(rit)} /km` : ''}
        </Text>
      </View>
      <Cifra valor={km.toFixed(2)} unidad="km" tam={16} />
    </Pressable>
  )
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: RunningColors.surface.void },
  accion: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  filtros: { flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  cabeceraMes: { marginBottom: 9, gap: 3 },
  nota: { fontSize: 10.5, color: 'rgba(255,255,255,0.34)' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9, paddingHorizontal: 15 },
  filaBorde: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  mini: { width: 40, height: 40, borderRadius: 11, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)' },
  filaTit: { fontSize: 12.5, fontWeight: '600', color: '#fff', letterSpacing: -0.2 },
  filaSub: { fontSize: 10.5, color: 'rgba(255,255,255,0.36)', marginTop: 1 },
  vacioTit: { fontSize: 14.5, fontWeight: '700', color: '#fff', marginBottom: 5 },
  vacioTxt: { fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 18 },
})
