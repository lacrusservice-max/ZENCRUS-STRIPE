/**
 * CICLO · CALENDARIO
 * ═══════════════════════════════════════════════════════════════════════════
 * El mes entero de un vistazo, y cualquier día a un toque para registrar en
 * retrospectiva —que es como se registra de verdad: acordándose por la noche o
 * dos días después.
 *
 * ── La cinta que atraviesa la rejilla ──────────────────────────────────────
 * Las fases no se pintan como pastillas sueltas dentro de cada casilla, sino
 * como una franja continua bajo los números que cruza la semana de lado a
 * lado. Es el mismo gesto que La Cinta de la portada, y hace visible lo que
 * una rejilla de pastillas esconde: que un ciclo es un continuo, no una
 * colección de días independientes.
 *
 * ── Cuatro canales, no cuatro colores ──────────────────────────────────────
 * Hay que distinguir sangrado registrado, sangrado previsto, ovulación, día
 * con registro y hoy. Resolverlo con cinco colores sería ilegible —y sobre
 * todo, inaccesible—, así que cada cosa usa un canal distinto:
 *   · altura de la franja  → sangrado registrado
 *   · franja en contorno   → sangrado previsto
 *   · rombo                → ovulación estimada
 *   · punto                → ese día registró algo
 *   · aro                  → hoy
 * Ninguno depende de distinguir dos tonos parecidos.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Seccion, Placa, Filete } from '@/components/salud/piezas'
import { useCicloStore } from '@/store/cicloStore'
import { useCiclo } from '@/features/salud/ciclo/useCiclo'
import {
  construirMes, mesAnterior, mesSiguiente, type DiaCalendario,
} from '@/features/salud/ciclo/calendario'
import { DIAS_SEMANA, nombreMes, diaLargo } from '@/features/salud/ciclo/formato'
import { SANGRADO_MINIMO } from '@/features/salud/ciclo/periodos'
import { TRACKER_META, type TrackerKind } from '@/features/salud/trackers'
import { PHASES, base, space, radius, family, type as tipo, numeric } from '@/theme/salud/tokens'
import { hoyLocal } from '@/utils/fechas'
import { elegir } from '@/utils/haptica'
import { Screen, ScreenHeader } from '@/components/ui/Screen'

export default function Calendario() {
  const load = useCicloStore(s => s.load)
  const logs = useCicloStore(s => s.logs)
  const declararInicio = useCicloStore(s => s.declararInicio)
  const quitarInicio = useCicloStore(s => s.quitarInicio)
  const inicios = useCicloStore(s => s.inicios)

  const { width } = useWindowDimensions()
  const ciclo = useCiclo()
  const hoy = hoyLocal()

  const [{ año, mes }, setMes] = useState(() => {
    const [a, m] = hoy.split('-').map(Number)
    return { año: a, mes: m }
  })
  const [elegido, setElegido] = useState<string | null>(hoy)

  useEffect(() => { void load() }, [load])

  const rejilla = useMemo(
    () => construirMes({
      año, mes, logs,
      periodos: ciclo.periodos,
      prediccion: ciclo.prediccion,
      marco: ciclo.marco,
      hoy,
    }),
    [año, mes, logs, ciclo.periodos, ciclo.prediccion, ciclo.marco, hoy],
  )

  const celda = (width - space.lg * 2) / 7
  const dia = elegido ? rejilla.dias.find(d => d.fecha === elegido) ?? null : null

  const ir = (delta: -1 | 1) => {
    elegir()
    setMes(delta === -1 ? mesAnterior(año, mes) : mesSiguiente(año, mes))
  }

  return (
    <Screen tint={ciclo.tema.accent}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        <ScreenHeader
          back
          eyebrow="Zencrus · Ciclo"
          title="Calendario"
          icon="calendar"
          color={ciclo.tema.accent}
        />

        {/* ── Mes ────────────────────────────────────────────────────── */}
        <View style={s.barraMes}>
          <Pressable onPress={() => ir(-1)} hitSlop={12} accessibilityLabel="Mes anterior">
            <Ionicons name="chevron-back" size={20} color={base.textMid} />
          </Pressable>
          <View style={s.centro}>
            <Text style={s.mes}>{nombreMes(mes)}</Text>
            <Text style={s.año}>{año}</Text>
          </View>
          <Pressable onPress={() => ir(1)} hitSlop={12} accessibilityLabel="Mes siguiente">
            <Ionicons name="chevron-forward" size={20} color={base.textMid} />
          </Pressable>
        </View>

        {/* ── Rejilla ────────────────────────────────────────────────── */}
        <View style={s.rejilla}>
          <View style={s.semana}>
            {DIAS_SEMANA.map((d, i) => (
              <Text key={i} style={[s.diaSemana, { width: celda }]}>{d}</Text>
            ))}
          </View>

          {Array.from({ length: 6 }, (_, fila) => (
            <View key={fila} style={s.fila}>
              {rejilla.dias.slice(fila * 7, fila * 7 + 7).map(d => (
                <Celda
                  key={d.fecha}
                  d={d}
                  ancho={celda}
                  elegido={d.fecha === elegido}
                  onPress={() => { elegir(); setElegido(d.fecha) }}
                />
              ))}
            </View>
          ))}
        </View>

        {/* ── Leyenda ────────────────────────────────────────────────── */}
        <View style={s.leyenda}>
          <Marca color={PHASES.menstrual.accent} alto={7} texto="sangrado registrado" />
          <Marca color={PHASES.menstrual.accent} alto={7} contorno texto="previsto" />
          <Marca color={PHASES.ovulatoria.accent} rombo texto="ovulación estimada" />
        </View>

        {/* ── El día elegido ─────────────────────────────────────────── */}
        {dia && (
          <Seccion
            eyebrow={dia.hoy ? 'Hoy' : 'Día elegido'}
            titulo={diaLargo(dia.fecha)}
            color={ciclo.tema.accent}
            nota={
              dia.diaDeCiclo != null
                ? `Día ${dia.diaDeCiclo} de tu ciclo · fase ${dia.fase ? PHASES[dia.fase].label.toLowerCase() : '—'}`
                : 'Fuera de cualquier ciclo que el módulo pueda situar.'
            }
          >
            <Placa>
              <DetalleDia fecha={dia.fecha} registros={logs[dia.fecha]} tono={ciclo.tema.accent} />
              <Filete />
              <Pressable
                onPress={() => router.push({ pathname: '/salud/ciclo/registrar', params: { fecha: dia.fecha } })}
                style={({ pressed }) => [s.accion, pressed && s.pulsado]}
              >
                <Ionicons name="create-outline" size={16} color={ciclo.tema.accent} />
                <Text style={[s.accionTxt, { color: ciclo.tema.accent }]}>
                  {logs[dia.fecha] ? 'Editar este día' : 'Registrar este día'}
                </Text>
              </Pressable>
              <Filete />
              {/* La corrección a mano: el motor deduce, ella decide. */}
              <Pressable
                onPress={() => {
                  elegir()
                  if (inicios.includes(dia.fecha)) void quitarInicio(dia.fecha)
                  else void declararInicio(dia.fecha)
                }}
                style={({ pressed }) => [s.accion, pressed && s.pulsado]}
              >
                <Ionicons
                  name={inicios.includes(dia.fecha) ? 'flag' : 'flag-outline'}
                  size={16}
                  color={base.textMid}
                />
                <Text style={s.accionSec}>
                  {inicios.includes(dia.fecha)
                    ? 'Quitar «aquí empezó mi regla»'
                    : 'Marcar que aquí empezó mi regla'}
                </Text>
              </Pressable>
            </Placa>
            <Text style={s.pie}>
              Marcar el inicio a mano corrige lo que el módulo dedujo de tu sangrado.
              Se usa para calcular tus ciclos y manda sobre la deducción.
            </Text>
          </Seccion>
        )}
      </ScrollView>
    </Screen>
  )
}

