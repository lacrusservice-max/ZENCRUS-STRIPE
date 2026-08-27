/**
 * CICLO · ¿CÓMO ESTÁS HOY?
 * ═══════════════════════════════════════════════════════════════════════════
 * La pantalla que aparece una vez al día. Cuatro toques y el motor tiene lo
 * que necesita.
 *
 * ── Por qué pide tan poco ──────────────────────────────────────────────────
 * El registro completo son tres pasos y dieciocho campos, y eso es justo lo
 * que hace que la mayoría no registre nada. Aquí solo van las tres piezas de
 * las que depende todo lo demás: si sangras, tu energía y tu ánimo. El resto
 * está a un botón.
 *
 * ── Se guarda al tocar ─────────────────────────────────────────────────────
 * Igual que el registro largo: si se cierra a la mitad, lo marcado se queda.
 * Esta pantalla se abre a las siete de la mañana con una mano.
 *
 * ── Y solo pregunta lo que falta ───────────────────────────────────────────
 * Si ya registró la energía desde la portada, aquí no vuelve a salir. Repetir
 * una pregunta ya contestada enseña que la app no está mirando.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import { useCicloStore, DIA_VACIO } from '@/store/cicloStore'
import { useCiclo } from '@/features/salud/ciclo/useCiclo'
import { rachaRegistro } from '@/features/salud/ciclo/historial'
import {
  estadoDeHoy, apartarHoy, saludo, porQueImporta, type PiezaEsencial,
} from '@/features/salud/ciclo/checkin'
import { diaLargo } from '@/features/salud/ciclo/formato'
import { hoyLocal } from '@/utils/fechas'
import { Pantalla, Tarjeta, Chip, Intensidad, Icono, BotonPrincipal } from '@/components/salud/ciclo/Claro'
import { Guardado, useGuardadoAlSalir } from '@/components/salud/ciclo/Guardado'
import {
  FONDO, FASE, ACENTO, TEXTO, FUENTE, SUP, HUECO,
} from '@/theme/salud/cicloClaro'
import { elegir, confirmar } from '@/utils/haptica'
import { ANIMOS, animoExacto } from '@/features/salud/ciclo/animos'

/** Los cinco grados del sangrado, con el 0 delante porque es la respuesta común. */
const SANGRADO = [
  { nivel: 0, etiqueta: 'Hoy no' },
  { nivel: 1, etiqueta: 'Manchado' },
  { nivel: 2, etiqueta: 'Ligero' },
  { nivel: 3, etiqueta: 'Moderado' },
  { nivel: 4, etiqueta: 'Abundante' },
  { nivel: 5, etiqueta: 'Muy abundante' },
]


