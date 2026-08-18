/**
 * LA PIEZA GRANDE DE LA PORTADA
 * ─────────────────────────────
 * Lo que toca hoy, a fotografía completa, con sus ejercicios dentro.
 *
 * ── Por qué la foto y no una tarjeta ────────────────────────────────────────
 * Es lo primero que se ve al abrir Entrena y compite con el resto del día de
 * quien la abre. Una tarjeta gris con texto informa; una fotografía a pantalla
 * completa APETECE, y esa diferencia es la que decide si alguien va al gimnasio
 * un martes por la noche. Todo lo demás de la pantalla puede ser sobrio: esto no.
 *
 * ── La foto la elige el usuario ─────────────────────────────────────────────
 * Hay ocho de marca y la que sale de fábrica depende del programa, pero la
 * decisión final es de quien la mira todos los días. Se guarda en el teléfono
 * por programa: es una preferencia visual, no un dato que deba viajar a ningún
 * sitio ni ocupar una columna.
 *
 * ── «y 4 más» era un callejón ───────────────────────────────────────────────
 * Antes se listaban tres ejercicios y el resto se resumía en un texto gris que
 * no se podía tocar. Quien quería ver el día entero tenía que entrar en otra
 * pantalla para descubrir que ya lo tenía casi todo delante. Ahora es un botón
 * de verdad y la lista CRECE HACIA ARRIBA sobre la foto, sin empujar el botón
 * de empezar fuera de la pantalla.
 *
 * ── Y cada ejercicio lleva al suyo ──────────────────────────────────────────
 * Si tiene foto y nombre, se toca. Antes eran filas muertas.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, {
  FadeIn, FadeInDown, FadeOut, LinearTransition,
  useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { Miniatura } from '@/components/workout/Miniatura'
import { Hoy, prescripcion } from '@/services/programService'
import { useFotoPortada, BotonFoto, SelectorFoto } from '@/components/workout/fotoPortada'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

const T = Typography
const C = Colors

/** Cuántos ejercicios se ven sin desplegar. */
const VISIBLES = 3

interface Props {
  hoy: Hoy
  /** Se llama al tocar «Empezar». */
  onEmpezar: () => void
}

