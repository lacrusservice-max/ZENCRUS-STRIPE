/**
 * AL AIRE LIBRE · DETALLE DE UNA ACTIVIDAD
 * ════════════════════════════════════════
 * El análisis. Cuatro vistas del mismo recorrido, porque son cuatro preguntas
 * distintas y ninguna cabe bien en la pantalla de las otras:
 *
 *   · **Parciales** — ¿dónde apreté y dónde me hundí?
 *   · **Altura**    — ¿lo lento era yo o era la cuesta?
 *   · **Pulso**     — ¿a qué esfuerzo fui de verdad?
 *   · **Mapa**      — ¿por dónde pasé?
 *
 * ── El desnivel va PEGADO al parcial, no en otra tarjeta ────────────────────
 * Un kilómetro a 6:10 con +40 m no es un mal kilómetro; el mismo tiempo en
 * llano sí lo es. Separar las dos cifras obliga a comparar dos listas a mano,
 * y nadie lo hace: se queda con «fui lento».
 */

import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { RunningColors } from '@/constants/running-tokens'
import { Tarjeta, Aura, Etiqueta, Divisor, Chip } from '@/components/outdoor/Material'
import { Cifra, Metrica, FilaMetricas } from '@/components/outdoor/Cifra'
import { Recorrido, Altimetria, GraficaPulso, Barras } from '@/components/outdoor/Graficas'
import { Cabecera } from '@/components/outdoor/Cabecera'
import { DEPORTES } from '@/components/outdoor/Iconos'
import { useOutdoorStore, ritmo, mmss, hhmmss } from '@/store/outdoorStore'

type Vista = 'parciales' | 'altura' | 'pulso' | 'mapa'
const VISTAS: { id: Vista; nombre: string }[] = [
  { id: 'parciales', nombre: 'Parciales' },
  { id: 'altura', nombre: 'Altura' },
  { id: 'pulso', nombre: 'Pulso' },
  { id: 'mapa', nombre: 'Mapa' },
]

