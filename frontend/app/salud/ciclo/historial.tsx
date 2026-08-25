/**
 * CICLO · HISTORIAL
 * ═══════════════════════════════════════════════════════════════════════════
 * Lo que se ve al mirar meses en vez de días: cuánto duran sus ciclos, cuánto
 * varían y qué le pasa siempre por las mismas fechas.
 *
 * ── Cada barra es un ciclo entero ──────────────────────────────────────────
 * Alto = días que duró; el tramo saturado de abajo = días que sangró. Así una
 * sola figura contesta las dos preguntas del historial —«¿cuánto dura?» y
 * «¿cuánto sangro?»— sin necesidad de dos gráficas ni de una leyenda.
 *
 * La línea horizontal es su media. No hay rejilla de fondo: con la media
 * dibujada, las rejillas solo añaden tinta. Lo que importa se lee de un
 * vistazo — si las barras bailan alrededor de la línea o se van lejos.
 *
 * ── El mapa de calor es lo que ninguna app enseña bien ─────────────────────
 * Síntoma contra día de ciclo, y cada celda es una TASA, no un recuento: si
 * fuera un recuento, los días que más registró saldrían más oscuros y lo
 * dibujado sería su constancia con la app, no su cuerpo. Ver historial.ts.
 */

import { useEffect, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, useWindowDimensions, Pressable,
} from 'react-native'
import { router } from 'expo-router'
import { Eyebrow, Seccion, Placa, Tira, Cifra, Vacio } from '@/components/salud/piezas'
import { useCicloStore } from '@/store/cicloStore'
import { useCiclo } from '@/features/salud/ciclo/useCiclo'
import {
  serieCiclos, mapaCalor, cobertura, rachaRegistro, MUESTRA_MINIMA,
} from '@/features/salud/ciclo/historial'
import { diaCorto } from '@/features/salud/ciclo/formato'
import { TRACKER_META, type TrackerKind } from '@/features/salud/trackers'
import { base, space, radius, family, type as tipo, numeric } from '@/theme/salud/tokens'
import { hoyLocal } from '@/utils/fechas'
import { Screen, ScreenHeader } from '@/components/ui/Screen'

/** Las filas del mapa. Solo lo que tiene sentido leer contra el día de ciclo. */
const FILAS: TrackerKind[] = ['sangrado', 'dolor', 'animo', 'energia', 'digestion', 'piel']

const VEREDICTO: Record<string, string> = {
  regular: 'Tus ciclos son regulares: varían poco entre sí, y por eso la predicción puede ser estrecha.',
  algo_irregular: 'Tus ciclos varían algo entre sí. Es lo más común, y la predicción lo refleja ensanchando su banda.',
  irregular: 'Tus ciclos varían bastante. No es raro ni es necesariamente un problema, pero significa que ninguna predicción puede ser precisa.',
  sin_datos: 'Aún no hay ciclos suficientes para decir si son regulares.',
}

