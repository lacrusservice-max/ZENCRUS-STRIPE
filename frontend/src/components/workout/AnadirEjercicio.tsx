/**
 * ENTRENA · AÑADIR UN EJERCICIO AL DÍA
 * ════════════════════════════════════
 * El plan propone y tú añades. Se abre desde un grupo muscular concreto y llega
 * ya filtrado por él: si estás en «Espalda», la lista arranca con espalda.
 *
 * ── DOS CAMINOS, Y LOS DOS VALEN ────────────────────────────────────────────
 * 1. **Buscarlo en el catálogo.** Ata el ejercicio a su `slug`, así que las
 *    series cuentan para su historial y su progresión.
 * 2. **Escribirlo a mano.** En un gimnasio siempre hay una máquina que no está
 *    en ningún catálogo, y obligar a elegir una parecida ensucia el historial
 *    de la que elijas. Sin `slug` no hay progresión, y eso se dice.
 *
 * El segundo no es un consuelo: es la mitad del motivo por el que esto existe.
 *
 * ── Lo añadido es TUYO y de ESE día ─────────────────────────────────────────
 * No modifica el programa. Mañana el plan sigue diciendo lo que decía, porque
 * meter una máquina un martes suelto no significa querer cambiarlo para las
 * siete semanas que quedan.
 */

import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, Modal, TextInput, TouchableOpacity,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Typography } from '@/constants/theme'
import { listExercises } from '@/services/exerciseService'

type Card = { slug: string; name: string; muscleEs?: string | null }