export default function DetalleActividad() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { width, height } = useWindowDimensions()
  const a = useOutdoorStore(s => s.historial.find(x => x.id === id))
  const [vista, setVista] = useState<Vista>('parciales')

  if (!a) {
    return (
      <View style={[s.raiz, { alignItems: 'center', justifyContent: 'center' }]}>
        <Cabecera titulo="Actividad" />
        <Text style={s.vacio}>No encuentro esa actividad.</Text>
      </View>
    )
  }

  const info = DEPORTES[a.deporte]
  const km = a.metros / 1000
  const rit = ritmo(a.metros, a.segundos)
  const velocidad = a.segundos > 0 ? (a.metros / a.segundos) * 3.6 : 0
  const alturas = a.puntos.map(p => p.alt).filter((x): x is number => x != null)
  const fecha = new Date(a.inicio)
  const sensacion = ['Fatal', 'Floja', 'Normal', 'Buena', 'Volando']

  return (
    <View style={s.raiz}>
      <Aura ancho={width} alto={height} />
      <Cabecera
        titulo={info.nombre}
        sub={fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
        derecha={a.sensacion != null ? <Chip>{sensacion[a.sensacion]}</Chip> : undefined}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 24 }}>
        <Tarjeta>
          <Cifra valor={km.toFixed(2)} unidad="km" tam={38} />
          <Divisor />
          <FilaMetricas>
            <Metrica etiqueta="Tiempo" valor={hhmmss(a.segundos)} tam={17} />
            <Metrica
              etiqueta={a.deporte === 'bici' ? 'Velocidad' : 'Ritmo'}
              valor={a.deporte === 'bici' ? velocidad.toFixed(1) : (rit ? mmss(rit) : '—')}
              unidad={a.deporte === 'bici' ? 'km/h' : undefined}
              tam={17}
            />
            <Metrica etiqueta="Subida" valor={String(Math.round(a.desnivelPositivo))} unidad="m" tam={17} />
          </FilaMetricas>
        </Tarjeta>

        <View style={s.selector}>
          {VISTAS.map(v => (
            <Pressable key={v.id} onPress={() => { Haptics.selectionAsync(); setVista(v.id) }}>
              <Chip activo={v.id === vista}>{v.nombre}</Chip>
            </Pressable>
          ))}
        </View>

        {vista === 'parciales' && (
          <Tarjeta>
            {a.parciales.length === 0 ? (
              <Text style={s.vacioTxt}>
                Esta salida no llegó al kilómetro, así que no hay parciales que enseñar.
              </Text>
            ) : (
              <>
                <View style={s.ct}>
                  <Etiqueta>Por kilómetro</Etiqueta>
                  {rit && <Text style={s.nota}>medio {mmss(rit)}</Text>}
                </View>
                <Barras
                  valores={a.parciales.map(p => p.segundos)}
                  alto={64}
                  destacada={a.parciales.indexOf(a.parciales.reduce((m, x) => (x.segundos < m.segundos ? x : m)))}
                />
                <View style={{ height: 10 }} />
                {a.parciales.map(p => {
                  const mejor = p.segundos === Math.min(...a.parciales.map(x => x.segundos))
                  const peor = Math.max(...a.parciales.map(x => x.segundos))
                  return (
                    <View key={p.km} style={s.split}>
                      <Text style={s.splitKm}>{p.km}</Text>
                      <View style={s.carril}>
                        <View style={[
                          s.relleno,
                          { width: `${Math.round((p.segundos / peor) * 100)}%` as `${number}%` },
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
              </>
            )}
          </Tarjeta>
        )}

        {vista === 'altura' && (
          <Tarjeta>
            <View style={s.ct}>
              <Etiqueta>Perfil de altura</Etiqueta>
              <Text style={s.nota}>
                +{Math.round(a.desnivelPositivo)} / −{Math.round(a.desnivelNegativo)} m
              </Text>
            </View>
            <Altimetria serie={alturas} alto={92} />
            <Divisor />
            <FilaMetricas>
              <Metrica etiqueta="Máxima" valor={alturas.length ? String(Math.round(Math.max(...alturas))) : '—'} unidad={alturas.length ? 'm' : undefined} tam={16} />
              <Metrica etiqueta="Mínima" valor={alturas.length ? String(Math.round(Math.min(...alturas))) : '—'} unidad={alturas.length ? 'm' : undefined} tam={16} />
              <Metrica etiqueta="Desnivel" valor={String(Math.round(a.desnivelPositivo))} unidad="m" tam={16} />
            </FilaMetricas>
            <Text style={s.aviso}>
              La altura viene del GPS y no del barómetro: es aproximada. Con
              <Text style={{ color: '#fff' }}> expo-sensors </Text>
              el dato mejora bastante, y es lo siguiente que toca.
            </Text>
          </Tarjeta>
        )}

        {vista === 'pulso' && (
          <Tarjeta>
            <View style={s.ct}>
              <Etiqueta>Frecuencia cardiaca</Etiqueta>
              {a.pulso.length > 0 && (
                <Text style={s.nota}>
                  media {Math.round(a.pulso.reduce((x, y) => x + y, 0) / a.pulso.length)} · máx {Math.max(...a.pulso)}
                </Text>
              )}
            </View>
            <GraficaPulso serie={a.pulso} alto={100} />
            <Text style={s.aviso}>
              No hay pulso grabado porque no había pulsómetro conectado. Las zonas de
              esfuerzo se calculan con el corazón, no con el ritmo: estimarlas pintaría
              de rojo a quien va suave cuesta arriba, así que quedan vacías.
            </Text>
          </Tarjeta>
        )}

        {vista === 'mapa' && (
          <Tarjeta plana>
            <Recorrido puntos={a.puntos} alto={Math.min(400, height * 0.46)} grosor={5.5} />
            <View style={{ padding: 15 }}>
              <FilaMetricas>
                <Metrica etiqueta="Puntos" valor={String(a.puntos.length)} tam={16} />
                <Metrica etiqueta="Distancia" valor={km.toFixed(2)} unidad="km" tam={16} />
                <Metrica etiqueta="Duración" valor={hhmmss(a.segundos)} tam={16} />
              </FilaMetricas>
              <Text style={s.aviso}>
                Sin callejero debajo: falta decidir proveedor de mapas. El trazo son tus
                coordenadas reales, normalizadas al lienzo.
              </Text>
            </View>
          </Tarjeta>
        )}

        {a.nota ? (
          <Tarjeta style={{ marginTop: 9 }}>
            <Etiqueta style={{ marginBottom: 5 }}>Tu nota</Etiqueta>
            <Text style={s.notaTexto}>{a.nota}</Text>
          </Tarjeta>
        ) : null}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: RunningColors.surface.void },
  vacio: { fontSize: 13, color: 'rgba(255,255,255,0.45)' },
  vacioTxt: { fontSize: 12, color: 'rgba(255,255,255,0.42)', lineHeight: 18 },
  selector: { flexDirection: 'row', gap: 6, marginVertical: 10, flexWrap: 'wrap' },
  ct: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  nota: { fontSize: 10.5, color: 'rgba(255,255,255,0.4)' },
  aviso: { fontSize: 10.5, color: 'rgba(255,255,255,0.32)', lineHeight: 15.5, marginTop: 11 },
  notaTexto: { fontSize: 12.5, color: 'rgba(255,255,255,0.62)', lineHeight: 19 },
  split: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 3.5 },
  splitKm: { width: 13, fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.34)' },
  carril: { flex: 1, height: 16, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  relleno: { height: '100%', borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.28)' },
  splitDes: { width: 38, fontSize: 9.5, textAlign: 'right', color: 'rgba(255,255,255,0.32)' },
})