export default function Historial() {
  const load = useCicloStore(s => s.load)
  const logs = useCicloStore(s => s.logs)
  const { width } = useWindowDimensions()
  const ciclo = useCiclo()
  const { estadisticas: est, tema, periodos, marco } = ciclo
  const hoy = hoyLocal()

  useEffect(() => { void load() }, [load])

  const serie = useMemo(
    () => serieCiclos(periodos, est.media).filter(c => c.duracion != null).slice(-14),
    [periodos, est.media],
  )

  const mapa = useMemo(
    () => mapaCalor(logs, periodos, FILAS, marco.duracion),
    [logs, periodos, marco.duracion],
  )

  const cob = useMemo(() => cobertura(logs, periodos), [logs, periodos])
  const racha = useMemo(() => rachaRegistro(logs, hoy), [logs, hoy])

  const anchoUtil = width - space.lg * 2
  const celdaCalor = (anchoUtil - (mapa.dias - 1) * 1.5) / mapa.dias

  return (
    <Screen tint={tema.accent}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        <ScreenHeader
          back
          eyebrow="Zencrus · Ciclo"
          title="Historial"
          icon="stats-chart"
          color={tema.accent}
        />

        {!est.ciclos ? (
          <Vacio
            tono={tema.accent}
            icono="stats-chart-outline"
            titulo="Todavía no hay un ciclo completo"
            texto="Un ciclo se cierra cuando empieza el siguiente. En cuanto haya dos periodos registrados aparecerá aquí su duración; con tres, empiezan los patrones."
            accion="Ir al calendario"
            onAccion={() => router.push('/salud/ciclo/calendario')}
          />
        ) : (
          <>
            {/* ── Las cifras ─────────────────────────────────────────── */}
            <Seccion eyebrow="Tus ciclos" color={tema.accent}>
              <Placa>
                <Tira
                  color={tema.accent}
                  datos={[
                    { valor: est.media ?? null, unidad: 'd', etiqueta: 'duración media' },
                    { valor: est.desviacion != null ? `±${est.desviacion}` : null, unidad: 'd', etiqueta: 'variación' },
                    { valor: est.masCorto ?? null, unidad: 'd', etiqueta: 'el más corto' },
                    { valor: est.masLargo ?? null, unidad: 'd', etiqueta: 'el más largo' },
                  ]}
                />
              </Placa>
              <Text style={s.veredicto}>{VEREDICTO[est.regularidad]}</Text>
            </Seccion>

            {/* ── La serie ───────────────────────────────────────────── */}
            {serie.length >= 2 && (
              <Seccion
                eyebrow="Ciclo a ciclo"
                nota="Alto de la barra: lo que duró el ciclo. Tramo lleno de abajo: los días que sangraste."
                color={tema.accent}
              >
                <Serie serie={serie} media={est.media} tono={tema.accent} ancho={anchoUtil} />
              </Seccion>
            )}

            {/* ── El mapa de calor ───────────────────────────────────── */}
            <Seccion
              eyebrow="Qué te pasa y cuándo"
              titulo="Mapa por día de ciclo"
              color={tema.accent}
              nota={
                mapa.filas.length
                  ? `Sobre ${mapa.ciclos} ${mapa.ciclos === 1 ? 'ciclo cerrado' : 'ciclos cerrados'}. Cuanto más marcada la celda, más veces te pasó ese día. Las celdas sin muestra suficiente se quedan vacías.`
                  : undefined
              }
            >
              {mapa.filas.length ? (
                <View style={s.mapa}>
                  {mapa.filas.map(f => (
                    <View key={f.kind} style={s.filaCalor}>
                      <View style={s.filaCab}>
                        <Eyebrow>{TRACKER_META[f.kind].label}</Eyebrow>
                        {f.pico ? (
                          <Text style={[s.pico, { color: tema.accent }]}>pico el día {f.pico}</Text>
                        ) : null}
                      </View>
                      <View style={s.celdas}>
                        {f.celdas.map((c, i) => (
                          <View
                            key={i}
                            style={[
                              s.celda,
                              { width: celdaCalor },
                              c.n >= MUESTRA_MINIMA && c.tasa > 0
                                ? { backgroundColor: tema.accent, opacity: 0.15 + c.tasa * 0.85 }
                                : { backgroundColor: base.surface2 },
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                  ))}
                  <View style={s.ejeDias}>
                    <Text style={s.ejeTxt}>día 1</Text>
                    <Text style={s.ejeTxt}>día {Math.round(mapa.dias / 2)}</Text>
                    <Text style={s.ejeTxt}>día {mapa.dias}</Text>
                  </View>
                </View>
              ) : (
                <Placa>
                  <Text style={s.sinMapa}>
                    El mapa necesita al menos {MUESTRA_MINIMA} ciclos cerrados para no dibujar
                    casualidades. Llevas {mapa.ciclos}.
                  </Text>
                </Placa>
              )}
            </Seccion>

            {/* ── La calidad del propio historial ────────────────────── */}
            <Seccion
              eyebrow="Sobre estos datos"
              nota="Todo lo de arriba vale lo que valga tu registro. Esto dice cuánto vale."
              color={tema.accent}
            >
              <Placa>
                <Tira
                  color={tema.accent}
                  datos={[
                    { valor: cob, unidad: '%', etiqueta: 'días con registro' },
                    { valor: racha || null, unidad: 'd', etiqueta: 'racha actual' },
                    { valor: est.mediaSangrado, unidad: 'd', etiqueta: 'sangrado medio' },
                  ]}
                />
              </Placa>
            </Seccion>

            {/* ── Lista ──────────────────────────────────────────────── */}
            <Seccion eyebrow="Uno por uno" color={tema.accent}>
              <Placa style={s.lista}>
                {[...serie].reverse().map((c, i) => (
                  <Pressable
                    key={c.inicio}
                    onPress={() => router.push('/salud/ciclo/calendario')}
                    style={({ pressed }) => [s.filaLista, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={s.listaFecha}>{diaCorto(c.inicio)}</Text>
                    <View style={s.flex} />
                    <Cifra valor={c.diasSangrado} unidad="d sangrado" tam="sm" />
                    <View style={s.listaDur}>
                      <Cifra valor={c.duracion} unidad="d" tam="sm" color={tema.accent} />
                    </View>
                    {c.desvio != null && Math.abs(c.desvio) >= 1 ? (
                      <Text style={[
                        s.desvio,
                        { color: Math.abs(c.desvio) > 5 ? base.warn : base.textLow },
                      ]}>
                        {c.desvio > 0 ? '+' : ''}{c.desvio}
                      </Text>
                    ) : <Text style={s.desvio}>  ·  </Text>}
                    {i < serie.length - 1 ? null : null}
                  </Pressable>
                ))}
              </Placa>
            </Seccion>
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

// ── La serie de ciclos ──────────────────────────────────────────────────────

function Serie({ serie, media, tono, ancho }: {
  serie: Array<{ inicio: string; duracion: number | null; diasSangrado: number }>
  media: number | null
  tono: string
  ancho: number
}) {
  const ALTO = 130
  const max = Math.max(...serie.map(c => c.duracion ?? 0), (media ?? 28) + 4)
  const anchoBarra = Math.min(26, (ancho - (serie.length - 1) * 6) / serie.length)
  const yMedia = media != null ? ALTO - (media / max) * ALTO : null

  return (
    <View style={[s.serie, { height: ALTO + 26 }]}>
      {/* La media, y nada más de rejilla. */}
      {yMedia != null && (
        <View style={[s.lineaMedia, { top: yMedia }]}>
          <View style={s.lineaMediaTrazo} />
          <Text style={s.lineaMediaTxt}>{media} d</Text>
        </View>
      )}

      <View style={[s.barras, { height: ALTO }]}>
        {serie.map(c => {
          const alto = ((c.duracion ?? 0) / max) * ALTO
          const sangre = Math.min(alto, (c.diasSangrado / max) * ALTO)
          return (
            <View
              key={c.inicio}
              style={[s.barra, { width: anchoBarra, height: alto, backgroundColor: `${tono}38` }]}
              accessibilityLabel={`Ciclo del ${diaCorto(c.inicio)}, ${c.duracion} días, ${c.diasSangrado} de sangrado`}
            >
              <View style={[s.barraSangre, { height: sangre, backgroundColor: tono }]} />
            </View>
          )
        })}
      </View>

      <View style={s.serieEje}>
        <Text style={s.ejeTxt}>{diaCorto(serie[0].inicio)}</Text>
        <Text style={s.ejeTxt}>{diaCorto(serie[serie.length - 1].inicio)}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },

  veredicto: {
    fontFamily: family.ui, fontSize: tipo.ui.sm, color: base.textMid,
    marginTop: space.md, lineHeight: tipo.ui.sm * 1.55,
  },

  serie: { marginTop: space.md },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  barra: { borderRadius: radius.sm, justifyContent: 'flex-end', overflow: 'hidden' },
  barraSangre: { width: '100%' },
  lineaMedia: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
  lineaMediaTrazo: { flex: 1, height: 1, backgroundColor: base.hairline },
  lineaMediaTxt: {
    fontFamily: family.data, fontSize: 9.5, color: base.textLow, marginLeft: 6, ...numeric,
  },
  serieEje: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },

  mapa: { marginTop: space.md, gap: space.md },
  filaCalor: { gap: 5 },
  filaCab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pico: { fontFamily: family.uiMedium, fontSize: 10.5 },
  celdas: { flexDirection: 'row', gap: 1.5 },
  celda: { height: 16, borderRadius: 2 },
  ejeDias: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  ejeTxt: { fontFamily: family.data, fontSize: 9.5, color: base.textLow, ...numeric },
  sinMapa: {
    fontFamily: family.ui, fontSize: tipo.ui.sm, color: base.textMid,
    lineHeight: tipo.ui.sm * 1.55,
  },

  lista: { paddingVertical: 2 },
  filaLista: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingVertical: space.sm + 2,
  },
  listaFecha: { fontFamily: family.uiMedium, fontSize: tipo.ui.sm, color: base.textHi, width: 62 },
  listaDur: { width: 54, alignItems: 'flex-end' },
  desvio: { fontFamily: family.data, fontSize: tipo.ui.xs, width: 34, textAlign: 'right', ...numeric },
})