export default function CheckinCiclo() {
  const nombre = useAuthStore(s => (s.user?.full_name ?? '').trim().split(/\s+/)[0] ?? '')
  const registrar = useCicloStore(s => s.registrar)
  const borrarKind = useCicloStore(s => s.borrar)
  const logs = useCicloStore(s => s.logs)
  const hoy = hoyLocal()
  /* Se lee el mapa directamente en vez de `getDia`: un selector debe devolver
     algo con identidad estable, y aquí `undefined` lo es. El `?? DIA_VACIO` va
     FUERA del selector. */
  const dia = useCicloStore(s => s.logs[hoy]) ?? DIA_VACIO
  const { prediccion, estadisticas } = useCiclo()

  /* Lo que faltaba AL ABRIR, congelado. Si se recalculara en cada toque, las
     preguntas irían desapareciendo bajo el dedo según se contestan y la
     pantalla saltaría sola. */
  const [pendientes] = useState<PiezaEsencial[]>(
    () => estadoDeHoy(dia, false).faltan)

  const racha = useMemo(() => rachaRegistro(logs, hoy), [logs, hoy])
  const [hora] = useState(() => new Date().getHours())

  /* Se aparta al ENTRAR, no al salir. Si se hiciera al salir, cerrar la app a
     medias haría que volviera a aparecer al reabrirla — que es exactamente la
     sensación de app que insiste. */
  useEffect(() => { void apartarHoy(hoy) }, [hoy])

  const sangrado = dia.sangrado as { level?: number } | undefined
  const energia = (dia.energia as { level?: number } | undefined)?.level ?? 0
  const animo = dia.animo as { valence?: number; arousal?: number } | undefined
  const animoActivo = animo
    ? animoExacto(animo.valence ?? 0, animo.arousal ?? 0)
    : null

  const contestadas = pendientes.filter(p =>
    p === 'sangrado' ? sangrado != null
      : p === 'energia' ? energia > 0
        : !!animoActivo).length

  const listo = contestadas === pendientes.length

  const irAlCiclo = useCallback(() => router.replace('/salud/ciclo'), [])
  const { marcar, cerrar: acusarYSalir, visible: acuse } = useGuardadoAlSalir(irAlCiclo)

  const guardar = (kind: 'sangrado' | 'energia' | 'animo', value: unknown) => {
    marcar()
    void registrar(kind as never, value as never, hoy)
  }

  const quitar = (kind: 'sangrado' | 'energia' | 'animo') => {
    marcar()
    void borrarKind(kind as never, hoy)
  }

  const salir = () => { confirmar(); acusarYSalir() }

  const tono = prediccion ? FASE[prediccion.fase] : null
  const explicacion = porQueImporta(estadisticas.ciclos)

  return (
    <Pantalla fondo={FONDO.portada} salida={false}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Cabecera ───────────────────────────────────────────────────── */}
        <View style={s.cab}>
          <Text style={s.saludo}>{saludo(hora, racha)}</Text>
          <Text style={s.titulo}>
            {nombre ? `¿Cómo estás hoy, ${nombre}?` : '¿Cómo estás hoy?'}
          </Text>
          <Text style={s.fecha}>
            {diaLargo(hoy)}
            {prediccion && tono ? ` · día ${prediccion.diaDeCiclo}, fase ${tono.etiqueta.toLowerCase()}` : ''}
          </Text>
        </View>

        {/* ── ¿Sangras hoy? ──────────────────────────────────────────────── */}
        {pendientes.includes('sangrado') && (
          <Tarjeta style={s.tarjeta}>
            <Text style={s.pregunta}>¿Sangras hoy?</Text>
            <Text style={s.ayuda}>
              De aquí salen tus fases y tu predicción. «Hoy no» también es una
              respuesta y también cuenta.
            </Text>
            <View style={s.chips}>
              {SANGRADO.map(n => (
                <Chip
                  key={n.nivel}
                  texto={n.etiqueta}
                  activo={sangrado?.level === n.nivel}
                  /* Volver a tocar la respuesta marcada la quita, igual que en
                     el registro largo. Sin esto, «Hoy no» —que solo existe en
                     esta pantalla— era irreversible: una vez tocado, el día
                     quedaba con un sangrado nivel 0 que ninguna pantalla podía
                     borrar, y esa cuenta ya sumaba un día de racha para
                     siempre. Un registro que no se puede deshacer no es un
                     registro, es una trampa. */
                  onPress={() => {
                    if (sangrado?.level === n.nivel) { quitar('sangrado'); return }
                    guardar('sangrado', {
                      level: n.nivel,
                      spotting: n.nivel === 1,
                    })
                  }}
                />
              ))}
            </View>
          </Tarjeta>
        )}

        {/* ── Energía ────────────────────────────────────────────────────── */}
        {pendientes.includes('energia') && (
          <Tarjeta style={s.tarjeta}>
            <Text style={s.pregunta}>¿Con cuánta energía?</Text>
            <Intensidad
              valor={energia}
              onValor={n => n && guardar('energia', { level: n })}
              color={ACENTO.teal}
              izquierda="Poca"
              derecha="Mucha"
            />
          </Tarjeta>
        )}

        {/* ── Ánimo ──────────────────────────────────────────────────────── */}
        {pendientes.includes('animo') && (
          <Tarjeta style={s.tarjeta}>
            <Text style={s.pregunta}>¿Y de ánimo?</Text>
            <View style={s.caras}>
              {ANIMOS.map(a => {
                const on = animoActivo?.id === a.id
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => {
                      elegir()
                      guardar('animo', { valence: a.valence, arousal: a.arousal })
                    }}
                    style={s.cara}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <View style={[s.caraCirculo, on && s.caraCirculoOn]}>
                      <Icono nombre={a.icono} tam={26} style={on ? s.caraIconoOn : undefined} />
                    </View>
                    <Text style={[s.caraTxt, on && s.caraTxtOn]}>{a.etiqueta}</Text>
                  </Pressable>
                )
              })}
            </View>
          </Tarjeta>
        )}

        {/* ── Por qué importa, solo mientras no haya predicción ───────────── */}
        {explicacion ? <Text style={s.porQue}>{explicacion}</Text> : null}
      </ScrollView>

      <View style={s.pie}>
        <BotonPrincipal
          texto={listo ? 'Listo' : 'Guardar y seguir'}
          onPress={salir}
        />
        <View style={s.pieFila}>
          <Pressable onPress={() => { elegir(); router.replace('/salud/ciclo/registrar') }} hitSlop={10}>
            <Text style={s.enlace}>Registrar más cosas</Text>
          </Pressable>
          <Pressable onPress={salir} hitSlop={10}>
            <Text style={s.enlaceSuave}>Ahora no</Text>
          </Pressable>
        </View>
      </View>
      <Guardado visible={acuse} />
    </Pantalla>
  )
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, gap: HUECO.md },

  cab: { gap: 4, marginBottom: 4 },
  saludo: { fontFamily: FUENTE.fuerte, fontSize: 14, color: TEXTO.medio },
  titulo: {
    fontFamily: FUENTE.titulo, fontSize: 29, color: TEXTO.fuerte,
    letterSpacing: -0.8, lineHeight: 34,
  },
  fecha: { fontFamily: FUENTE.cuerpo, fontSize: 13.5, color: TEXTO.medio, marginTop: 2 },

  tarjeta: { gap: 13 },
  pregunta: { fontFamily: FUENTE.titulo, fontSize: 19, color: TEXTO.fuerte },
  ayuda: {
    fontFamily: FUENTE.cuerpo, fontSize: 13, lineHeight: 19,
    color: TEXTO.medio, marginTop: -6,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },

  caras: { flexDirection: 'row', justifyContent: 'space-between' },
  cara: { alignItems: 'center', gap: 7, width: 62 },
  caraCirculo: {
    width: 58, height: 58, borderRadius: 29,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: SUP.bordeChip,
  },
  caraCirculoOn: { backgroundColor: ACENTO.naranja, borderColor: ACENTO.naranja },
  caraIconoOn: { tintColor: '#FFFFFF' },
  caraTxt: { fontFamily: FUENTE.medio, fontSize: 12, color: TEXTO.medio },
  caraTxtOn: { fontFamily: FUENTE.fuerte, color: ACENTO.naranja },

  porQue: {
    fontFamily: FUENTE.cuerpo, fontSize: 13, lineHeight: 19,
    color: TEXTO.medio, paddingHorizontal: 4,
  },

  pie: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8, gap: 12 },
  pieFila: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },
  enlace: { fontFamily: FUENTE.fuerte, fontSize: 13.5, color: ACENTO.morado },
  enlaceSuave: { fontFamily: FUENTE.medio, fontSize: 13.5, color: TEXTO.suave },
})