// ── Celda ───────────────────────────────────────────────────────────────────

function Celda({ d, ancho, elegido, onPress }: {
  d: DiaCalendario; ancho: number; elegido: boolean; onPress: () => void
}) {
  const tono = d.fase ? PHASES[d.fase].accent : base.hairline
  const sangra = d.sangrado != null && d.sangrado >= SANGRADO_MINIMO
  /* La franja crece con el nivel: la intensidad se lee por la forma y no solo
     por el color, que es lo que la hace legible sin distinguir tonos. */
  const alto = sangra ? 4 + (d.sangrado ?? 0) * 1.6 : 3

  return (
    <Pressable
      onPress={onPress}
      style={[s.celda, { width: ancho }]}
      accessibilityRole="button"
      accessibilityLabel={
        `${d.numero}${d.diaDeCiclo ? `, día ${d.diaDeCiclo} del ciclo` : ''}` +
        `${sangra ? ', sangrado registrado' : ''}${d.periodoPredicho ? ', periodo previsto' : ''}` +
        `${d.hoy ? ', hoy' : ''}`
      }
    >
      <View style={[
        s.numeroCaja,
        elegido && { backgroundColor: `${tono}33` },
        d.hoy && { borderColor: tono, borderWidth: 1.5 },
      ]}>
        <Text style={[
          s.numero,
          !d.delMes && s.fuera,
          d.hoy && { color: base.textHi },
        ]}>
          {d.numero}
        </Text>
      </View>

      {/* Punto de actividad: ese día registró algo. */}
      <View style={s.marcas}>
        {d.registros > 0 ? (
          <View style={[s.punto, { backgroundColor: d.delMes ? tono : base.hairline }]} />
        ) : <View style={s.punto} />}
        {d.ovulacionPredicha ? (
          <View style={[s.rombo, { borderColor: PHASES.ovulatoria.accent }]} />
        ) : null}
      </View>

      {/* La franja de fase: continua de lado a lado de la semana.
          Va dentro de un carril de alto FIJO y anclada abajo. Sin el carril,
          las filas con sangrado abundante —franja más alta— crecían y la
          rejilla se ondulaba de arriba abajo: cada semana a una altura
          distinta según lo que hubiera pasado esa semana. */}
      <View style={s.carril}>
      <View style={[
        s.franja,
        { height: alto, opacity: d.delMes ? 1 : 0.28 },
        sangra
          ? { backgroundColor: tono }
          : d.periodoPredicho
            ? { borderWidth: 1.2, borderColor: tono, borderStyle: 'dashed', backgroundColor: 'transparent' }
            : d.bandaPrediccion
              ? { backgroundColor: `${tono}33` }
              : d.fase
                ? { backgroundColor: `${tono}${d.fertil ? '55' : '2E'}` }
                : { backgroundColor: 'transparent' },
      ]} />
      </View>
    </Pressable>
  )
}

