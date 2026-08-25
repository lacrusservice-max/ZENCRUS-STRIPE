/**
 * AL AIRE LIBRE · MATERIAL
 * ════════════════════════
 * Zapatillas y bicis con los kilómetros que llevan encima.
 *
 * Los kilómetros se CALCULAN recorriendo las actividades que tienen esa pieza
 * asignada — no se guardan en un contador. `outdoorMaterialStore` explica por
 * qué: un contador que se actualiza aparte se desincroniza en cuanto borras o
 * editas una salida, y entonces no hay forma de saber cuál de los dos miente.
 *
 * ── El aviso no es decorativo ───────────────────────────────────────────────
 * Una zapatilla pasada de vueltas es una lesión esperando, y nadie lleva la
 * cuenta a mano. Por eso el aviso aparece al 85 % del tope y no al 100 %:
 * avisar cuando ya toca cambiarlas llega tarde para pedirlas.
 */

import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, useWindowDimensions, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { RunningColors } from '@/constants/running-tokens'
import { Tarjeta, Aura, Etiqueta, Chip, Boton } from '@/components/outdoor/Material'
import { Cifra } from '@/components/outdoor/Cifra'
import { Cabecera } from '@/components/outdoor/Cabecera'
import { useOutdoorStore } from '@/store/outdoorStore'
import { useOutdoorMaterial, kmDePieza, estadoDePieza, TipoMaterial, Pieza } from '@/store/outdoorMaterialStore'

const TOPES: Record<TipoMaterial, number | null> = { zapatillas: 800, bici: null }

export default function Material() {
  const { width, height } = useWindowDimensions()
  const historial = useOutdoorStore(s => s.historial)
  const { piezas, favorita, alta, baja, retirar, marcarFavorita } = useOutdoorMaterial()

  const [abierto, setAbierto] = useState<TipoMaterial | null>(null)
  const [nombre, setNombre] = useState('')
  const [arranque, setArranque] = useState('')

  const crear = () => {
    if (!abierto || !nombre.trim()) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    alta({
      tipo: abierto,
      nombre: nombre.trim(),
      arranqueKm: Number(arranque.replace(',', '.')) || 0,
      topeKm: TOPES[abierto],
    })
    setNombre(''); setArranque(''); setAbierto(null)
  }

  const grupos: { tipo: TipoMaterial; titulo: string }[] = [
    { tipo: 'zapatillas', titulo: 'Zapatillas' },
    { tipo: 'bici', titulo: 'Bicis' },
  ]

  return (
    <View style={s.raiz}>
      <Aura ancho={width} alto={height} />
      <Cabecera titulo="Material" sub={`${piezas.length} ${piezas.length === 1 ? 'pieza' : 'piezas'}`} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 30 }}>
        {grupos.map(({ tipo, titulo }) => {
          const lista = piezas.filter(p => p.tipo === tipo)
          return (
            <View key={tipo} style={{ marginBottom: 16 }}>
              <View style={s.cabeceraGrupo}>
                <Etiqueta>{titulo}</Etiqueta>
                <Pressable onPress={() => { Haptics.selectionAsync(); setAbierto(abierto === tipo ? null : tipo) }}>
                  <Chip activo={abierto === tipo}>
                    {abierto === tipo ? 'Cancelar' : '+ Añadir'}
                  </Chip>
                </Pressable>
              </View>

              {abierto === tipo && (
                <Tarjeta style={{ marginBottom: 9 }}>
                  <TextInput
                    value={nombre}
                    onChangeText={setNombre}
                    placeholder={tipo === 'zapatillas' ? 'Pegasus 41' : 'Bici de carretera'}
                    placeholderTextColor="rgba(255,255,255,0.28)"
                    style={s.input}
                  />
                  <TextInput
                    value={arranque}
                    onChangeText={setArranque}
                    placeholder="Kilómetros que ya traía (opcional)"
                    placeholderTextColor="rgba(255,255,255,0.28)"
                    keyboardType="decimal-pad"
                    style={[s.input, { marginTop: 8 }]}
                  />
                  <View style={{ marginTop: 11 }}>
                    <Boton rojo onPress={crear}>Dar de alta</Boton>
                  </View>
                </Tarjeta>
              )}

              {lista.length === 0 ? (
                <Tarjeta>
                  <Text style={s.vacio}>
                    {tipo === 'zapatillas'
                      ? 'Sin zapatillas dadas de alta. En cuanto añadas unas, se les van sumando los kilómetros de cada salida.'
                      : 'Sin bicis dadas de alta.'}
                  </Text>
                </Tarjeta>
              ) : (
                lista.map(p => (
                  <FilaPieza
                    key={p.id}
                    pieza={p}
                    km={kmDePieza(p, historial)}
                    esFavorita={favorita[p.tipo] === p.id}
                    onFavorita={() => { Haptics.selectionAsync(); marcarFavorita(p.tipo, p.id) }}
                    onRetirar={() => { Haptics.selectionAsync(); retirar(p.id, !p.retirada) }}
                    onBaja={() => Alert.alert(
                      'Dar de baja',
                      `Se borra «${p.nombre}». Las salidas que la usaron no se tocan, pero dejarán de contar sus kilómetros aquí.`,
                      [{ text: 'Cancelar', style: 'cancel' },
                       { text: 'Borrar', style: 'destructive', onPress: () => baja(p.id) }]
                    )}
                  />
                ))
              )}
            </View>
          )
        })}

        <Text style={s.nota}>
          Los kilómetros salen de sumar las salidas que llevan cada pieza asignada, no de un
          contador aparte. Así no pueden desincronizarse si borras una actividad.
        </Text>
      </ScrollView>
    </View>
  )
}