export function HoyGrande({ hoy, onEmpezar }: Props) {
  const d = hoy.dia!
  const p = hoy.programa!

  const [abierto, setAbierto] = useState(false)
  const foto = useFotoPortada(p)
  const fuente = foto.fuente

  const ocultos = Math.max(0, d.ejercicios.length - VISIBLES)
  const lista = abierto ? d.ejercicios : d.ejercicios.slice(0, VISIBLES)

  const abrirEjercicio = (e: typeof d.ejercicios[number], i: number) => {
    void Haptics.selectionAsync()
    const q = new URLSearchParams({
      slug: e.slug ?? '',
      nombre: e.nombre,
      orden: String(i),
      series: String(e.series),
      reps: e.reps ?? '',
      descanso: String(e.descanso),
      carga: e.carga,
      programId: p.id,
      semana: String(d.semana),
      dia: String(d.dia),
      titulo: d.nombre,
      clavePlan: e.clavePlan,
      motivo: e.motivo ?? '',
      ...(e.duracion ? { duracion: String(e.duracion) } : {}),
      ...(e.pesoKg != null ? { peso: String(e.pesoKg) } : {}) })
    router.push(`/workout/exercise/hacer?${q.toString()}`)
  }

  return (
    <View style={s.marco}>
      <Image source={fuente} style={StyleSheet.absoluteFill} contentFit="cover" transition={320} />

      {/**
        * El velo cubre la CAJA ENTERA y acaba en transparente por arriba.
        * Un degradado que se corta antes de su borde dibuja una línea recta, y
        * eso ya costó semanas de encontrar en toda la app.
        */}
      <LinearGradient
        colors={['rgba(5,5,6,0.30)', 'rgba(5,5,6,0.55)', 'rgba(5,5,6,0.93)', 'rgba(5,5,6,0.99)']}
        locations={[0, 0.35, 0.72, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* ── Cambiar la foto ─────────────────────────────────────────────── */}
      <BotonFoto onPress={foto.abrir} />

      <View style={s.dentro}>
        <View style={s.etiqueta}>
          <Text style={s.etiquetaTxt}>
            {d.esDescarga ? 'HOY · SEMANA SUAVE' : 'TE TOCA HOY'}
          </Text>
        </View>

        <View style={{ gap: Spacing[3] }}>
          <View>
            <Text style={s.titulo} numberOfLines={2}>{d.nombre}</Text>
            <Text style={s.sub}>
              {p.nombre} · semana {d.semana} de {p.semanas} · {d.ejercicios.length} ejercicios
            </Text>
          </View>

          {/**
            * La lista crece HACIA ARRIBA.
            *
            * `LinearTransition` mueve lo que ya estaba en vez de saltar, y como
            * la pieza está anclada abajo por el botón, lo que se ve es que los
            * ejercicios nuevos empujan la foto hacia arriba. Si creciera hacia
            * abajo, «Empezar» se saldría de la pantalla justo cuando se abre.
            */}
          <Animated.View style={s.lista} layout={LinearTransition.springify().damping(20)}>
            {lista.map((e, i) => (
              <Animated.View
                key={`${e.slug ?? e.nombre}-${i}`}
                entering={FadeInDown.delay(Math.min(i * 45, 260)).duration(300)}
                exiting={FadeOut.duration(140)}
                layout={LinearTransition.springify().damping(20)}
              >
                <TouchableOpacity
                  style={s.fila}
                  onPress={() => abrirEjercicio(e, i)}
                  activeOpacity={0.75}
                >
                  <Miniatura poster={e.slug ? d.posters[e.slug] : null} tam={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.filaNombre} numberOfLines={1}>{e.nombre}</Text>
                    <Text style={s.filaSub}>
                      {prescripcion(e)}
                      {e.pesoKg != null ? ` · ${e.pesoKg} kg` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.45)" />
                </TouchableOpacity>
              </Animated.View>
            ))}
          </Animated.View>

          {/* ── Desplegar ─────────────────────────────────────────────── */}
          {ocultos > 0 && (
            <TouchableOpacity
              style={s.desplegar}
              onPress={() => { void Haptics.selectionAsync(); setAbierto(v => !v) }}
              activeOpacity={0.8}
            >
              <Flecha abierta={abierto} />
              <Text style={s.desplegarTxt}>
                {abierto ? 'Ver menos' : `Ver los ${d.ejercicios.length} ejercicios`}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.boton} onPress={onEmpezar} activeOpacity={0.9}>
            <Text style={s.botonTxt}>Empezar</Text>
            <View style={s.botonFlecha}>
              <Ionicons name="arrow-forward" size={15} color={C.neon.void} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <SelectorFoto
        abierto={foto.eligiendo}
        actual={foto.elegida}
        onCerrar={foto.cerrar}
        onElegir={id => void foto.elegir(id)}
      />
    </View>
  )
}

/** La flecha del desplegable, que gira en vez de cambiar de icono. */
function Flecha({ abierta }: { abierta: boolean }) {
  const g = useSharedValue(0)
  useEffect(() => { g.value = withSpring(abierta ? 1 : 0, { damping: 15 }) }, [abierta, g])
  const estilo = useAnimatedStyle(() => ({ transform: [{ rotate: `${g.value * 180}deg` }] }))
  return (
    <Animated.View style={estilo}>
      <Ionicons name="chevron-down" size={15} color="#fff" />
    </Animated.View>
  )
}


const s = StyleSheet.create({
  marco: {
    borderRadius: 26, overflow: 'hidden',
    minHeight: 400, justifyContent: 'flex-end',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  dentro: { padding: Spacing[4], gap: Spacing[4] },

  editar: {
    position: 'absolute', top: Spacing[3], right: Spacing[3], zIndex: 3,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },

  etiqueta: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing[3], paddingVertical: 5,
    borderRadius: BorderRadius.full, backgroundColor: C.neon.red },
  etiquetaTxt: { fontSize: 9.5, fontWeight: '800', color: '#fff', letterSpacing: 1.1 },

  titulo: {
    fontSize: T.fontSize['3xl'], fontWeight: '800', color: '#fff',
    letterSpacing: -0.8, lineHeight: 32 },
  sub: { fontSize: T.fontSize.xs, color: 'rgba(255,255,255,0.72)', marginTop: 4 },

  lista: { gap: Spacing[2] },
  fila: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingVertical: 5 },
  filaNombre: { fontSize: T.fontSize.sm, fontWeight: '700', color: '#fff' },
  filaSub: { fontSize: 11, color: 'rgba(255,255,255,0.62)', marginTop: 1 },

  desplegar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  desplegarTxt: { fontSize: T.fontSize.xs, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },

  boton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[3],
    minHeight: 52, borderRadius: BorderRadius.full, backgroundColor: '#fff',
    paddingHorizontal: Spacing[4] },
  botonTxt: { fontSize: T.fontSize.base, fontWeight: '800', color: C.neon.void },
  botonFlecha: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,31,61,0.22)' },

  modalFondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.62)' },
  modal: {
    backgroundColor: '#0d0d0f',
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderTopWidth: 1, borderColor: C.neon.edge,
    padding: Spacing[4], gap: Spacing[3] },
  asa: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: C.neon.w4 },
  modalTitulo: { fontSize: T.fontSize.xl, fontWeight: '800', color: C.neon.white, letterSpacing: -0.4 },
  modalSub: { fontSize: T.fontSize.xs, color: C.neon.w3, marginTop: -6 },

  tiras: { gap: Spacing[2], paddingVertical: Spacing[1] },
  opcionFoto: {
    width: 104, height: 132, borderRadius: 14, overflow: 'hidden',
    justifyContent: 'flex-end', padding: Spacing[2],
    borderWidth: 1.5, borderColor: 'transparent' },
  opcionFotoOn: { borderColor: C.neon.red },
  opcionTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  tic: {
    position: 'absolute', top: 7, right: 7,
    width: 18, height: 18, borderRadius: 9, backgroundColor: C.neon.red,
    alignItems: 'center', justifyContent: 'center' },

  cerrar: {
    minHeight: 46, borderRadius: BorderRadius.xl, backgroundColor: C.neon.pane,
    alignItems: 'center', justifyContent: 'center' },
  cerrarTxt: { fontSize: T.fontSize.sm, fontWeight: '800', color: C.neon.white } })
