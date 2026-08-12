/**
 * HISTORIAL
 * ─────────
 * Todo lo entrenado, del servidor. No del teléfono: el historial sobrevive a
 * cambiar de móvil, que es justo lo que no hacía la versión anterior.
 *
 * ── Se pagina ───────────────────────────────────────────────────────────────
 * Veinte de golpe y más al llegar abajo. Un año de entrenamiento son
 * doscientas sesiones y traerlas todas para enseñar las cinco primeras es
 * gastar la conexión de alguien en datos que no va a mirar.
 */

import { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Screen } from '@/components/ui/Screen'
import { CabeceraSeccion } from '@/components/workout/MenuSeccion'
import { Vacio } from '@/components/workout/Charts'
import { listarSesiones, Sesion, Modo } from '@/services/sessionService'
import { kilosCorto, desdeCuando } from '@/services/statsService'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

const PAGINA = 20

const MODOS: { id: Modo | null; label: string; icono: keyof typeof Ionicons.glyphMap }[] = [
  { id: null, label: 'Todo', icono: 'apps-outline' },
  { id: 'gym', label: 'Gimnasio', icono: 'barbell-outline' },
  { id: 'home', label: 'En casa', icono: 'home-outline' },
  { id: 'outdoor', label: 'Aire libre', icono: 'trail-sign-outline' },
  { id: 'class', label: 'Clases', icono: 'play-circle-outline' },
]

export default function Historial() {
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [total, setTotal] = useState(0)
  const [modo, setModo] = useState<Modo | null>(null)
  const [cargando, setCargando] = useState(true)
  const [trayendo, setTrayendo] = useState(false)
  const [refrescando, setRefrescando] = useState(false)

  const cargar = useCallback(async (m: Modo | null, offset: number) => {
    try {
      const r = await listarSesiones({ mode: m ?? undefined, limit: PAGINA, offset })
      setTotal(r.total)
      setSesiones(prev => offset === 0 ? r.sessions : [...prev, ...r.sessions])
    } catch {
      if (offset === 0) setSesiones([])
    } finally {
      setCargando(false)
      setTrayendo(false)
      setRefrescando(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { void cargar(modo, 0) }, [cargar, modo]))

  const masAbajo = () => {
    if (trayendo || sesiones.length >= total) return
    setTrayendo(true)
    void cargar(modo, sesiones.length)
  }

  return (
    <Screen>
      <CabeceraSeccion
        titulo="Historial"
        subtitulo={total > 0 ? `${total} ${total === 1 ? 'entrenamiento' : 'entrenamientos'}` : undefined}
      />

      <View style={s.filtros}>
        {MODOS.map(m => (
          <TouchableOpacity
            key={m.label}
            style={[s.filtro, modo === m.id && s.filtroOn]}
            onPress={() => { void Haptics.selectionAsync(); setModo(m.id); setCargando(true) }}
            activeOpacity={0.85}
          >
            <Ionicons name={m.icono} size={13} color={modo === m.id ? Colors.neon.white : Colors.neon.w3} />
            <Text style={[s.filtroTxt, modo === m.id && s.filtroTxtOn]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {cargando ? (
        <View style={s.cargando}><ActivityIndicator color={Colors.neon.w3} /></View>
      ) : (
        <FlatList
          data={sesiones}
          keyExtractor={x => x.id}
          contentContainerStyle={{ padding: Spacing[4], paddingBottom: 110, gap: Spacing[2] }}
          onEndReached={masAbajo}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl refreshing={refrescando}
              onRefresh={() => { setRefrescando(true); void cargar(modo, 0) }}
              tintColor={Colors.neon.w3} />
          }
          ListEmptyComponent={
            <Vacio texto={modo
              ? 'Nada de este tipo todavía.'
              : 'Sin entrenamientos registrados. El primero empieza en la portada de Entrena.'} />
          }
          ListFooterComponent={
            trayendo ? <ActivityIndicator style={{ marginVertical: Spacing[4] }} size="small" color={Colors.neon.w3} /> : null
          }
          renderItem={({ item }) => <Tarjeta sesion={item} />}
        />
      )}
    </Screen>
  )
}

const ICONO: Record<string, keyof typeof Ionicons.glyphMap> = {
  gym: 'barbell-outline', home: 'home-outline',
  outdoor: 'trail-sign-outline', class: 'play-circle-outline',
}

function Tarjeta({ sesion }: { sesion: Sesion }) {
  const min = Math.round((sesion.duration_seconds ?? 0) / 60)
  const fecha = new Date(sesion.started_at)

  return (
    <TouchableOpacity
      style={s.tarjeta}
      onPress={() => router.push(`/workout/session/${sesion.id}`)}
      activeOpacity={0.85}
    >
      <View style={s.icono}>
        <Ionicons name={ICONO[sesion.mode] ?? 'barbell-outline'} size={17} color={Colors.neon.w2} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={s.titulo} numberOfLines={1}>{sesion.title}</Text>
        <Text style={s.sub}>
          {fecha.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
          {' · '}{desdeCuando(sesion.started_at)}
        </Text>

        <View style={s.datos}>
          {sesion.total_sets > 0 && <Dato texto={`${sesion.total_sets} ${sesion.total_sets === 1 ? 'serie' : 'series'}`} />}
          {min > 0 && <Dato texto={`${min} min`} />}
          {Number(sesion.total_volume_kg) > 0 && <Dato texto={kilosCorto(Number(sesion.total_volume_kg))} />}
          {sesion.distance_m ? <Dato texto={`${(sesion.distance_m / 1000).toFixed(1).replace('.', ',')} km`} /> : null}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={Colors.neon.w4} />
    </TouchableOpacity>
  )
}

const Dato = ({ texto }: { texto: string }) => (
  <View style={s.dato}><Text style={s.datoTxt}>{texto}</Text></View>
)

const s = StyleSheet.create({
  filtros: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2],
    paddingHorizontal: Spacing[4], paddingBottom: Spacing[3],
  },
  filtro: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing[3], paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.neon.edge,
    backgroundColor: Colors.neon.pane,
  },
  filtroOn: { borderColor: 'rgba(255,31,61,0.45)', backgroundColor: Colors.neon.redDim },
  filtroTxt: { fontSize: 11, fontWeight: '700', color: Colors.neon.w3 },
  filtroTxtOn: { color: Colors.neon.white },

  cargando: { paddingVertical: Spacing[8], alignItems: 'center' },

  tarjeta: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  icono: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  titulo: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: Colors.neon.white },
  sub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },
  datos: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  dato: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  datoTxt: { fontSize: 10, fontWeight: '700', color: Colors.neon.w2 },
})
