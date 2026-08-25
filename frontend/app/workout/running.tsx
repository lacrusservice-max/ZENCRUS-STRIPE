/**
 * ENTRENA · RUNNING
 * ═════════════════
 * La tercera portada de lugar, con la MISMA carcasa que Gimnasio y En casa:
 * la cabecera con su flecha y su acceso al historial, el menú de la sección,
 * el mismo marco para la pieza grande, el mismo anillo de la semana, las mismas
 * cifras y las mismas filas de material.
 *
 * ── Por qué NO es un `<PortadaEntreno modo="outdoor" />` ────────────────────
 * Gimnasio y casa son la misma pantalla con un parámetro porque comparten el
 * motor entero: los mismos ejercicios, los mismos programas, los mismos
 * récords. Un gimnasio y un salón se diferencian en el material, y el material
 * es una bandera del catálogo.
 *
 * Correr no es eso. Se comprobó antes de escribir esto, y son cuatro huecos
 * reales, no pereza:
 *
 *   · El catálogo NO tiene bandera de exterior: sus fichas solo llevan `home` y
 *     `gym`. El generador (`generador.ts`) solo sabe filtrar por esas dos, así
 *     que un entrenamiento «al aire libre» generado saldría con prensa y polea.
 *   · No hay ni un programa `outdoor` en el catálogo de arranque: «Elegir mi
 *     plan» llevaría a una lista vacía.
 *   · Correr no se mide en series y repeticiones, sino en distancia, ritmo y
 *     desnivel. El plan → día → ejercicios → series no tiene equivalente.
 *   · La captura por GPS todavía no está escrita (ver abajo).
 *
 * Forzar el parámetro habría dado una portada que dice «monta tu semana» para
 * siempre y ofrece carreras con máquinas. Comparten TODO lo que se puede
 * compartir —la carcasa y las piezas— y difieren en lo único que de verdad
 * difiere: qué se mide.
 *
 * ── El botón no miente ──────────────────────────────────────────────────────
 * `expo-location` y `expo-task-manager` están instalados, los permisos de
 * ubicación y de segundo plano declarados, y los módulos nativos enlazados en
 * el build de iOS. Lo que falta es la captura misma: ni un `defineTask`, ni un
 * `startLocationUpdatesAsync`. Así que el botón dice lo que hay.
 *
 * Un «Empezar carrera» que no grabara nada sería peor que no tenerlo: la
 * promesa se cobra la primera vez que alguien sale a la calle confiando en ella
 * y vuelve sin su recorrido.
 */

import { useEffect, useCallback, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Image } from '@/components/ui/Imagen'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { volverA } from '@/components/workout/MenuSeccion'
import { Acceso, Velo, ESTILOS_PORTADA as P } from '@/components/workout/PortadaEntreno'
import { AnilloSemana } from '@/components/workout/AnilloSemana'
import { Cifra } from '@/components/workout/Charts'
import { useHealthTrackerStore } from '@/store/healthTrackerStore'
import { aFechaLocal } from '@/utils/fechas'
import { FOTOS } from '@/constants/imagenes'
import { Filo } from '@/components/running/Filo'
import { Colors, Spacing, BorderRadius } from '@/constants/theme'

/**
 * Cabecera PROPIA, no la de las portadas de fuerza.
 *
 * Running es un sistema aparte y su cabecera lo dice: sin el menú de sección
 * —que llevaba a Descubre, Progreso y Récords, pantallas de fuerza compartidas—
 * y con la unidad que aquí manda, que son kilómetros y no series.
 */
function CabeceraRunning() {
  return (
    <View style={s.cab}>
      <TouchableOpacity
        style={s.cabAtras}
        onPress={volverA('/(tabs)/workout')}
        activeOpacity={0.7}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Volver a Entrena"
      >
        <Ionicons name="chevron-back" size={24} color={Colors.neon.w2} />
      </TouchableOpacity>

      <View style={{ flex: 1 }}>
        <Text style={s.cabEyebrow}>ZENCRUS · CORRER</Text>
        <Text style={s.cabTitulo}>Running</Text>
      </View>
    </View>
  )
}