export function AnadirEjercicio({
  abierto, musculoId, musculoNombre, onCerrar, onElegir,
}: {
  abierto: boolean
  /** Filtro de partida. `null` = todo el catálogo. */
  musculoId: string | null
  musculoNombre: string | null
  onCerrar: () => void
  /** `slug` es null cuando el usuario lo escribió a mano. */
  onElegir: (nombre: string, slug: string | null, musculo: string | null) => void
}) {
  const [texto, setTexto] = useState('')
  const [lista, setLista] = useState<Card[]>([])
  const [cargando, setCargando] = useState(false)
  const [soloEsteMusculo, setSoloEsteMusculo] = useState(true)

  const buscar = useCallback(async () => {
    setCargando(true)
    try {
      const r = await listExercises({
        q: texto.trim() || undefined,
        muscle: soloEsteMusculo && musculoId ? musculoId : undefined,
        limit: 40,
      })
      setLista((r?.exercises ?? []) as Card[])
    } catch {
      // Sin red no se puede buscar, pero SÍ se puede escribir a mano. La lista
      // se queda vacía y el camino de escribirlo sigue abierto abajo.
      setLista([])
    } finally {
      setCargando(false)
    }
  }, [texto, soloEsteMusculo, musculoId])

  // Se espera a que pare de escribir: una petición por tecla satura y además
  // devuelve resultados desordenados si llegan fuera de orden.
  useEffect(() => {
    if (!abierto) return
    const t = setTimeout(() => { void buscar() }, 280)
    return () => clearTimeout(t)
  }, [abierto, buscar])

  useEffect(() => {
    if (abierto) { setTexto(''); setSoloEsteMusculo(!!musculoId) }
  }, [abierto, musculoId])

  const escrito = texto.trim()
  const yaEnLista = lista.some(x => x.name.toLowerCase() === escrito.toLowerCase())

  return (
    <Modal visible={abierto} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={s.fondo}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.hoja}>
          <View style={s.asa} />

          <View style={s.cabecera}>
            <View style={{ flex: 1 }}>
              <Text style={s.titulo}>Añadir ejercicio</Text>
              {musculoNombre && <Text style={s.sub}>a {musculoNombre.toLowerCase()}, solo por hoy</Text>}
            </View>
            <TouchableOpacity onPress={onCerrar} hitSlop={10} style={s.cerrar}>
              <Ionicons name="close" size={18} color={Colors.neon.w2} />
            </TouchableOpacity>
          </View>

          <View style={s.buscador}>
            <Ionicons name="search" size={15} color={Colors.neon.w4} />
            <TextInput
              value={texto}
              onChangeText={setTexto}
              placeholder="Busca o escribe el tuyo"
              placeholderTextColor={Colors.neon.w4}
              style={s.input}
              autoCorrect={false}
              returnKeyType="search"
            />
            {!!texto && (
              <TouchableOpacity onPress={() => setTexto('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={Colors.neon.w4} />
              </TouchableOpacity>
            )}
          </View>

          {musculoId && (
            <TouchableOpacity
              style={s.filtro}
              onPress={() => { void Haptics.selectionAsync(); setSoloEsteMusculo(v => !v) }}
            >
              <Ionicons
                name={soloEsteMusculo ? 'checkbox' : 'square-outline'}
                size={15}
                color={soloEsteMusculo ? Colors.neon.red : Colors.neon.w3}
              />
              <Text style={s.filtroTxt}>Solo {musculoNombre?.toLowerCase()}</Text>
            </TouchableOpacity>
          )}

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            {/* Escribirlo a mano va PRIMERO cuando hay texto: si has tecleado el
                nombre de tu máquina, lo que quieres es esa, no una parecida. */}
            {escrito.length > 1 && !yaEnLista && (
              <TouchableOpacity
                style={[s.fila, s.filaPropia]}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  onElegir(escrito, null, musculoId)
                }}
              >
                <View style={[s.icono, s.iconoPropio]}>
                  <Ionicons name="create-outline" size={16} color={Colors.neon.red} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.nombre}>«{escrito}»</Text>
                  <Text style={s.pista}>Escrito por ti · sin historial ni progresión</Text>
                </View>
                <Ionicons name="add" size={18} color={Colors.neon.red} />
              </TouchableOpacity>
            )}

            {cargando && <ActivityIndicator style={{ marginTop: 18 }} color={Colors.neon.w3} />}

            {!cargando && lista.length === 0 && escrito.length <= 1 && (
              <Text style={s.vacio}>Escribe para buscar en los 206 del catálogo.</Text>
            )}

            {lista.map(x => (
              <TouchableOpacity
                key={x.slug}
                style={s.fila}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  onElegir(x.name, x.slug, musculoId)
                }}
              >
                <View style={s.icono}>
                  <Ionicons name="barbell-outline" size={16} color={Colors.neon.w3} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.nombre} numberOfLines={1}>{x.name}</Text>
                  {x.muscleEs && <Text style={s.pista}>{x.muscleEs}</Text>}
                </View>
                <Ionicons name="add" size={18} color={Colors.neon.w3} />
              </TouchableOpacity>
            ))}

            <View style={{ height: 26 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(5,5,5,0.62)', justifyContent: 'flex-end' },
  hoja: {
    maxHeight: '86%',
    backgroundColor: Colors.neon.void,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: Spacing[4], paddingBottom: Spacing[5],
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)',
  },
  asa: {
    width: 38, height: 4, borderRadius: 2, alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)', marginTop: 9, marginBottom: 13,
  },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 13 },
  titulo: { fontSize: 19, fontWeight: '800', color: '#fff', letterSpacing: -0.4 },
  sub: { fontSize: 11.5, color: Colors.neon.w3, marginTop: 2 },
  cerrar: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 13,
    paddingHorizontal: 12, height: 44,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)',
  },
  input: { flex: 1, color: '#fff', fontSize: 14.5 },
  filtro: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 11 },
  filtroTxt: { fontSize: 12.5, color: Colors.neon.w2 },
  fila: {
    flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  filaPropia: { borderBottomColor: 'rgba(255,92,0,0.3)' },
  icono: {
    width: 34, height: 34, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  iconoPropio: { backgroundColor: 'rgba(255,92,0,0.14)' },
  nombre: { fontSize: 13.5, fontWeight: '600', color: '#fff', letterSpacing: -0.2 },
  pista: { fontSize: 10.5, color: Colors.neon.w4, marginTop: 1 },
  vacio: { fontSize: 12, color: Colors.neon.w4, textAlign: 'center', marginTop: 24, lineHeight: 18 },
})
