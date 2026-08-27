/**
 * AL AIRE LIBRE · SESIONES GUIADAS
 * ════════════════════════════════
 * La biblioteca de sesiones y el reloj que las lleva.
 *
 * ── LA VOZ NO SUENA, Y NO FINJO QUE SUENE ───────────────────────────────────
 * Una sesión guiada de verdad te habla al oído para que no mires el teléfono.
 * La app no tiene `expo-speech` ni `expo-av`: son dependencias nativas y
 * añadirlas obliga a recompilar el dev build. Hasta entonces esta pantalla
 * guía con lo que SÍ funciona hoy: cuenta atrás grande, cambio de color al
 * cambiar de bloque y un golpe de vibración en cada transición —tres golpes
 * al entrar en un bloque fuerte, uno al volver a suave—.
 *
 * Se dice en pantalla, arriba y una vez. Poner «avisos de voz» en una lista de
 * características que no habla es la clase de mentira pequeña que hace que
 * alguien salga a la calle contando con ella.
 *
 * ── El reloj corre aunque no haya GPS ───────────────────────────────────────
 * Una sesión de series es tiempo, no distancia: se puede hacer en una cinta o
 * dando vueltas a una pista sin cobertura. Por eso el cronómetro es propio y
 * no depende de que lleguen puntos.
 */

import { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useKeepAwake } from 'expo-keep-awake'
import { RunningColors, OutdoorZones } from '@/constants/running-tokens'
import { Tarjeta, Aura, Etiqueta, Divisor, Chip, Boton } from '@/components/outdoor/Material'
import { Cifra, Metrica, FilaMetricas } from '@/components/outdoor/Cifra'
import { Cabecera } from '@/components/outdoor/Cabecera'
import { SESIONES, ETIQUETA_BLOQUE, duracionSesion, buscarSesion, Sesion, TipoBloque } from '@/constants/outdoor-planes'
import { mmss, hhmmss } from '@/store/outdoorStore'

/** Color de cada bloque: reutiliza la escala de esfuerzo, no inventa otra. */
const COLOR: Record<TipoBloque, string> = {
  calentar: OutdoorZones[1].color,
  suave: OutdoorZones[2].color,
  fuerte: OutdoorZones[4].color,
  andar: OutdoorZones[0].color,
  enfriar: OutdoorZones[1].color,
  descanso: OutdoorZones[0].color,
}

export default function Sesiones() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const { width, height } = useWindowDimensions()
  const [abierta, setAbierta] = useState<Sesion | null>(buscarSesion(id))

  return abierta
    ? <EnSesion sesion={abierta} onSalir={() => setAbierta(null)} ancho={width} alto={height} />
    : <Biblioteca onElegir={setAbierta} ancho={width} alto={height} />
}

// ── La biblioteca ────────────────────────────────────────────────────────────