export default function Running() {
  const { load, getTodayProgress, getWeeklySummary, stepGoal } = useHealthTrackerStore()

  useEffect(() => { void load() }, [load])
  useFocusEffect(useCallback(() => { void load() }, [load]))

  const hoy = getTodayProgress()
  const semana = getWeeklySummary()

  /**
   * LA SEMANA NATURAL, DE LUNES A DOMINGO — no los últimos siete días.
   *
   * `AnilloSemana` coloca los días en posiciones FIJAS (`['L','M','X','J','V',
   * 'S','D']`), así que hay que darle la semana del calendario. Pasarle la
   * ventana móvil de siete días que devuelve `getWeeklySummary` pintaba el
   * sábado y el domingo de la semana PASADA en los huecos de esta: días que
   * todavía no han llegado apareciendo como hechos.
   *
   * Por eso se recorta desde el lunes: los totales cuentan lo mismo que el
   * anillo, y no una cosa cada uno.
   */
  const { diasConPasos, hoyIdx, hechos, pasosSemana, kmSemana, kcalSemana } = useMemo(() => {
    const ahora = new Date()
    const idxHoy = (ahora.getDay() + 6) % 7            // 0 = lunes
    const lunes = aFechaLocal(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - idxHoy))

    const dias = Array.from({ length: 7 }, () => false)
    let pasos = 0, km = 0, kcal = 0

    for (const d of semana) {
      if (!d.date || d.date < lunes) continue        // cadenas YYYY-MM-DD: se comparan directas
      const i = Math.round((Date.parse(`${d.date}T00:00:00`) - Date.parse(`${lunes}T00:00:00`)) / 86_400_000)
      if (i < 0 || i > 6) continue
      if ((d.steps ?? 0) > 0) dias[i] = true
      pasos += d.steps ?? 0
      km += d.distanceKm ?? 0
      kcal += d.caloriesBurned ?? 0
    }

    return {
      diasConPasos: dias,
      hoyIdx: idxHoy,
      hechos: dias.filter(Boolean).length,
      pasosSemana: pasos,
      kmSemana: km,
      kcalSemana: kcal,
    }
  }, [semana])

  const avisoCaptura = () => {
    Alert.alert(
      'Todavía no puedo grabar',
      'La captura por GPS está preparada en la app —los permisos de ubicación y de movimiento ya están, y el build nativo trae los módulos— pero falta conectar el sensor. En cuanto esté, este botón empieza a grabar de verdad.',
      [{ text: 'Entendido' }],
    )
  }

  return (
    <Screen>
      <CabeceraRunning />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ── 1 · QUÉ HAGO HOY ─────────────────────────────────────────── */}
        <Animated.View entering={FadeIn.duration(420)} style={s.zonaHero}>
          <View style={P.marco}>
            <Image
              source={FOTOS.aireLibre.fuente}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={280}
            />
            <Velo />

            <View style={s.dentro}>
              <View style={s.etiqueta}>
                <Text style={s.etiquetaTxt}>HOY</Text>
              </View>

              <View style={{ gap: Spacing[3] }}>
                <View>
                  <Text style={s.lb}>PASOS DE HOY</Text>
                  <View style={s.filaBase}>
                    {/* FILO en vez de la fuente del sistema: un dato medido se
                        mira medio segundo, no se lee. Sin separador de miles —
                        la numeración trazada no tiene coma y meterla como texto
                        rompería la línea de base. */}
                    {hoy.registrado
                      ? <Filo alto={46} color={Colors.neon.white}>{String(hoy.steps)}</Filo>
                      : <Text style={[s.cifra, s.cifraVacia]}>—</Text>}
                    <Text style={s.meta}>de {stepGoal.toLocaleString('es-MX')}</Text>
                  </View>
                  <Text style={s.sub}>
                    {hoy.registrado
                      ? `${hoy.km} km · ${hoy.calories} kcal · ${hoy.activeMin} min activo`
                      : 'Nadie está contando tus pasos todavía. Apúntalos desde Salud.'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={s.go}
                  activeOpacity={0.88}
                  onPress={() => { void Haptics.selectionAsync(); avisoCaptura() }}
                  accessibilityRole="button"
                  accessibilityLabel="Empezar carrera. La grabación por GPS todavía no está conectada."
                >
                  <Text style={s.goTxt}>Empezar carrera</Text>
                  <View style={s.goIcono}>
                    <Ionicons name="play" size={16} color={Colors.neon.void} />
                  </View>
                </TouchableOpacity>

                <Text style={s.pie}>La grabación por GPS llega en la siguiente entrega.</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── 2 · CÓMO VA LA SEMANA ────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(120).duration(380)} style={P.bloque}>
          <AnilloSemana
            dias={diasConPasos}
            hoy={hoyIdx}
            hechos={hechos}
            objetivo={7}
            origen="defecto"
            kcal={kcalSemana}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(380)} style={P.bloque}>
          <View style={s.cifras}>
            <Cifra valor={pasosSemana.toLocaleString('es-MX')} etiqueta="PASOS" />
            <Cifra valor={kmSemana > 0 ? kmSemana.toFixed(1) : '0'} etiqueta="KM" />
            <Cifra valor={kcalSemana.toLocaleString('es-MX')} etiqueta="KCAL" />
          </View>
        </Animated.View>

        {/* ── 3 · TUS CARRERAS ─────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(170).duration(380)} style={P.bloque}>
          <Text style={P.seccion}>TUS CARRERAS</Text>
          {/* El hueco ES la información: decir qué aparecerá aquí y cuándo vale
              más que una tarjeta vacía sin explicación. */}
          <View style={s.vacio}>
            <Ionicons name="navigate-outline" size={22} color={Colors.neon.w3} />
            <Text style={s.vacioTit}>Ninguna todavía</Text>
            <Text style={s.vacioTxt}>
              Cuando la grabación esté conectada, aquí aparecerán con su recorrido,
              sus parciales por kilómetro y tus récords.
            </Text>
          </View>
        </Animated.View>

        {/* ── 4 · TODO LO DEMÁS, A LA VISTA ────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(190).duration(380)} style={[P.bloque, { gap: Spacing[2] }]}>
          <Text style={P.seccion}>TU MATERIAL</Text>

          <Acceso
            icono="time-outline"
            titulo="Lo que ya has salido a hacer"
            sub="Tu historial, filtrado por aire libre"
            onPress={() => router.push('/workout/history?mode=outdoor')}
          />
          <Acceso
            icono="bookmark-outline"
            titulo="Mis rutinas de aire libre"
            sub="Sesiones que repites, listas de un toque"
            onPress={() => router.push('/workout/routines?mode=outdoor')}
          />
        </Animated.View>
      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  cab: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: Spacing[4], paddingTop: Spacing[2], paddingBottom: Spacing[3],
  },
  cabAtras: { marginLeft: -6, marginRight: 2, paddingTop: 1 },
  cabEyebrow: { fontSize: 10, fontWeight: '800', color: Colors.neon.red, letterSpacing: 2 },
  cabTitulo: { fontSize: 30, fontWeight: '800', color: Colors.neon.white, letterSpacing: -0.8, marginTop: 2 },

  zonaHero: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[4] },
  dentro: { flex: 1, justifyContent: 'space-between', padding: Spacing[4] },

  etiqueta: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing[3], paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.neon.red,
  },
  etiquetaTxt: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 1.2 },

  lb: { fontSize: 9, fontWeight: '900', color: Colors.neon.redSoft, letterSpacing: 2.2 },
  filaBase: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing[2], marginTop: Spacing[2] },
  cifra: { fontSize: 46, lineHeight: 48, fontWeight: '800', color: Colors.neon.white, letterSpacing: -1.4 },
  cifraVacia: { fontSize: 34, color: Colors.neon.w3 },
  meta: { fontSize: 12.5, color: Colors.neon.w2 },
  sub: { fontSize: 12, color: Colors.neon.w2, marginTop: 5 },

  go: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[3],
    height: 56, borderRadius: 28, backgroundColor: Colors.neon.white,
  },
  goTxt: { fontSize: 17, fontWeight: '800', color: Colors.neon.void, letterSpacing: -0.3 },
  goIcono: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.neon.redCore,
  },
  pie: { fontSize: 10.5, color: Colors.neon.w3, textAlign: 'center' },


  cifras: {
    flexDirection: 'row',
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
    padding: Spacing[2], gap: Spacing[2],
  },

  vacio: {
    alignItems: 'center', gap: Spacing[2],
    paddingVertical: Spacing[6], paddingHorizontal: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  vacioTit: { fontSize: 15, fontWeight: '800', color: Colors.neon.white },
  vacioTxt: { fontSize: 12, color: Colors.neon.w3, textAlign: 'center', lineHeight: 17 },
})
