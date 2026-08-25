/**
 * AL AIRE LIBRE · BARRA DE PESTAÑAS
 * ═════════════════════════════════
 * La pastilla flotante de abajo. Cuatro sitios y el botón de salir en medio.
 *
 * ── Por qué `replace` y no `push` ───────────────────────────────────────────
 * Las cuatro pestañas son hermanas, no una encima de otra. Con `push`, ir
 * Hoy → Progreso → Actividad → Hoy deja cuatro pantallas apiladas y la flecha
 * de atrás recorre un historial que el usuario no reconoce como suyo. Con
 * `replace`, la raíz siempre es una y atrás sale del módulo, que es lo que se
 * espera de una barra de pestañas.
 *
 * ── El botón del medio no es una pestaña ────────────────────────────────────
 * Empezar sí apila: es una tarea con principio y fin, y al terminarla vuelves
 * a donde estabas. Por eso va con `push` y por eso se dibuja elevado.
 */

import { View, Text, StyleSheet, Pressable } from 'react-native'
import { router, usePathname } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { RunningColors } from '@/constants/running-tokens'

type Ion = keyof typeof Ionicons.glyphMap

const PESTANAS: { ruta: string; nombre: string; icono: Ion }[] = [
  { ruta: '/aire-libre', nombre: 'Hoy', icono: 'home-outline' },
  { ruta: '/aire-libre/actividad', nombre: 'Actividad', icono: 'list-outline' },
  { ruta: '/aire-libre/progreso', nombre: 'Progreso', icono: 'stats-chart-outline' },
  { ruta: '/aire-libre/rutas', nombre: 'Rutas', icono: 'git-branch-outline' },
]

export function BarraPestanas() {
  const aqui = usePathname()
  const insets = useSafeAreaInsets()

  const ir = (ruta: string) => {
    if (ruta === aqui) return
    Haptics.selectionAsync()
    router.replace(ruta as never)
  }

  // Las dos primeras a la izquierda del botón, las dos últimas a la derecha.
  const izq = PESTANAS.slice(0, 2)
  const der = PESTANAS.slice(2)

  return (
    <View style={[b.envoltorio, { bottom: Math.max(11, insets.bottom) }]} pointerEvents="box-none">
      <View style={b.barra}>
        <View style={b.filo} />
        {izq.map(p => <Pestana key={p.ruta} {...p} activa={aqui === p.ruta} onPress={() => ir(p.ruta)} />)}

        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/aire-libre/empezar' as never) }}
          style={({ pressed }) => [b.centro, pressed && { transform: [{ scale: 0.94 }] }]}
        >
          <LinearGradient
            colors={['#FF5A48', RunningColors.signal.base, '#D4102F']}
            locations={[0, 0.52, 1]}
            start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
            style={b.centroFondo}
          />
          <Ionicons name="flash" size={21} color="#fff" />
        </Pressable>

        {der.map(p => <Pestana key={p.ruta} {...p} activa={aqui === p.ruta} onPress={() => ir(p.ruta)} />)}
      </View>
    </View>
  )
}

function Pestana({ nombre, icono, activa, onPress }: {
  nombre: string; icono: Ion; activa: boolean; onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={b.pestana} hitSlop={6}>
      {activa && <View style={b.marca} />}
      <Ionicons name={icono} size={19} color={activa ? '#fff' : 'rgba(255,255,255,0.36)'} />
      <Text style={[b.texto, activa && b.textoActivo]}>{nombre}</Text>
    </Pressable>
  )
}

/** Lo que hay que dejar libre abajo para que la pastilla no tape contenido. */
export const ALTO_BARRA = 82

const b = StyleSheet.create({
  envoltorio: { position: 'absolute', left: 13, right: 13, zIndex: 40 },
  barra: {
    height: 58,
    borderRadius: 29,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    backgroundColor: 'rgba(20,20,27,0.86)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  filo: {
    position: 'absolute', top: 0, left: 24, right: 24, height: 1,
    backgroundColor: 'rgba(255,255,255,0.17)',
  },
  pestana: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  marca: {
    position: 'absolute', top: -1, width: 16, height: 2.5, borderRadius: 2,
    backgroundColor: RunningColors.signal.base,
    shadowColor: RunningColors.signal.base, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
  },
  texto: { fontSize: 8, fontWeight: '700', letterSpacing: 0.3, color: 'rgba(255,255,255,0.36)' },
  textoActivo: { color: '#fff' },
  centro: {
    width: 46, height: 46, borderRadius: 23, marginHorizontal: 4,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    shadowColor: RunningColors.signal.base,
    shadowOpacity: 0.9, shadowRadius: 14, shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  centroFondo: { ...StyleSheet.absoluteFillObject },
})
