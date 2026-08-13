/**
 * FICHA DEL EJERCICIO
 * ───────────────────
 * El vídeo, de qué va el movimiento, qué músculos entran y con qué sustituirlo.
 *
 * ── El vídeo manda ──────────────────────────────────────────────────────────
 * Ocupa la parte de arriba entera y se reproduce en bucle, sin sonido y sin
 * pedir permiso: estos vídeos son de tres segundos y no tienen audio, así que
 * pararlos para que alguien pulse «play» solo añade un paso. Es lo contrario
 * que en el muro, donde un vídeo que arranca solo es una molestia.
 *
 * ── Los sustitutos son la parte útil ────────────────────────────────────────
 * Vienen del servidor por PATRÓN de movimiento, no por músculo: si el banco
 * está ocupado hace falta otro empuje horizontal, y un cruce de poleas no
 * sustituye a un press. Los que se pueden hacer en casa van primero.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  useWindowDimensions,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useVideoPlayer, VideoView } from 'expo-video'
import { volverAEntrena } from '@/components/workout/MenuSeccion'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { Empty, Skeleton } from '@/components/social/Bits'
import * as E from '@/services/exerciseService'
import { errorText } from '@/services/socialService'

// ── Vídeo en bucle ───────────────────────────────────────────────────────────

function Demo({ uri, alto }: { uri: string; alto: number }) {
  const player = useVideoPlayer(uri, p => { p.loop = true; p.muted = true; p.play() })
  useEffect(() => () => { try { player.pause() } catch { /* ya destruido */ } }, [])
  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: alto }}
      contentFit="cover"
      nativeControls={false}
      allowsFullscreen={false}
      allowsPictureInPicture={false}
    />
  )
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