function FilaPieza({ pieza, km, esFavorita, onFavorita, onRetirar, onBaja }: {
  pieza: Pieza; km: number; esFavorita: boolean
  onFavorita: () => void; onRetirar: () => void; onBaja: () => void
}) {
  const est = estadoDePieza(pieza, km)
  const f = pieza.topeKm ? Math.min(1, km / pieza.topeKm) : 0
  const color = est.grave ? RunningColors.state.loaded : RunningColors.state.restored

  return (
    <Tarjeta brasa={est.grave} style={{ marginBottom: 9 }}>
      <View style={s.filaTitulo}>
        <View style={{ flex: 1 }}>
          <Text style={[s.nombre, pieza.retirada && { textDecorationLine: 'line-through', opacity: 0.5 }]}>
            {pieza.nombre}
          </Text>
          <Text style={[s.estado, est.grave && { color }]}>
            {est.texto} · desde {new Date(pieza.desde).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
          </Text>
        </View>
        <Cifra valor={km.toFixed(0)} unidad="km" tam={17} />
      </View>

      {pieza.topeKm != null && (
        <View style={s.carril}>
          <View style={[s.relleno, { width: `${Math.round(f * 100)}%` as `${number}%`, backgroundColor: color }]} />
        </View>
      )}

      <View style={s.acciones}>
        <Pressable onPress={onFavorita}>
          <Chip activo={esFavorita}>{esFavorita ? 'Por defecto' : 'Usar por defecto'}</Chip>
        </Pressable>
        <Pressable onPress={onRetirar}>
          <Chip>{pieza.retirada ? 'Volver a usar' : 'Retirar'}</Chip>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onBaja} hitSlop={8}>
          <Ionicons name="trash-outline" size={15} color="rgba(255,255,255,0.32)" />
        </Pressable>
      </View>
    </Tarjeta>
  )
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: RunningColors.surface.void },
  cabeceraGrupo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11,
    color: '#fff', fontSize: 13.5,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)',
  },
  filaTitulo: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 8 },
  nombre: { fontSize: 13.5, fontWeight: '700', color: '#fff', letterSpacing: -0.25 },
  estado: { fontSize: 10.5, color: 'rgba(255,255,255,0.36)', marginTop: 2 },
  carril: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  relleno: { height: '100%', borderRadius: 3 },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 11 },
  vacio: { fontSize: 12, color: 'rgba(255,255,255,0.42)', lineHeight: 18 },
  nota: { fontSize: 10.5, color: 'rgba(255,255,255,0.32)', lineHeight: 15.5, paddingHorizontal: 3 },
})
