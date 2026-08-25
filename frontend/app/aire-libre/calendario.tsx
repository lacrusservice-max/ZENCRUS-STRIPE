/**
 * AL AIRE LIBRE · CALENDARIO
 * ══════════════════════════
 * El mes de un vistazo.
 *
 * ── LOS DÍAS VACÍOS SE VEN VACÍOS ───────────────────────────────────────────
 * Es la única regla que importa aquí. Un calendario que pinta todos los días
 * con algo de color —aunque sea tenue— convierte una semana en blanco en «poca
 * actividad», y son cosas distintas: una se arregla saliendo, la otra hay que
 * verla para reconocerla. Un día sin salida es un hueco, y se queda hueco.
 *
 * ── La intensidad va contra TU mejor día del mes, no contra un absoluto ─────
 * Diez kilómetros son muchos para quien empieza y pocos para quien no. Anclar
 * la escala al máximo del propio mes hace que el mapa de calor diga algo a
 * cualquiera; anclarla a un número fijo lo deja en gris para la mitad.
 */

import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { RunningColors } from '@/constants/running-tokens'
import { Tarjeta, Aura, Etiqueta, Divisor, Chip } from '@/components/outdoor/Material'
import { Cifra, Metrica, FilaMetricas } from '@/components/outdoor/Cifra'
import { Cabecera } from '@/components/outdoor/Cabecera'
import { DEPORTES } from '@/components/outdoor/Iconos'
import { useOutdoorStore, hhmmss } from '@/store/outdoorStore'

const SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export default function Calendario() {
  const { width, height } = useWindowDimensions()
  const historial = useOutdoorStore(s => s.historial)
  const [desplaz, setDesplaz] = useState(0)   // 0 = mes actual, −1 = anterior

  const hoy = new Date()
  const vista = new Date(hoy.getFullYear(), hoy.getMonth() + desplaz, 1)
  const anio = vista.getFullYear(), mes = vista.getMonth()

  const { dias, resumen, tope } = useMemo(() => {
    const enMes = historial.filter(a => {
      const d = new Date(a.inicio)
      return d.getFullYear() === anio && d.getMonth() === mes
    })
    const porDia = new Map<number, typeof enMes>()
    for (const a of enMes) {
      const d = new Date(a.inicio).getDate()
      if (!porDia.has(d)) porDia.set(d, [])
      porDia.get(d)!.push(a)
    }
    const kmPorDia = [...porDia.entries()].map(([d, l]) => [d, l.reduce((x, a) => x + a.metros, 0) / 1000] as const)
    return {
      dias: porDia,
      tope: Math.max(0.001, ...kmPorDia.map(([, km]) => km)),
      resumen: {
        activos: porDia.size,
        km: enMes.reduce((x, a) => x + a.metros, 0) / 1000,
        segundos: enMes.reduce((x, a) => x + a.segundos, 0),
        salidas: enMes.length,
      },
    }
  }, [historial, anio, mes])

  // Lunes como primer día de la semana.
  const primero = new Date(anio, mes, 1).getDay()
  const hueco = (primero + 6) % 7
  const total = new Date(anio, mes + 1, 0).getDate()
  const celdas = [...Array(hueco).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]

  const esHoy = (d: number) =>
    desplaz === 0 && d === hoy.getDate()

  const [elegido, setElegido] = useState<number | null>(null)
  const delDia = elegido != null ? dias.get(elegido) ?? [] : []

  return (
    <View style={s.raiz}>
      <Aura ancho={width} alto={height} />
      <Cabecera
        titulo={vista.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
        sub={resumen.salidas === 0 ? 'Sin salidas este mes' : `${resumen.salidas} ${resumen.salidas === 1 ? 'salida' : 'salidas'}`}
        derecha={
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pressable onPress={() => { Haptics.selectionAsync(); setDesplaz(desplaz - 1); setElegido(null) }} style={s.nav}>
              <Ionicons name="chevron-back" size={15} color="rgba(255,255,255,0.7)" />
            </Pressable>
            <Pressable
              onPress={() => { if (desplaz < 0) { Haptics.selectionAsync(); setDesplaz(desplaz + 1); setElegido(null) } }}
              style={[s.nav, desplaz === 0 && { opacity: 0.3 }]}
            >
              <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 26 }}>
        <Tarjeta>
          <View style={s.cabeceraSemana}>
            {SEMANA.map((d, i) => <Text key={i} style={s.diaSemana}>{d}</Text>)}
          </View>

          <View style={s.rejilla}>
            {celdas.map((d, i) => {
              if (d == null) return <View key={`h${i}`} style={s.celda} />
              const lista = dias.get(d)
              const km = lista ? lista.reduce((x, a) => x + a.metros, 0) / 1000 : 0
              const f = km > 0 ? Math.min(1, km / tope) : 0
              return (
                <Pressable
                  key={d}
                  onPress={() => { Haptics.selectionAsync(); setElegido(elegido === d ? null : d) }}
                  style={[
                    s.celda,
                    km > 0
                      ? { backgroundColor: `rgba(255,31,61,${0.18 + f * 0.62})` }
                      : s.celdaVacia,
                    esHoy(d) && s.celdaHoy,
                    elegido === d && s.celdaElegida,
                  ]}
                >
                  <Text style={[s.numero, km === 0 && { color: 'rgba(255,255,255,0.26)' }]}>{d}</Text>
                </Pressable>
              )
            })}
          </View>

          <Divisor />
          <FilaMetricas>
            <Metrica etiqueta="Días activos" valor={String(resumen.activos)} tam={17} />
            <Metrica etiqueta="Distancia" valor={resumen.km.toFixed(1)} unidad="km" tam={17} />
            <Metrica etiqueta="Tiempo" valor={hhmmss(resumen.segundos)} tam={17} />
          </FilaMetricas>
        </Tarjeta>

        {elegido != null && (
          <Tarjeta style={{ marginTop: 9 }}>
            <Etiqueta style={{ marginBottom: 9 }}>
              {new Date(anio, mes, elegido).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Etiqueta>
            {delDia.length === 0 ? (
              <Text style={s.vacio}>Ese día no saliste. No es poca actividad: es ninguna.</Text>
            ) : (
              delDia.map((a, i) => (
                <Pressable
                  key={a.id}
                  onPress={() => router.push({ pathname: '/aire-libre/actividad/[id]', params: { id: a.id } } as never)}
                  style={[s.fila, i > 0 && s.filaBorde]}
                >
                  <Chip>{DEPORTES[a.deporte].nombre}</Chip>
                  <View style={{ flex: 1 }} />
                  <Cifra valor={(a.metros / 1000).toFixed(2)} unidad="km" tam={15} />
                </Pressable>
              ))
            )}
          </Tarjeta>
        )}

        {resumen.salidas === 0 && (
          <Text style={s.nota}>
            Los días en blanco están en blanco a propósito. Un calendario que los disimula
            no sirve para entrenar.
          </Text>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: RunningColors.surface.void },
  nav: {
    width: 28, height: 28, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cabeceraSemana: { flexDirection: 'row', marginBottom: 6 },
  diaSemana: { flex: 1, textAlign: 'center', fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.3)' },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap' },
  celda: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    marginVertical: 1.5,
  },
  celdaVacia: { backgroundColor: 'rgba(255,255,255,0.028)' },
  celdaHoy: { borderWidth: 1.5, borderColor: '#fff' },
  celdaElegida: { borderWidth: 1.5, borderColor: RunningColors.state.optimal },
  numero: { fontSize: 10, fontWeight: '700', color: '#fff' },
  fila: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  filaBorde: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  vacio: { fontSize: 12, color: 'rgba(255,255,255,0.42)', lineHeight: 18 },
  nota: { fontSize: 10.5, color: 'rgba(255,255,255,0.32)', lineHeight: 15.5, marginTop: 12, paddingHorizontal: 3 },
})