export default function ExerciseScreen() {
  const T = useAppTheme()
  const { width } = useWindowDimensions()
  const { slug } = useLocalSearchParams<{ slug: string }>()

  const [ex, setEx] = useState<E.ExerciseDetail | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!slug) return
    setCargando(true)
    try {
      setEx(await E.getExercise(slug))
      setError(null)
    } catch (e) {
      setError(errorText(e, 'No pudimos cargar este ejercicio'))
    } finally {
      setCargando(false)
    }
  }, [slug])

  useEffect(() => { cargar() }, [cargar])

  const altoVideo = Math.round(width * 0.92)

  if (cargando) {
    return (
      <Screen>
        <Skeleton h={altoVideo} w={'100%'} r={0} />
        <View style={{ padding: 20, gap: 12 }}>
          <Skeleton h={22} w={'70%'} /><Skeleton h={12} w={'40%'} />
          <Skeleton h={60} r={16} />
        </View>
      </Screen>
    )
  }

  if (error || !ex) {
    return (
      <Screen>
        <View style={s.volverSolo}>
          <TouchableOpacity onPress={volverAEntrena} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={T.ink} />
          </TouchableOpacity>
        </View>
        <Empty icon="barbell-outline" title="No encontramos este ejercicio"
          text={error ?? undefined} action="Reintentar" onAction={cargar} />
      </Screen>
    )
  }

  const color = E.colorDe(ex.muscle)

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Vídeo */}
        <View style={{ height: altoVideo, backgroundColor: `${color}14` }}>
          {ex.video
            ? <Demo uri={ex.video} alto={altoVideo} />
            : ex.poster
              ? <Image source={{ uri: ex.poster }} style={{ width: '100%', height: altoVideo }} contentFit="cover" />
              : <View style={s.sinMedio}><Ionicons name="barbell-outline" size={34} color={T.ink3} /></View>}

          <LinearGradient
            colors={['rgba(5,5,7,0.72)', 'transparent']}
            style={s.veloArriba}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(5,5,7,0.92)']}
            style={s.veloAbajo}
            pointerEvents="none"
          />

          <TouchableOpacity style={s.volver} onPress={volverAEntrena} hitSlop={12} activeOpacity={0.75}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={s.tituloSobreVideo}>
            <View style={s.etiquetas}>
              <View style={[s.eti, { backgroundColor: `${color}2E`, borderColor: `${color}55` }]}>
                <View style={[s.punto, { backgroundColor: color }]} />
                <Text style={[s.etiTxt, { color: '#fff' }]}>{ex.muscleEs ?? 'General'}</Text>
              </View>
              <View style={[s.eti, { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name={E.iconoDe(ex.equipment) as any} size={11} color="#fff" />
                <Text style={[s.etiTxt, { color: '#fff' }]}>{ex.equipmentEs}</Text>
              </View>
              {ex.home && (
                <View style={[s.eti, { backgroundColor: 'rgba(34,224,200,0.16)', borderColor: 'rgba(34,224,200,0.36)' }]}>
                  <Ionicons name="home" size={11} color="#22E0C8" />
                  <Text style={[s.etiTxt, { color: '#22E0C8' }]}>Sin gimnasio</Text>
                </View>
              )}
            </View>
            <Text style={s.titulo}>{ex.name}</Text>
          </View>
        </View>

        {/* Dónde se puede hacer */}
        <View style={s.bloque}>
          <View style={[s.aviso, { backgroundColor: T.glass, borderColor: T.glassBorder }]}>
            <Ionicons
              name={ex.home ? 'home-outline' : 'business-outline'}
              size={17}
              color={ex.home ? '#22E0C8' : T.ink3}
            />
            <Text style={[s.avisoTxt, { color: T.ink2 }]}>
              {ex.home
                ? 'Se puede hacer en casa con el material que ya tienes.'
                : `Necesitas ${ex.equipmentEs.toLowerCase()}: es de gimnasio.`}
            </Text>
          </View>
        </View>

        {/* ── Cómo se hace ────────────────────────────────────────────────
            Va ANTES de los sustitutos y justo después del vídeo: quien abre
            una ficha quiere saber cómo se hace, y el vídeo solo lo enseña —no
            dice dónde parar ni qué se suele hacer mal. */}
        {ex.comoSeHace && (
          <>
            <View style={s.cabecera}>
              <Text style={[s.etiqueta, { color: T.ink3 }]}>CÓMO SE HACE</Text>
            </View>
            <View style={s.bloque}>
              <View style={[s.comoWrap, { backgroundColor: T.glass, borderColor: T.glassBorder }]}>
                <Paso
                  icono="body-outline"
                  titulo="Colócate"
                  texto={ex.comoSeHace.colocate}
                  T={T}
                />
                <Paso
                  icono="swap-vertical-outline"
                  titulo="Mueve"
                  texto={ex.comoSeHace.mueve}
                  T={T}
                />
                <Paso
                  icono="resize-outline"
                  titulo="Hasta dónde"
                  texto={ex.comoSeHace.hastaDonde}
                  T={T}
                />
                {/* El error va en rojo y el último: es lo que más se recuerda
                    de una lista, y aquí interesa que se recuerde. */}
                <Paso
                  icono="alert-circle-outline"
                  titulo="Ojo con"
                  texto={ex.comoSeHace.ojoCon}
                  T={T}
                  aviso
                />
              </View>
            </View>
          </>
        )}

        {/* Sustitutos */}
        {ex.alternatives.length > 0 && (
          <>
            <View style={s.cabecera}>
              <Text style={[s.etiqueta, { color: T.ink3 }]}>SI ESTÁ OCUPADO</Text>
              <Text style={[s.pista, { color: T.ink3 }]}>Mismo movimiento, otro material</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.alts}>
              {ex.alternatives.map(a => (
                <TouchableOpacity
                  key={a.slug}
                  style={[s.alt, { backgroundColor: T.glass, borderColor: T.glassBorder }]}
                  onPress={() => router.push(`/workout/exercise/${a.slug}`)}
                  activeOpacity={0.85}
                >
                  <View style={s.altImg}>
                    {a.poster
                      ? <Image source={{ uri: a.poster }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={140} />
                      : <View style={s.sinMedio}><Ionicons name="barbell-outline" size={18} color={T.ink3} /></View>}
                    {a.home && (
                      <View style={s.altCasa}><Ionicons name="home" size={8} color="#fff" /></View>
                    )}
                  </View>
                  <Text style={[s.altNombre, { color: T.ink }]} numberOfLines={2}>{a.name}</Text>
                  <Text style={[s.altMat, { color: T.ink3 }]} numberOfLines={1}>{a.equipmentEs}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Acción */}
        <View style={s.bloque}>
          <TouchableOpacity
            style={[s.principal, { backgroundColor: T.accent, shadowColor: T.accent }]}
            activeOpacity={0.88}
            onPress={() => router.push('/workout')}
          >
            <Ionicons name="add" size={19} color="#fff" />
            <Text style={s.principalTxt}>Añadir a una rutina</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  )
}

/**
 * Un paso de «cómo se hace».
 *
 * Icono, título corto y una frase. Cuatro pasos con la misma forma se leen de
 * un vistazo; un párrafo seguido con la misma información, no.
 */
function Paso({ icono, titulo, texto, T, aviso }: {
  icono: React.ComponentProps<typeof Ionicons>['name']
  titulo: string
  texto: string
  T: { accent: string; ink: string; ink2: string; ink3: string; glass: string }
  aviso?: boolean
}) {
  const color = aviso ? T.accent : T.ink2
  return (
    <View style={s.paso}>
      <View style={[s.pasoIcono, { backgroundColor: aviso ? `${T.accent}1f` : T.glass }]}>
        <Ionicons name={icono} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.pasoTitulo, { color: aviso ? T.accent : T.ink3 }]}>
          {titulo.toUpperCase()}
        </Text>
        <Text style={[s.pasoTxt, { color: T.ink }]}>{texto}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  sinMedio: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  veloArriba: { position: 'absolute', top: 0, left: 0, right: 0, height: 110 },
  veloAbajo: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 180 },
  volver: { position: 'absolute', top: 12, left: 16 },
  volverSolo: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10 },
  tituloSobreVideo: { position: 'absolute', left: 20, right: 20, bottom: 18, gap: 9 },
  etiquetas: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  eti: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1,
  },
  punto: { width: 6, height: 6, borderRadius: 3 },
  etiTxt: { fontSize: 10.5, fontWeight: '700' },
  titulo: { color: '#fff', fontSize: 25, fontWeight: '800', letterSpacing: -0.5, lineHeight: 29 },
  bloque: { paddingHorizontal: 20, paddingTop: 18 },
  aviso: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    padding: 14, borderRadius: 16, borderWidth: 1,
  },
  avisoTxt: { flex: 1, fontSize: 13, lineHeight: 19 },

  comoWrap: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 18 },
  paso: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  pasoIcono: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  pasoTitulo: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginBottom: 3 },
  pasoTxt: { fontSize: 13, lineHeight: 19 },
  cabecera: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    paddingHorizontal: 20, paddingTop: 26, paddingBottom: 10,
  },
  etiqueta: { fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  pista: { fontSize: 11 },
  alts: { paddingHorizontal: 20, gap: 10 },
  alt: { width: 108, borderRadius: 14, borderWidth: 1, overflow: 'hidden', paddingBottom: 9 },
  altImg: { width: '100%', aspectRatio: 1, position: 'relative' },
  altCasa: {
    position: 'absolute', top: 5, right: 5, width: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  altNombre: { fontSize: 11, fontWeight: '700', lineHeight: 14, paddingHorizontal: 8, paddingTop: 7 },
  altMat: { fontSize: 9.5, paddingHorizontal: 8, paddingTop: 2 },
  principal: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: 17,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.38, shadowRadius: 16, elevation: 10,
  },
  principalTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
