/**
 * AL AIRE LIBRE · RESUMEN
 * ═══════════════════════
 * Lo que acaba de pasar, justo al terminar.
 *
 * ── La sensación se pregunta AQUÍ y una sola vez ────────────────────────────
 * Es el único momento en que alguien la contesta de verdad: en frío, dos días
 * después, nadie vuelve a rellenar cómo se sintió el martes. Por eso está en
 * la pantalla de cierre y no escondida en el detalle de la actividad.
 *
 * Es también el único dato de todo el módulo que NO lo mide un sensor, y por
 * eso vale: el GPS sabe que fuiste a 5:24, no sabe que ibas roto.
 */

import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { RunningColors } from '@/constants/running-tokens'
import { Tarjeta, Aura, Etiqueta, Divisor, Chip, Boton } from '@/components/outdoor/Material'
import { Cifra, Metrica, FilaMetricas } from '@/components/outdoor/Cifra'
import { Recorrido, Altimetria } from '@/components/outdoor/Graficas'
import { Cabecera } from '@/components/outdoor/Cabecera'
import { DEPORTES } from '@/components/outdoor/Iconos'
import { useOutdoorStore, ritmo, mmss, hhmmss } from '@/store/outdoorStore'

const SENSACIONES = ['Fatal', 'Floja', 'Normal', 'Buena', 'Volando']

export default function Resumen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  const actividad = useOutdoorStore(s => s.historial.find(a => a.id === id) ?? s.historial[0])
  const anotar = useOutdoorStore(s => s.anotar)
  const [sensacion, setSensacion] = useState<number | null>(actividad?.sensacion ?? null)

  if (!actividad) {
    return (
      <View style={[s.raiz, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={s.vacio}>No encuentro esa actividad.</Text>
        <View style={{ width: 200, marginTop: 16 }}>
          <Boton onPress={() => router.replace('/aire-libre' as never)}>Volver</Boton>
        </View>
      </View>
    )
  }

  const info = DEPORTES[actividad.deporte]
  const km = actividad.metros / 1000
  const rit = ritmo(actividad.metros, actividad.segundos)
  const velocidad = actividad.segundos > 0 ? (actividad.metros / actividad.segundos) * 3.6 : 0
  const alturas = actividad.puntos.map(p => p.alt).filter((a): a is number => a != null)
  const fecha = new Date(actividad.inicio)

  const guardar = (i: number) => {
    Haptics.selectionAsync()
    setSensacion(i)
    anotar(actividad.id, i, actividad.nota)
  }

  return (
    <View style={s.raiz}>
      <Aura ancho={width} alto={height} />
      <Cabecera
        titulo="Resumen"
        sub={`${info.nombre} · ${fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        sinVolver
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}>
        <Tarjeta plana>
          <Recorrido puntos={actividad.puntos} alto={128} grosor={4.6} />
          <View style={{ padding: 15 }}>
            <View style={s.ct}>
              <Etiqueta>{fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</Etiqueta>
              <Chip>{info.nombre}</Chip>
            </View>
            <Cifra valor={km.toFixed(2)} unidad="km" tam={40} />

            <Divisor />
            <FilaMetricas>
              <Metrica etiqueta="Tiempo" valor={hhmmss(actividad.segundos)} tam={17} />
              <Metrica
                etiqueta={actividad.deporte === 'bici' ? 'Velocidad' : 'Ritmo'}
                valor={actividad.deporte === 'bici' ? velocidad.toFixed(1) : (rit ? mmss(rit) : '—')}
                unidad={actividad.deporte === 'bici' ? 'km/h' : undefined}
                tam={17}
              />
              <Metrica etiqueta="Desnivel" valor={String(Math.round(actividad.desnivelPositivo))} unidad="m" tam={17} />
            </FilaMetricas>

            <View style={{ height: 12 }} />
            <FilaMetricas>
              <Metrica etiqueta="Parciales" valor={String(actividad.parciales.length)} unidad="km" tam={17} />
              <Metrica etiqueta="Bajada" valor={String(Math.round(actividad.desnivelNegativo))} unidad="m" tam={17} />
              <Metrica etiqueta="Puntos" valor={String(actividad.puntos.length)} tam={17} />
            </FilaMetricas>

            <Divisor />
            <Etiqueta style={{ marginBottom: 8 }}>¿Cómo te sentiste?</Etiqueta>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {SENSACIONES.map((t, i) => (
                <Pressable key={t} onPress={() => guardar(i)} style={{ flex: 1 }}>
                  <Chip activo={sensacion === i} style={{ alignSelf: 'stretch', alignItems: 'center', paddingVertical: 7 }}>
                    {t}
                  </Chip>
                </Pressable>
              ))}
            </View>
          </View>
        </Tarjeta>

        {actividad.parciales.length > 0 && (
          <Tarjeta style={{ marginTop: 9 }}>
            <View style={s.ct}>
              <Etiqueta>Por kilómetro</Etiqueta>
              {rit && <Text style={s.nota}>medio {mmss(rit)}</Text>}
            </View>
            {actividad.parciales.map(p => {
              const mejor = p.segundos === Math.min(...actividad.parciales.map(x => x.segundos))
              const peor = Math.max(...actividad.parciales.map(x => x.segundos))
              const ancho = Math.round((p.segundos / peor) * 100)
              return (
                <View key={p.km} style={s.split}>
                  <Text style={s.splitKm}>{p.km}</Text>
                  <View style={s.carril}>
                    <View style={[
                      s.relleno,
                      { width: `${ancho}%` as `${number}%` },
                      mejor && { backgroundColor: RunningColors.signal.base },
                    ]} />
                  </View>
                  <Text style={[s.splitDes, p.desnivel > 0 && { color: RunningColors.state.loaded }]}>
                    {p.desnivel > 0 ? '+' : ''}{p.desnivel} m
                  </Text>
                  <Cifra valor={mmss(p.segundos)} tam={12} color={mejor ? '#FF93A6' : '#fff'} />
                </View>
              )
            })}
          </Tarjeta>
        )}

        {alturas.length > 2 && (
          <Tarjeta style={{ marginTop: 9 }}>
            <View style={s.ct}>
              <Etiqueta>Perfil de altura</Etiqueta>
              <Text style={s.nota}>
                +{Math.round(actividad.desnivelPositivo)} m / −{Math.round(actividad.desnivelNegativo)} m
              </Text>
            </View>
            <Altimetria serie={alturas} alto={66} />
            <Text style={s.aviso}>
              La altura sale del GPS, no del barómetro. Es aproximada.
            </Text>
          </Tarjeta>
        )}

        <View style={{ marginTop: 14, gap: 8 }}>
          <Boton rojo onPress={() => router.replace({ pathname: '/aire-libre/actividad/[id]', params: { id: actividad.id } } as never)}>
            Ver el detalle
          </Boton>
          <Boton onPress={() => router.replace('/aire-libre' as never)}>Listo</Boton>
        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: RunningColors.surface.void },
  vacio: { fontSize: 13, color: 'rgba(255,255,255,0.45)' },
  ct: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  nota: { fontSize: 10.5, color: 'rgba(255,255,255,0.4)' },
  aviso: { fontSize: 10.5, color: 'rgba(255,255,255,0.32)', marginTop: 9, lineHeight: 15 },
  split: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 3.5 },
  splitKm: { width: 13, fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.34)' },
  carril: { flex: 1, height: 16, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  relleno: { height: '100%', borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.28)' },
  splitDes: { width: 38, fontSize: 9.5, textAlign: 'right', color: 'rgba(255,255,255,0.32)' },
})
