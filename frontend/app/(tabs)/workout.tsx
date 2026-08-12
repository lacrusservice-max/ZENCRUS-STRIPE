/**
 * ENTRENA · PORTADA
 * ─────────────────
 * La entrada a la sección de entrenamiento. Contesta tres preguntas y en este
 * orden, que es el orden en que se hacen de verdad:
 *
 *   1 · ¿Tengo algo a medias?      → la sesión abierta, arriba del todo
 *   2 · ¿Qué puedo entrenar hoy?   → el cuerpo, teñido por recuperación
 *   3 · ¿Cómo voy?                 → la semana en cifras
 *
 * ── Lo que se quitó de la versión anterior, y por qué ───────────────────────
 * · Diez tipos de entrenamiento con emoji (🏋️🔥⚔️🏃…). Un emoji no es un icono:
 *   cambia de dibujo en cada sistema, no se puede teñir y en una app de
 *   entrenamiento serio parece una lista de la compra. Ahora hay iconografía
 *   propia, dibujada, que hereda el color del tema.
 * · Listas de nombres de ejercicios ESCRITAS A MANO en el código («Press de
 *   banca», «Sentadilla»…). Existiendo un catálogo de 206 fichas con vídeo,
 *   músculo y material, ofrecer doce nombres sueltos era peor que no ofrecer
 *   nada: no llevaban a ninguna ficha y se quedaban desactualizados solos.
 * · El historial en memoria del teléfono. Ahora viene del servidor, que es
 *   donde de verdad está.
 *
 * ── El menú de la sección ───────────────────────────────────────────────────
 * Entrena tiene cinco sitios y no caben en la barra de abajo, que es de la app
 * entera. El menú propio va aquí arriba y es el índice de la sección: los
 * cinco visibles siempre, sin desplegables.
 */

import { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { BodyMap } from '@/components/workout/BodyMap'
import { Anillo, Cifra, Vacio } from '@/components/workout/Charts'
import { MenuSeccion } from '@/components/workout/MenuSeccion'
import { useSessionStore } from '@/store/sessionStore'
import {
  getResumen, getMusculos, Resumen, Musculos,
  kilosCorto, minutosCorto, desdeCuando,
} from '@/services/statsService'
import { listarSesiones, Sesion } from '@/services/sessionService'
import { NOMBRE_GRUPO, Vista } from '@/components/workout/anatomy'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

/**
 * Objetivo de sesiones por semana.
 *
 * Cuatro. No es una cifra sacada del aire: por debajo de tres la frecuencia por
 * grupo muscular no da para progresar, y por encima de cinco la mayoría no
 * sostiene el ritmo más de un mes. El anillo mide contra esto y no contra un
 * objetivo que el usuario ponga a ojo, que siempre acaba siendo diez.
 */
const OBJETIVO_SEMANA = 4

export default function EntrenaPortada() {
  const { sesion, series, restaurar } = useSessionStore()

  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [musculos, setMusculos] = useState<Musculos | null>(null)
  const [recientes, setRecientes] = useState<Sesion[]>([])
  const [vista, setVista] = useState<Vista>('frente')
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const [r, m, h] = await Promise.all([
        getResumen(28).catch(() => null),
        getMusculos(7).catch(() => null),
        listarSesiones({ limit: 4 }).catch(() => null),
      ])
      setResumen(r)
      setMusculos(m)
      setRecientes(h?.sessions ?? [])
    } finally {
      setCargando(false)
      setRefrescando(false)
    }
  }, [])

  // Al volver a la pestaña, no solo al montar: se entra aquí justo después de
  // cerrar un entrenamiento y los números tienen que estar ya actualizados.
  useFocusEffect(useCallback(() => {
    void restaurar()
    void cargar()
  }, [restaurar, cargar]))

  /**
   * Lo que está listo para entrenar hoy.
   *
   * Se ordena por recuperación y se queda con los tres primeros. Los que nunca
   * se han entrenado van al principio: un grupo sin datos no es que esté
   * fresco, es que lleva sin tocarse desde siempre, y eso es lo más urgente.
   */
  const listos = (musculos?.grupos ?? [])
    .filter(g => g.grupo !== 'fullbody')
    .sort((a, b) => {
      if (a.recuperacion === null && b.recuperacion === null) return 0
      if (a.recuperacion === null) return -1
      if (b.recuperacion === null) return 1
      return b.recuperacion - a.recuperacion
    })
    .slice(0, 3)

  const sesionesSemana = resumen?.sesionesSemana ?? 0

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Zencrus"
        title="Entrena"
        subtitle={new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
        icon="barbell"
      />

      <MenuSeccion activo="hoy" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing[4], paddingBottom: 110, gap: Spacing[4] }}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => { setRefrescando(true); void cargar() }}
            tintColor={Colors.neon.w3}
          />
        }
      >
        {/* ── Sesión a medias ──────────────────────────────────────────── */}
        {sesion && (
          <Animated.View entering={FadeInDown.duration(360)}>
            <TouchableOpacity
              style={s.enCurso}
              onPress={() => router.push('/workout/active')}
              activeOpacity={0.88}
            >
              <View style={s.enCursoPunto} />
              <View style={{ flex: 1 }}>
                <Text style={s.enCursoTitulo}>{sesion.title}</Text>
                <Text style={s.enCursoSub}>
                  {series.length} {series.length === 1 ? 'serie registrada' : 'series registradas'} · sigue abierto
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={Colors.neon.white} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Empezar ──────────────────────────────────────────────────── */}
        {!sesion && (
          <Animated.View entering={FadeInDown.duration(360)}>
            <TouchableOpacity
              style={s.empezar}
              onPress={() => router.push('/workout/active')}
              activeOpacity={0.88}
            >
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={s.empezarTxt}>Empezar a entrenar</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {cargando ? (
          <View style={s.cargando}><ActivityIndicator color={Colors.neon.w3} /></View>
        ) : (
          <>
            {/* ── La semana ────────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(60).duration(360)} style={s.tarjeta}>
              <View style={s.semanaFila}>
                <Anillo pct={sesionesSemana / OBJETIVO_SEMANA} tam={92} grosor={8}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={s.anilloNum}>{sesionesSemana}</Text>
                    <Text style={s.anilloDe}>de {OBJETIVO_SEMANA}</Text>
                  </View>
                </Anillo>

                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={s.semanaTitulo}>Últimos 7 días</Text>
                  <Text style={s.semanaFrase}>
                    {sesionesSemana === 0 ? 'Todavía sin entrenar esta semana.'
                      : sesionesSemana >= OBJETIVO_SEMANA ? 'Semana completa. Así se construye.'
                      : `Te faltan ${OBJETIVO_SEMANA - sesionesSemana} para cerrar la semana.`}
                  </Text>
                  {(resumen?.racha ?? 0) > 1 && (
                    <Text style={s.racha}>{resumen!.racha} días seguidos</Text>
                  )}
                </View>
              </View>

              <View style={s.cifras}>
                <Cifra valor={String(resumen?.seriesSemana ?? 0)} etiqueta="SERIES" />
                <Cifra valor={kilosCorto(resumen?.volumenSemana ?? 0)} etiqueta="MOVIDOS" />
                <Cifra valor={minutosCorto(resumen?.minutosSemana ?? 0)} etiqueta="TIEMPO" />
              </View>
            </Animated.View>

            {/* ── Qué está listo ───────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(120).duration(360)} style={s.tarjeta}>
              <View style={s.tituloFila}>
                <Text style={s.tarjetaTitulo}>Qué está listo hoy</Text>
                <TouchableOpacity onPress={() => router.push('/workout/cuerpo')} hitSlop={8}>
                  <Text style={s.enlace}>Ver el cuerpo</Text>
                </TouchableOpacity>
              </View>

              {(musculos?.totalSeries ?? 0) === 0 ? (
                <Vacio texto="Cuando registres tu primera sesión, aquí verás qué grupos tienes descansados y cuáles todavía no." />
              ) : (
                <View style={s.listos}>
                  {listos.map(g => (
                    <View key={g.grupo} style={s.listoItem}>
                      <View style={[s.listoPunto, {
                        backgroundColor: g.recuperacion === null ? Colors.neon.w4
                          : g.recuperacion >= 1 ? Colors.neon.white
                          : g.recuperacion >= 0.6 ? Colors.neon.steelSoft
                          : Colors.neon.red,
                      }]} />
                      <Text style={s.listoNombre}>{NOMBRE_GRUPO[g.grupo] ?? g.grupo}</Text>
                      <Text style={s.listoCuando}>
                        {g.ultimaVez === null ? 'sin registrar' : desdeCuando(g.ultimaVez)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity onPress={() => router.push('/workout/cuerpo')} activeOpacity={0.9}>
                <BodyMap
                  grupos={musculos?.grupos ?? []}
                  vista={vista}
                  lectura="frescura"
                  onVista={setVista}
                  ancho={190}
                />
              </TouchableOpacity>
            </Animated.View>

            {/* ── Últimos entrenamientos ───────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(180).duration(360)} style={s.tarjeta}>
              <View style={s.tituloFila}>
                <Text style={s.tarjetaTitulo}>Últimos entrenamientos</Text>
                {recientes.length > 0 && (
                  <TouchableOpacity onPress={() => router.push('/workout/history')} hitSlop={8}>
                    <Text style={s.enlace}>Ver todos</Text>
                  </TouchableOpacity>
                )}
              </View>

              {recientes.length === 0 ? (
                <Vacio texto="Ninguno todavía. El primero se registra empezando arriba." />
              ) : (
                recientes.map(x => <FilaSesion key={x.id} sesion={x} />)
              )}
            </Animated.View>

            {/* ── Rutinas ──────────────────────────────────────────────── */}
            <TouchableOpacity
              style={s.accesoRutinas}
              onPress={() => router.push('/workout/routines')}
              activeOpacity={0.85}
            >
              <Ionicons name="list-outline" size={18} color={Colors.neon.w2} />
              <View style={{ flex: 1 }}>
                <Text style={s.accesoTitulo}>Mis rutinas</Text>
                <Text style={s.accesoSub}>Guarda una sesión que repitas y empiézala de un toque</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.neon.w3} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

// ── Piezas ───────────────────────────────────────────────────────────────────

const ICONO_MODO: Record<string, keyof typeof Ionicons.glyphMap> = {
  gym: 'barbell-outline', home: 'home-outline',
  outdoor: 'trail-sign-outline', class: 'play-circle-outline',
}

function FilaSesion({ sesion }: { sesion: Sesion }) {
  const min = Math.round((sesion.duration_seconds ?? 0) / 60)
  return (
    <TouchableOpacity
      style={s.filaSesion}
      onPress={() => router.push(`/workout/session/${sesion.id}`)}
      activeOpacity={0.8}
    >
      <View style={s.filaIcono}>
        <Ionicons name={ICONO_MODO[sesion.mode] ?? 'barbell-outline'} size={16} color={Colors.neon.w2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.filaTitulo} numberOfLines={1}>{sesion.title}</Text>
        <Text style={s.filaSub}>
          {desdeCuando(sesion.started_at)}
          {sesion.total_sets > 0 ? ` · ${sesion.total_sets} series` : ''}
          {min > 0 ? ` · ${min} min` : ''}
        </Text>
      </View>
      {Number(sesion.total_volume_kg) > 0 && (
        <Text style={s.filaVolumen}>{kilosCorto(Number(sesion.total_volume_kg))}</Text>
      )}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  cargando: { paddingVertical: Spacing[8], alignItems: 'center' },

  tarjeta: {
    gap: Spacing[4], padding: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: 22,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  tituloFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tarjetaTitulo: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white },
  enlace: { fontSize: 12, fontWeight: '700', color: Colors.neon.red },

  empezar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[2],
    backgroundColor: Colors.neon.red,
    borderRadius: BorderRadius.lg, paddingVertical: Spacing[4],
  },
  empezarTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },

  enCurso: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[4],
    backgroundColor: Colors.neon.redDim,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.38)',
  },
  enCursoPunto: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.neon.red },
  enCursoTitulo: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white },
  enCursoSub: { fontSize: 12, color: Colors.neon.redCore, marginTop: 1 },

  semanaFila: { flexDirection: 'row', alignItems: 'center', gap: Spacing[4] },
  anilloNum: { fontSize: 26, fontWeight: '800', color: Colors.neon.white, letterSpacing: -1 },
  anilloDe: { fontSize: 10, fontWeight: '700', color: Colors.neon.w3, marginTop: -2 },
  semanaTitulo: { fontSize: 10, fontWeight: '700', color: Colors.neon.w3, letterSpacing: 1.4 },
  semanaFrase: { fontSize: Typography.fontSize.sm, color: Colors.neon.white, fontWeight: '600', lineHeight: 19 },
  racha: { fontSize: 11, fontWeight: '700', color: Colors.neon.red, marginTop: 2 },
  cifras: { flexDirection: 'row', gap: Spacing[2] },

  listos: { gap: Spacing[2] },
  listoItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  listoPunto: { width: 8, height: 8, borderRadius: 4 },
  listoNombre: { flex: 1, fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  listoCuando: { fontSize: 11, color: Colors.neon.w3 },

  filaSesion: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingVertical: Spacing[3],
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.055)',
  },
  filaIcono: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  filaTitulo: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  filaSub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },
  filaVolumen: { fontSize: 12, fontWeight: '800', color: Colors.neon.w2 },

  accesoRutinas: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  accesoTitulo: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  accesoSub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },
})