function Biblioteca({ onElegir, ancho, alto }: {
  onElegir: (s: Sesion) => void; ancho: number; alto: number
}) {
  const [familia, setFamilia] = useState<string | null>(null)
  const familias = [...new Set(SESIONES.map(s => s.familia))]
  const lista = familia ? SESIONES.filter(s => s.familia === familia) : SESIONES

  return (
    <View style={s.raiz}>
      <Aura ancho={ancho} alto={alto} />
      <Cabecera titulo="Sesiones" sub={`${SESIONES.length} guiadas`} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 26 }}>
        <Tarjeta style={{ marginBottom: 12 }}>
          <Text style={s.avisoVoz}>
            <Text style={s.fuerte}>Todavía no te hablan al oído.</Text> Guían con cuenta atrás en
            pantalla y vibración en cada cambio de bloque. La voz necesita una dependencia nativa
            que la app aún no lleva.
          </Text>
        </Tarjeta>

        <View style={s.chips}>
          <Pressable onPress={() => { Haptics.selectionAsync(); setFamilia(null) }}>
            <Chip activo={familia === null}>Todas</Chip>
          </Pressable>
          {familias.map(f => (
            <Pressable key={f} onPress={() => { Haptics.selectionAsync(); setFamilia(f === familia ? null : f) }}>
              <Chip activo={familia === f}>{f}</Chip>
            </Pressable>
          ))}
        </View>

        {lista.map(ses => (
          <Pressable key={ses.id} onPress={() => onElegir(ses)} style={({ pressed }) => [{ marginBottom: 9 }, pressed && { opacity: 0.82 }]}>
            <Tarjeta>
              <View style={s.ct}>
                <Text style={s.nombre}>{ses.nombre}</Text>
                <Chip>{Math.round(duracionSesion(ses) / 60)} min</Chip>
              </View>
              <Text style={s.resumen}>{ses.resumen}</Text>
              <Divisor />
              <Text style={s.porque}>{ses.porque}</Text>
            </Tarjeta>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

// ── El reloj de la sesión ────────────────────────────────────────────────────

function EnSesion({ sesion, onSalir, ancho, alto }: {
  sesion: Sesion; onSalir: () => void; ancho: number; alto: number
}) {
  useKeepAwake()
  const [i, setI] = useState(0)
  const [resta, setResta] = useState(sesion.bloques[0].segundos)
  const [corriendo, setCorriendo] = useState(false)
  const total = duracionSesion(sesion)
  const hechos = useRef(0)

  const bloque = sesion.bloques[i]
  const acabada = i >= sesion.bloques.length

  useEffect(() => {
    if (!corriendo || acabada) return
    const t = setInterval(() => {
      setResta(r => {
        if (r > 1) { hechos.current += 1; return r - 1 }
        // Transición: la vibración es el aviso, ya que no hay voz.
        const siguiente = sesion.bloques[i + 1]
        if (siguiente) {
          if (siguiente.tipo === 'fuerte') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          }
          setI(i + 1)
          return siguiente.segundos
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setCorriendo(false)
        setI(sesion.bloques.length)
        return 0
      })
    }, 1000)
    return () => clearInterval(t)
  }, [corriendo, i, acabada, sesion])

  const restanteTotal = sesion.bloques.slice(i + 1).reduce((a, b) => a + b.segundos, 0) + resta
  const color = acabada ? RunningColors.state.restored : COLOR[bloque.tipo]

  return (
    <View style={s.raiz}>
      <Aura ancho={ancho} alto={alto} />
      <Cabecera titulo={sesion.nombre} sub={sesion.resumen} />

      <View style={{ flex: 1, paddingHorizontal: 15 }}>
        <View style={s.centro}>
          {acabada ? (
            <>
              <Etiqueta style={{ marginBottom: 10, color }}>Sesión terminada</Etiqueta>
              <Cifra valor={hhmmss(total)} tam={54} />
            </>
          ) : (
            <>
              <Chip tono={color} style={{ marginBottom: 14 }}>
                {ETIQUETA_BLOQUE[bloque.tipo]} · bloque {i + 1} de {sesion.bloques.length}
              </Chip>
              <Cifra valor={mmss(resta)} tam={72} />
              <Text style={s.siguiente}>
                {sesion.bloques[i + 1]
                  ? `Después: ${ETIQUETA_BLOQUE[sesion.bloques[i + 1].tipo].toLowerCase()} ${mmss(sesion.bloques[i + 1].segundos)}`
                  : 'Es el último bloque'}
              </Text>
            </>
          )}
        </View>

        {/* Los bloques de un vistazo. El actual, encendido. */}
        <View style={s.tira}>
          {sesion.bloques.map((b, k) => (
            <View
              key={k}
              style={[
                s.trozo,
                { flex: Math.max(1, b.segundos) },
                { backgroundColor: k < i ? COLOR[b.tipo] : k === i ? '#fff' : 'rgba(255,255,255,0.13)' },
              ]}
            />
          ))}
        </View>

        <View style={{ marginTop: 'auto', paddingBottom: 22 }}>
          <Tarjeta>
            <FilaMetricas>
              <Metrica etiqueta="Queda" valor={hhmmss(restanteTotal)} tam={19} />
              <Metrica etiqueta="Total" valor={hhmmss(total)} tam={19} />
              <Metrica etiqueta="Bloques" valor={`${Math.min(i + 1, sesion.bloques.length)}/${sesion.bloques.length}`} tam={19} />
            </FilaMetricas>
            <Divisor />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Boton
                  rojo={!corriendo && !acabada}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                    if (acabada) { setI(0); setResta(sesion.bloques[0].segundos); setCorriendo(true) }
                    else setCorriendo(c => !c)
                  }}
                >
                  {acabada ? 'Repetir' : corriendo ? 'Pausar' : 'Empezar'}
                </Boton>
              </View>
              <View style={{ flex: 1 }}>
                <Boton onPress={onSalir}>Salir</Boton>
              </View>
            </View>
          </Tarjeta>

          <Text style={s.pie}>
            Vibra en cada cambio: tres golpes al entrar en fuerte, uno al volver a suave.
          </Text>
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: RunningColors.surface.void },
  ct: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  chips: { flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  nombre: { fontSize: 14.5, fontWeight: '700', color: '#fff', letterSpacing: -0.35, flex: 1 },
  resumen: { fontSize: 11.5, color: '#FFA45C', fontWeight: '600' },
  porque: { fontSize: 11.5, color: 'rgba(255,255,255,0.5)', lineHeight: 17.5 },
  avisoVoz: { fontSize: 11.5, color: 'rgba(255,255,255,0.55)', lineHeight: 17.5 },
  fuerte: { color: '#fff', fontWeight: '700' },
  centro: { alignItems: 'center', marginTop: 26 },
  siguiente: { fontSize: 12, color: 'rgba(255,255,255,0.42)', marginTop: 14 },
  tira: { flexDirection: 'row', gap: 2, height: 5, marginTop: 26 },
  trozo: { height: '100%', borderRadius: 3 },
  pie: { fontSize: 10.5, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 11, lineHeight: 15 },
})