// ── Detalle del día ─────────────────────────────────────────────────────────

function DetalleDia({ registros, tono }: {
  fecha: string
  registros: Record<string, unknown> | undefined
  tono: string
}) {
  if (!registros || !Object.keys(registros).length) {
    return <Text style={s.vacioDia}>Nada registrado este día.</Text>
  }
  return (
    <View style={s.etiquetas}>
      {(Object.keys(registros) as TrackerKind[]).map(k => (
        <View key={k} style={[s.etiqueta, { backgroundColor: `${tono}1F` }]}>
          <Text style={[s.etiquetaTxt, { color: tono }]}>
            {TRACKER_META[k]?.label ?? k}
          </Text>
        </View>
      ))}
    </View>
  )
}

// ── Leyenda ─────────────────────────────────────────────────────────────────

function Marca({ color, alto = 5, contorno, rombo, texto }: {
  color: string; alto?: number; contorno?: boolean; rombo?: boolean; texto: string
}) {
  return (
    <View style={s.marca}>
      {rombo ? (
        <View style={[s.rombo, { borderColor: color }]} />
      ) : (
        <View style={[
          s.muestra,
          { height: alto },
          contorno
            ? { borderWidth: 1.2, borderColor: color, borderStyle: 'dashed' }
            : { backgroundColor: color },
        ]} />
      )}
      <Text style={s.marcaTxt}>{texto}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  centro: { alignItems: 'center' },
  pulsado: { opacity: 0.7 },

  barraMes: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: space.lg, marginTop: space.md,
  },
  mes: {
    fontFamily: family.displaySemi, fontSize: tipo.display.sm,
    color: base.textHi, textTransform: 'capitalize',
  },
  año: { fontFamily: family.data, fontSize: tipo.ui.xs, color: base.textLow, ...numeric },

  rejilla: { marginHorizontal: space.lg, marginTop: space.lg },
  semana: { flexDirection: 'row', marginBottom: space.sm },
  diaSemana: {
    fontFamily: family.brand, fontSize: 10, letterSpacing: 1.6,
    color: base.textLow, textAlign: 'center',
  },
  fila: { flexDirection: 'row' },

  celda: { alignItems: 'center', paddingTop: 6, paddingBottom: 6, gap: 3 },
  numeroCaja: {
    width: 28, height: 28, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent',
  },
  numero: { fontFamily: family.data, fontSize: tipo.ui.sm, color: base.textMid, ...numeric },
  fuera: { color: base.textLow, opacity: 0.4 },

  marcas: { height: 6, flexDirection: 'row', alignItems: 'center', gap: 3 },
  punto: { width: 3.5, height: 3.5, borderRadius: 2 },
  rombo: {
    width: 6, height: 6, borderWidth: 1.2,
    transform: [{ rotate: '45deg' }],
  },

  carril: { width: '100%', height: 13, justifyContent: 'flex-end' },
  franja: { width: '100%', borderRadius: 1.5 },

  leyenda: {
    flexDirection: 'row', flexWrap: 'wrap', gap: space.md,
    marginHorizontal: space.lg, marginTop: space.lg,
  },
  marca: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  muestra: { width: 16, borderRadius: 1.5 },
  marcaTxt: { fontFamily: family.ui, fontSize: 10.5, color: base.textLow },

  accion: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md - 2 },
  accionTxt: { fontFamily: family.uiSemi, fontSize: tipo.ui.sm },
  accionSec: { fontFamily: family.ui, fontSize: tipo.ui.sm, color: base.textMid },

  vacioDia: {
    fontFamily: family.ui, fontSize: tipo.ui.sm, color: base.textLow,
    paddingBottom: space.md - 2,
  },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: space.md - 2 },
  etiqueta: { paddingHorizontal: space.sm + 2, paddingVertical: 5, borderRadius: radius.pill },
  etiquetaTxt: { fontFamily: family.uiMedium, fontSize: tipo.ui.xs },

  pie: {
    fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textLow,
    marginTop: space.sm, lineHeight: tipo.ui.xs * 1.5,
  },
})
